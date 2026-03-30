// --- Config ---
const DEFAULT_WS_PORT = 9420
const MAX_RECONNECT_DELAY = 30000

let ws = null
let wsConnected = false
let reconnectTimer = null
let reconnectDelay = 1000
let sessionId = null
let activeChannelId = null // Which Claude Code session to send to
let channelsList = [] // Available channels [{channelId, cwd, connectedAt}]

// Restore activeChannelId from session storage (survives service worker restarts)
chrome.storage.session.get(['activeChannelId'], (result) => {
  if (result.activeChannelId) {
    activeChannelId = result.activeChannelId
  }
})

function setActiveChannel(channelId) {
  activeChannelId = channelId
  chrome.storage.session.set({ activeChannelId: channelId })
}

// --- WebSocket Connection (single, to the hub) ---
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
    return
  }

  try {
    ws = new WebSocket(`ws://localhost:${DEFAULT_WS_PORT}`)
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    wsConnected = true
    reconnectDelay = 1000
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }

    sessionId = crypto.randomUUID()
    ws.send(JSON.stringify({
      type: 'subscribe',
      session_id: sessionId,
      metadata: { connectedAt: Date.now() },
    }))

    broadcastState()
  }

  ws.onmessage = (event) => {
    let msg
    try { msg = JSON.parse(event.data) } catch { return }
    handleIncomingMessage(msg)
  }

  ws.onclose = () => {
    wsConnected = false
    ws = null
    channelsList = []
    broadcastState()
    scheduleReconnect()
  }

  ws.onerror = () => {}
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
    connectWebSocket()
  }, reconnectDelay)
}

function sendToChannel(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(JSON.stringify({
    ...message,
    session_id: sessionId,
    target_channel: activeChannelId,
  }))
  return true
}

// --- State broadcast to side panel ---
function broadcastState() {
  chrome.runtime.sendMessage({
    type: 'state_update',
    connected: wsConnected,
    sessionId,
    channels: channelsList,
    activeChannelId,
  }).catch(() => {})
}

// --- Handle incoming messages from hub ---
function handleIncomingMessage(msg) {
  if (msg.type === 'subscribed') {
    sessionId = msg.session_id
    channelsList = msg.channels || []
    // Validate restored/current activeChannelId against available channels
    if (activeChannelId && !channelsList.find(c => c.channelId === activeChannelId)) {
      setActiveChannel(channelsList.length > 0 ? channelsList[0].channelId : null)
    }
    if (!activeChannelId && channelsList.length > 0) {
      setActiveChannel(channelsList[0].channelId)
    }
    broadcastState()
    return
  }

  if (msg.type === 'channels_list') {
    channelsList = msg.channels || []
    // Keep active if still exists, else auto-select
    if (activeChannelId && !channelsList.find(c => c.channelId === activeChannelId)) {
      setActiveChannel(channelsList.length > 0 ? channelsList[0].channelId : null)
    }
    if (!activeChannelId && channelsList.length > 0) {
      setActiveChannel(channelsList[0].channelId)
    }
    broadcastState()
    return
  }

  if (msg.type === 'reply' || msg.type === 'highlight') {
    chrome.runtime.sendMessage(msg).catch(() => {})
    if (msg.type === 'highlight') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {})
        }
      })
    }
    return
  }
}

// --- Message routing from extension components ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[BG] Received message:', msg.type, 'from:', sender.tab ? `tab ${sender.tab.id}` : 'extension')

  if (msg.type === 'toggle_inspector') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {})
      }
    })
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'start_area_screenshot') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {})
      }
    })
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'capture_area_screenshot') {
    // Content script sends rect + dpr; we capture then forward to sidepanel for cropping
    const { rect, dpr } = msg
    console.log('[BG] capture_area_screenshot, rect:', rect, 'dpr:', dpr)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) {
        console.log('[BG] No active tab found')
        chrome.runtime.sendMessage({ type: 'area_screenshot_result', error: 'No active tab' }).catch(() => {})
        return
      }
      chrome.tabs.captureVisibleTab({ format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.log('[BG] captureVisibleTab error:', chrome.runtime.lastError.message)
          chrome.runtime.sendMessage({ type: 'area_screenshot_result', error: chrome.runtime.lastError.message }).catch(() => {})
          return
        }
        console.log('[BG] captureVisibleTab success, forwarding to sidepanel')
        chrome.runtime.sendMessage({ type: 'area_screenshot_result', image: dataUrl, rect, dpr }).catch(() => {})
      })
    })
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'area_screenshot_cancelled') {
    chrome.runtime.sendMessage(msg).catch(() => {})
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'capture_screenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message })
        return
      }
      sendResponse({ image: dataUrl })
    })
    return true
  }

  if (msg.type === 'element_selected') {
    chrome.runtime.sendMessage(msg).catch(() => {})
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'element_feedback' || msg.type === 'screenshot' || msg.type === 'free_message') {
    const sent = sendToChannel(msg)
    sendResponse({ ok: sent })
    return true
  }

  if (msg.type === 'get_state') {
    sendResponse({
      connected: wsConnected,
      sessionId,
      channels: channelsList,
      activeChannelId,
    })
    return true
  }

  if (msg.type === 'set_active_channel') {
    setActiveChannel(msg.channelId)
    broadcastState()
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'refresh_channels') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'get_channels' }))
    }
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'dismiss_highlight' || msg.type === 'toggle_highlights' || msg.type === 'show_single_highlight') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, msg).catch(() => {})
      }
    })
    sendResponse({ ok: true })
    return true
  }

  return false
})

// Open side panel when clicking the extension action (Chrome only)
if (chrome.sidePanel) {
  chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id })
  })
}

// --- Start ---
connectWebSocket()
