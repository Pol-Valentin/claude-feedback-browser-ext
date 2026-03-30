// --- State ---
let connected = false
let sessionId = null
let activeChannelId = null
let channelsList = []
let capturedElement = null   // { fingerprint, url }
let capturedScreenshot = null // base64 data url
let highlightsEnabled = true
let elementCapturing = false
let screenshotCapturing = false

// --- DOM refs ---
const connectionIndicator = document.getElementById('connection-indicator')
const highlightToggle = document.getElementById('highlight-toggle')
const sessionListEl = document.getElementById('session-list')
const noSessions = document.getElementById('no-sessions')
const btnRefreshChannels = document.getElementById('btn-refresh-channels')
const chatMessages = document.getElementById('chat-messages')
const chatEmpty = document.getElementById('chat-empty')

// Composer
const composerInput = document.getElementById('composer-input')
const btnElement = document.getElementById('btn-element')
const btnScreenshot = document.getElementById('btn-screenshot')
const btnSend = document.getElementById('btn-send')
const chipElement = document.getElementById('chip-element')
const chipElementLabel = document.getElementById('chip-element-label')
const chipElementRemove = document.getElementById('chip-element-remove')
const chipScreenshot = document.getElementById('chip-screenshot')
const chipScreenshotImg = document.getElementById('chip-screenshot-img')
const chipScreenshotRemove = document.getElementById('chip-screenshot-remove')

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

  btnElement.disabled = !hasActive
  btnScreenshot.disabled = !hasActive
  composerInput.disabled = !hasActive
  updateSendButton()
  renderChannelList()
}

function updateSendButton() {
  const hasText = composerInput.value.trim().length > 0
  const hasElement = !!capturedElement
  const hasScreenshot = !!capturedScreenshot

  // Element without comment → disabled. Screenshot alone or text alone → ok.
  if (hasElement && !hasText) {
    btnSend.disabled = true
  } else if (hasText || hasScreenshot) {
    btnSend.disabled = !connected
  } else {
    btnSend.disabled = true
  }
}

// --- Channel list ---
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

    const label = ch.name
      || (ch.cwd ? ch.cwd.replace(/^\/home\/[^/]+\//, '~/') : null)
      || ch.channelId.slice(0, 8)

    const subtitle = ch.name && ch.cwd
      ? ch.cwd.replace(/^\/home\/[^/]+\//, '~/')
      : ''

    el.innerHTML = `
      <span class="session-status connected"></span>
      <span class="session-label">${escapeHtml(label)}</span>
      ${subtitle ? `<span class="session-subtitle">${escapeHtml(subtitle)}</span>` : ''}
      <span class="session-id">${ch.channelId.slice(0, 6)}</span>
    `

    el.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'set_active_channel', channelId: ch.channelId })
    })

    sessionListEl.appendChild(el)
  }
}

btnRefreshChannels.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'refresh_channels' })
  btnRefreshChannels.classList.add('spinning')
  setTimeout(() => btnRefreshChannels.classList.remove('spinning'), 500)
})

// --- Element capture ---
btnElement.addEventListener('click', () => {
  if (capturedElement) {
    // Re-capture: clear current and start inspector again
    removeElement()
  }
  chrome.runtime.sendMessage({ type: 'toggle_inspector' })
  elementCapturing = true
  btnElement.classList.add('capturing')
})

chipElementRemove.addEventListener('click', removeElement)

function removeElement() {
  capturedElement = null
  chipElement.classList.add('hidden')
  btnElement.classList.remove('captured')
  updateSendButton()
}

// --- Screenshot capture ---
btnScreenshot.addEventListener('click', () => {
  if (capturedScreenshot) {
    removeScreenshot()
  }
  chrome.runtime.sendMessage({ type: 'start_area_screenshot' })
  screenshotCapturing = true
  btnScreenshot.classList.add('capturing')
})

chipScreenshotRemove.addEventListener('click', removeScreenshot)

function removeScreenshot() {
  capturedScreenshot = null
  chipScreenshot.classList.add('hidden')
  btnScreenshot.classList.remove('captured')
  updateSendButton()
}

