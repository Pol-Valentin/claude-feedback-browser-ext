// --- State ---
let connected = false
let sessionId = null
let activeChannelId = null
let channelsList = []
let inspectorActive = false
let currentFingerprint = null
let currentUrl = null
let currentScreenshot = null
let highlightsEnabled = true

// --- DOM refs ---
const connectionIndicator = document.getElementById('connection-indicator')
const btnInspect = document.getElementById('btn-inspect')
const btnScreenshot = document.getElementById('btn-screenshot')
const elementPreview = document.getElementById('element-preview')
const previewContent = document.getElementById('preview-content')
const previewClose = document.getElementById('preview-close')
const screenshotPreview = document.getElementById('screenshot-preview')
const screenshotImg = document.getElementById('screenshot-img')
const screenshotClose = document.getElementById('screenshot-close')
const commentArea = document.getElementById('comment-area')
const commentInput = document.getElementById('comment-input')
const btnSend = document.getElementById('btn-send')
const btnCancel = document.getElementById('btn-cancel')
const chatMessages = document.getElementById('chat-messages')
const chatEmpty = document.getElementById('chat-empty')
const highlightToggle = document.getElementById('highlight-toggle')
const messageInput = document.getElementById('message-input')
const btnMessageSend = document.getElementById('btn-message-send')
const sessionListEl = document.getElementById('session-list')
const noSessions = document.getElementById('no-sessions')
const btnRefreshChannels = document.getElementById('btn-refresh-channels')

// --- Init ---
chrome.runtime.sendMessage({ type: 'get_state' }, (res) => {
  if (res) updateState(res)
})

chrome.storage.local.get(['highlightsEnabled'], (result) => {
  if (result.highlightsEnabled !== undefined) {
    highlightsEnabled = result.highlightsEnabled
    highlightToggle.checked = highlightsEnabled
  }
})

// --- State management ---
function updateState(state) {
  connected = state.connected
  sessionId = state.sessionId
  channelsList = state.channels || []
  activeChannelId = state.activeChannelId

  const hasActive = connected && activeChannelId
  connectionIndicator.className = `indicator ${connected ? 'connected' : 'disconnected'}`
  connectionIndicator.title = connected ? `Connected (${channelsList.length} channel${channelsList.length !== 1 ? 's' : ''})` : 'Disconnected'
  btnInspect.disabled = !hasActive
  btnScreenshot.disabled = !hasActive
  messageInput.disabled = !hasActive
  btnMessageSend.disabled = !hasActive

  renderChannelList()
}

function renderChannelList() {
  sessionListEl.innerHTML = ''

  if (channelsList.length === 0) {
    noSessions.style.display = connected ? 'none' : 'block'
    noSessions.textContent = connected ? '' : 'No channels connected'
    return
  }
  noSessions.style.display = 'none'

  for (const ch of channelsList) {
    const el = document.createElement('div')
    const isActive = ch.channelId === activeChannelId
    el.className = `session-item ${isActive ? 'session-active' : ''}`

    const label = ch.cwd
      ? ch.cwd.replace(/^\/home\/[^/]+\//, '~/')
      : ch.channelId.slice(0, 8)

    el.innerHTML = `
      <span class="session-status connected"></span>
      <span class="session-label">${escapeHtml(label)}</span>
      <span class="session-id">${ch.channelId.slice(0, 6)}</span>
    `

    el.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'set_active_channel', channelId: ch.channelId })
    })

    sessionListEl.appendChild(el)
  }
}

// --- Refresh channels ---
btnRefreshChannels.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'refresh_channels' })
  btnRefreshChannels.classList.add('spinning')
  setTimeout(() => btnRefreshChannels.classList.remove('spinning'), 500)
})

// --- Inspect button ---
btnInspect.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'toggle_inspector' }, (res) => {
    if (res?.active !== undefined) {
      inspectorActive = res.active
    } else {
      inspectorActive = !inspectorActive
    }
    btnInspect.classList.toggle('active', inspectorActive)
  })
})

