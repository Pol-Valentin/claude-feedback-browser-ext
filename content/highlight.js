// --- Remote Highlight Manager ---
const highlights = new Map() // id -> { overlay, selector, label }
let highlightsEnabled = true
let highlightCounter = 0

function createHighlight(selector, label) {
  const el = document.querySelector(selector)
  if (!el) return null

  const id = `cf-hl-${++highlightCounter}`
  const rect = el.getBoundingClientRect()

  const overlay = document.createElement('div')
  overlay.className = 'cf-highlight-overlay'
  overlay.dataset.highlightId = id
  overlay.style.top = `${rect.top + window.scrollY}px`
  overlay.style.left = `${rect.left + window.scrollX}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`

  if (label) {
    const labelEl = document.createElement('span')
    labelEl.className = 'cf-highlight-label'
    labelEl.textContent = label
    overlay.appendChild(labelEl)
  }

  const dismissBtn = document.createElement('button')
  dismissBtn.className = 'cf-highlight-dismiss'
  dismissBtn.textContent = '✕'
  dismissBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    removeHighlight(id)
    // Notify side panel
    chrome.runtime.sendMessage({ type: 'highlight_dismissed', highlightId: id })
  })
  overlay.appendChild(dismissBtn)

  // Click on overlay itself also dismisses
  overlay.addEventListener('click', () => {
    removeHighlight(id)
    chrome.runtime.sendMessage({ type: 'highlight_dismissed', highlightId: id })
  })

  document.documentElement.appendChild(overlay)

  // Scroll into view
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })

  highlights.set(id, { overlay, selector, label })
  return id
}

function removeHighlight(id) {
  const hl = highlights.get(id)
  if (!hl) return
  hl.overlay.remove()
  highlights.delete(id)
}

function hideAllHighlights() {
  for (const hl of highlights.values()) {
    hl.overlay.style.display = 'none'
  }
}

function showAllHighlights() {
  for (const hl of highlights.values()) {
    hl.overlay.style.display = 'block'
  }
}

// Update highlight positions on scroll/resize
function updateHighlightPositions() {
  for (const hl of highlights.values()) {
    const el = document.querySelector(hl.selector)
    if (!el) continue
    const rect = el.getBoundingClientRect()
    hl.overlay.style.top = `${rect.top + window.scrollY}px`
    hl.overlay.style.left = `${rect.left + window.scrollX}px`
    hl.overlay.style.width = `${rect.width}px`
    hl.overlay.style.height = `${rect.height}px`
  }
}

window.addEventListener('scroll', updateHighlightPositions, { passive: true })
window.addEventListener('resize', updateHighlightPositions, { passive: true })

// --- Listen for messages ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'highlight') {
    if (!highlightsEnabled) {
      // Store but don't show — side panel will track it
      sendResponse({ highlightId: null, hidden: true })
      return true
    }
    const id = createHighlight(msg.selector, msg.label)
    sendResponse({ highlightId: id, found: !!id })
    return true
  }

  if (msg.type === 'dismiss_highlight') {
    removeHighlight(msg.highlightId)
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'toggle_highlights') {
    highlightsEnabled = msg.enabled
    if (highlightsEnabled) {
      showAllHighlights()
    } else {
      hideAllHighlights()
    }
    sendResponse({ ok: true })
    return true
  }

  if (msg.type === 'show_single_highlight') {
    const id = createHighlight(msg.selector, msg.label)
    sendResponse({ highlightId: id, found: !!id })
    return true
  }

  return false
})