// --- Incoming messages ---
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'element_selected') {
    capturedElement = { fingerprint: msg.fingerprint, url: msg.url }
    elementCapturing = false
    btnElement.classList.remove('capturing')
    btnElement.classList.add('captured')

    const fp = msg.fingerprint
    const label = fp.component
      ? `${fp.component} — ${truncate(fp.selector, 30)}`
      : truncate(fp.selector, 40)
    chipElementLabel.textContent = label
    chipElement.classList.remove('hidden')

    composerInput.focus()
    updateSendButton()
    return
  }

  if (msg.type === 'inspector_cancelled') {
    elementCapturing = false
    btnElement.classList.remove('capturing')
    return
  }

  if (msg.type === 'area_screenshot_result') {
    screenshotCapturing = false
    btnScreenshot.classList.remove('capturing')
    if (msg.error) {
      addChatMessage('system', `Screenshot error: ${msg.error}`)
      return
    }
    cropScreenshot(msg.image, msg.rect, msg.dpr)
    return
  }

  if (msg.type === 'area_screenshot_cancelled') {
    screenshotCapturing = false
    btnScreenshot.classList.remove('capturing')
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

// --- Send ---
btnSend.addEventListener('click', send)
composerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
})
composerInput.addEventListener('input', () => {
  composerInput.style.height = 'auto'
  composerInput.style.height = Math.min(composerInput.scrollHeight, 120) + 'px'
  updateSendButton()
})

function send() {
  const text = composerInput.value.trim()
  const hasElement = !!capturedElement
  const hasScreenshot = !!capturedScreenshot

  // Validation
  if (hasElement && !text) return
  if (!hasElement && !hasScreenshot && !text) return

  if (hasElement) {
    // element_feedback (optionally with image)
    const fp = capturedElement.fingerprint
    const feedbackMsg = {
      type: 'element_feedback',
      url: capturedElement.url,
      selector: fp.selector,
      outerHTML: fp.outerHTML,
      textContent: fp.textContent,
      attributes: fp.attributes,
      component: fp.component,
      context: fp.context,
      comment: text,
    }
    if (hasScreenshot) {
      feedbackMsg.image = capturedScreenshot
    }
    chrome.runtime.sendMessage(feedbackMsg)
    addChatMessage('user', text, {
      type: 'element',
      selector: fp.selector,
      component: fp.component,
      image: capturedScreenshot || null,
    })
  } else if (hasScreenshot) {
    // screenshot only
    chrome.runtime.sendMessage({
      type: 'screenshot',
      url: '',
      image: capturedScreenshot,
      comment: text,
    })
    addChatMessage('user', text || 'Screenshot captured', {
      type: 'screenshot',
      image: capturedScreenshot,
    })
  } else {
    // free message
    chrome.runtime.sendMessage({ type: 'free_message', url: '', comment: text })
    addChatMessage('user', text)
  }

  // Reset composer
  capturedElement = null
  capturedScreenshot = null
  chipElement.classList.add('hidden')
  chipScreenshot.classList.add('hidden')
  btnElement.classList.remove('captured', 'capturing')
  btnScreenshot.classList.remove('captured', 'capturing')
  composerInput.value = ''
  composerInput.style.height = 'auto'
  updateSendButton()
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
    if (meta.image) {
      metaHtml += `<div class="msg-meta"><img src="${meta.image}" class="msg-screenshot-thumb" alt="attached screenshot"></div>`
    }
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

    capturedScreenshot = canvas.toDataURL('image/png')
    chipScreenshotImg.src = capturedScreenshot
    chipScreenshot.classList.remove('hidden')
    btnScreenshot.classList.add('captured')

    composerInput.focus()
    updateSendButton()
  }
  img.onerror = () => {
    addChatMessage('system', 'Failed to process screenshot')
  }
  img.src = imageDataUrl
}

// --- Keyboard shortcuts ---
document.addEventListener('keydown', (e) => {
  if (!connected) return

  // Ctrl+Shift+E → Element capture
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault()
    btnElement.click()
    return
  }

  // Ctrl+Shift+S → Screenshot capture
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    e.preventDefault()
    btnScreenshot.click()
    return
  }
})

// --- Ctrl+V paste-to-send ---
document.addEventListener('keydown', async (e) => {
  if (!(e.ctrlKey && e.key === 'v')) return
  if (!connected) return

  const active = document.activeElement
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return

  e.preventDefault()

  let clipboardText
  try {
    clipboardText = (await navigator.clipboard.readText()).trim()
  } catch { return }
  if (!clipboardText) return

  chrome.runtime.sendMessage({ type: 'free_message', url: '', comment: clipboardText })
  addChatMessage('user', clipboardText)
})

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