// --- Screenshot button (area selection) ---
btnScreenshot.addEventListener('click', () => {
  clearSelection()
  // Enter area selection mode in the content script
  chrome.runtime.sendMessage({ type: 'start_area_screenshot' })
  btnScreenshot.classList.add('active')
})

// --- Incoming messages ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'element_selected') {
    currentFingerprint = msg.fingerprint
    currentUrl = msg.url
    currentScreenshot = null
    inspectorActive = false
    btnInspect.classList.remove('active')

    const fp = msg.fingerprint
    previewContent.innerHTML = `
      <div class="preview-selector">${escapeHtml(fp.selector)}</div>
      <div class="preview-text">${escapeHtml(truncate(fp.textContent, 80))}</div>
      ${fp.component ? `<div class="preview-component">⚛️ ${escapeHtml(fp.component)}</div>` : ''}
    `
    elementPreview.classList.remove('hidden')
    screenshotPreview.classList.add('hidden')
    commentArea.classList.remove('hidden')
    commentInput.focus()
    return
  }

  if (msg.type === 'inspector_cancelled') {
    inspectorActive = false
    btnInspect.classList.remove('active')
    return
  }

  if (msg.type === 'state_update') {
    updateState(msg)
    return
  }

  if (msg.type === 'reply') {
    addChatMessage('claude', msg.message)
    return
  }

  if (msg.type === 'highlight') {
    addHighlightMessage(msg.selector, msg.label)
    return
  }

  if (msg.type === 'area_screenshot_result') {
    btnScreenshot.classList.remove('active')
    if (msg.error) {
      addChatMessage('system', `Screenshot error: ${msg.error}`)
      return
    }
    cropScreenshot(msg.image, msg.rect, msg.dpr)
    return
  }

  if (msg.type === 'area_screenshot_cancelled') {
    btnScreenshot.classList.remove('active')
    return
  }

  if (msg.type === 'highlight_dismissed') {
    const hlMsg = document.querySelector(`[data-highlight-id="${msg.highlightId}"]`)
    if (hlMsg) {
      hlMsg.classList.add('dismissed')
      const btn = hlMsg.querySelector('.hl-show-btn')
      if (btn) btn.remove()
    }
    return
  }
})

// --- Send feedback ---
btnSend.addEventListener('click', sendFeedback)
commentInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendFeedback()
})

function sendFeedback() {
  const comment = commentInput.value.trim()

  if (currentFingerprint) {
    if (!comment) {
      commentInput.classList.add('error')
      commentInput.placeholder = 'Please add a comment...'
      setTimeout(() => {
        commentInput.classList.remove('error')
        commentInput.placeholder = 'Describe your feedback...'
      }, 2000)
      return
    }

    chrome.runtime.sendMessage({
      type: 'element_feedback',
      url: currentUrl,
      selector: currentFingerprint.selector,
      outerHTML: currentFingerprint.outerHTML,
      textContent: currentFingerprint.textContent,
      attributes: currentFingerprint.attributes,
      component: currentFingerprint.component,
      context: currentFingerprint.context,
      comment,
    })

    addChatMessage('user', comment, {
      type: 'element',
      selector: currentFingerprint.selector,
      component: currentFingerprint.component,
    })
  } else if (currentScreenshot) {
    chrome.runtime.sendMessage({
      type: 'screenshot',
      url: '',
      image: currentScreenshot,
      comment,
    })

    addChatMessage('user', comment || 'Screenshot captured', {
      type: 'screenshot',
      image: currentScreenshot,
    })
  }

  clearSelection()
}

btnCancel.addEventListener('click', clearSelection)
previewClose.addEventListener('click', clearSelection)
screenshotClose.addEventListener('click', clearSelection)

function clearSelection() {
  currentFingerprint = null
  currentScreenshot = null
  currentUrl = null
  elementPreview.classList.add('hidden')
  screenshotPreview.classList.add('hidden')
  commentArea.classList.add('hidden')
  commentInput.value = ''
}

// --- Highlight toggle ---
highlightToggle.addEventListener('change', () => {
  highlightsEnabled = highlightToggle.checked
  chrome.storage.local.set({ highlightsEnabled })
  chrome.runtime.sendMessage({ type: 'toggle_highlights', enabled: highlightsEnabled })
})

// --- Chat messages ---
function addChatMessage(role, content, meta = null) {
  chatEmpty.style.display = 'none'

  const msgEl = document.createElement('div')
  msgEl.className = `chat-message chat-${role}`

  let metaHtml = ''
  if (meta?.type === 'element') {
    metaHtml = `<div class="msg-meta">🔍 <code>${escapeHtml(truncate(meta.selector, 40))}</code>${meta.component ? ` · ⚛️ ${escapeHtml(meta.component)}` : ''}</div>`
  } else if (meta?.type === 'screenshot') {
    metaHtml = `<div class="msg-meta"><img src="${meta.image}" class="msg-screenshot-thumb" alt="screenshot"></div>`
  }

  const contentHtml = role === 'claude' ? renderMarkdown(content) : escapeHtml(content)

  msgEl.innerHTML = `
    ${metaHtml}
    <div class="msg-content">${contentHtml}</div>
    <div class="msg-time">${new Date().toLocaleTimeString()}</div>
  `

  chatMessages.appendChild(msgEl)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

function addHighlightMessage(selector, label) {
  chatEmpty.style.display = 'none'

  const msgEl = document.createElement('div')
  msgEl.className = 'chat-message chat-highlight'
  const id = `hl-${Date.now()}`
  msgEl.dataset.highlightId = id

  msgEl.innerHTML = `
    <div class="msg-content">
      🔦 Highlight: <code>${escapeHtml(selector)}</code>
      ${label ? ` — ${escapeHtml(label)}` : ''}
    </div>
    <div class="msg-actions">
      <button class="hl-show-btn" title="Show in page">🔦 Show</button>
      <button class="hl-dismiss-btn" title="Dismiss">✕</button>
    </div>
  `

  msgEl.querySelector('.hl-show-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'show_single_highlight', selector, label })
  })
  msgEl.querySelector('.hl-dismiss-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'dismiss_highlight', highlightId: id })
    msgEl.classList.add('dismissed')
    msgEl.querySelector('.hl-show-btn').remove()
  })

  chatMessages.appendChild(msgEl)
  chatMessages.scrollTop = chatMessages.scrollHeight
}

// --- Free message input ---
btnMessageSend.addEventListener('click', sendFreeMessage)
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFreeMessage() }
})
messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto'
  messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px'
})

function sendFreeMessage() {
  const text = messageInput.value.trim()
  if (!text) return
  chrome.runtime.sendMessage({ type: 'free_message', url: '', comment: text })
  addChatMessage('user', text)
  messageInput.value = ''
  messageInput.style.height = 'auto'
}

// --- Crop screenshot ---
function cropScreenshot(imageDataUrl, rect, dpr) {
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const sx = Math.round(rect.x * dpr)
    const sy = Math.round(rect.y * dpr)
    const sw = Math.round(rect.w * dpr)
    const sh = Math.round(rect.h * dpr)

    canvas.width = sw
    canvas.height = sh

    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)

    const croppedDataUrl = canvas.toDataURL('image/png')
    currentScreenshot = croppedDataUrl
    screenshotImg.src = croppedDataUrl
    screenshotPreview.classList.remove('hidden')
    commentArea.classList.remove('hidden')
    commentInput.focus()
  }
  img.onerror = () => {
    addChatMessage('system', 'Failed to process screenshot')
  }
  img.src = imageDataUrl
}

// --- Utilities ---
function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str || ''
  return div.innerHTML
}

function truncate(str, maxLen) {
  if (!str) return ''
  return str.length <= maxLen ? str : str.slice(0, maxLen) + '...'
}

function renderMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}
