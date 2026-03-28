// --- DOM Inspector ---
let inspectorActive = false
let hoveredElement = null
const overlay = document.createElement('div')
overlay.id = 'cf-inspector-overlay'
overlay.style.display = 'none'
document.documentElement.appendChild(overlay)

// --- Activate / Deactivate ---
function activateInspector() {
  inspectorActive = true
  document.addEventListener('mousemove', onMouseMove, true)
  document.addEventListener('click', onClick, true)
  document.addEventListener('keydown', onKeyDown, true)
  document.body.style.cursor = 'crosshair'
}

function deactivateInspector() {
  inspectorActive = false
  document.removeEventListener('mousemove', onMouseMove, true)
  document.removeEventListener('click', onClick, true)
  document.removeEventListener('keydown', onKeyDown, true)
  document.body.style.cursor = ''
  overlay.style.display = 'none'
  hoveredElement = null
}

// --- Mouse move: highlight hovered element ---
function onMouseMove(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY)
  if (!el || el === overlay || el.id === 'cf-inspector-overlay') return
  if (el === hoveredElement) return
  hoveredElement = el
  positionOverlay(el)
}

function positionOverlay(el) {
  const rect = el.getBoundingClientRect()
  overlay.style.display = 'block'
  overlay.style.top = `${rect.top + window.scrollY}px`
  overlay.style.left = `${rect.left + window.scrollX}px`
  overlay.style.width = `${rect.width}px`
  overlay.style.height = `${rect.height}px`
}

// --- Click: select element ---
function onClick(e) {
  e.preventDefault()
  e.stopPropagation()
  e.stopImmediatePropagation()

  const el = hoveredElement
  if (!el) return

  const fingerprint = extractFingerprint(el)
  deactivateInspector()

  // Send fingerprint to side panel via background
  console.log('[CF Inspector] Element selected:', fingerprint.selector)
  chrome.runtime.sendMessage({
    type: 'element_selected',
    fingerprint,
    url: window.location.href,
  }, (response) => {
    console.log('[CF Inspector] Send response:', response, chrome.runtime.lastError?.message)
  })
}

// --- Escape: cancel ---
function onKeyDown(e) {
  if (e.key === 'Escape') {
    deactivateInspector()
    chrome.runtime.sendMessage({ type: 'inspector_cancelled' })
  }
}

// --- Fingerprint extraction ---
function extractFingerprint(el) {
  return {
    selector: getUniqueSelector(el),
    outerHTML: truncate(el.outerHTML, 500),
    textContent: truncate(el.textContent?.trim() || '', 200),
    attributes: extractAttributes(el),
    component: getComponentName(el),
    context: {
      parentTag: describeElement(el.parentElement),
      prevSiblingTag: describeElement(el.previousElementSibling),
    },
  }
}

function getUniqueSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`

  const parts = []
  let current = el
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()

    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`)
      break
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0)
      if (classes.length > 0) {
        selector += '.' + classes.map(c => CSS.escape(c)).join('.')
      }
    }

    // Add nth-child if needed to disambiguate
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(s => s.tagName === current.tagName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-child(${index})`
      }
    }

    parts.unshift(selector)
    current = current.parentElement
  }

  return parts.join(' > ')
}

function extractAttributes(el) {
  const attrs = {}
  const keys = ['class', 'id', 'role', 'aria-label', 'aria-describedby', 'type', 'name', 'href', 'src']

  for (const key of keys) {
    const val = el.getAttribute(key)
    if (val) attrs[key] = val
  }

  // Also grab data-* attributes
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-')) {
      attrs[attr.name] = attr.value
    }
  }

  return attrs
}

function getComponentName(el) {
  // React: look for __reactFiber$ or __reactInternalInstance$
  for (const key of Object.keys(el)) {
    if (key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')) {
      try {
        let fiber = el[key]
        // Walk up to find a function/class component (not a host element)
        while (fiber) {
          if (fiber.type && typeof fiber.type === 'function') {
            return fiber.type.displayName || fiber.type.name || null
          }
          fiber = fiber.return
        }
      } catch {}
    }
  }

  // Vue: look for __vue__ or __vueParentComponent
  if (el.__vue__) {
    return el.__vue__.$options?.name || el.__vue__.$options?._componentTag || null
  }
  if (el.__vueParentComponent) {
    return el.__vueParentComponent.type?.name || el.__vueParentComponent.type?.__name || null
  }

  return null
}

function describeElement(el) {
  if (!el) return null
  let desc = el.tagName?.toLowerCase() || ''
  if (el.className && typeof el.className === 'string') {
    const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.')
    if (cls) desc += '.' + cls
  }
  return desc
}

function truncate(str, maxLen) {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

// --- Area Screenshot Selection ---
let screenshotSelectionActive = false
let screenshotOverlay = null
let screenshotSelection = null
let screenshotDimensions = null
let selStartX = 0
let selStartY = 0
let selDragging = false

function activateScreenshotSelection() {
  screenshotSelectionActive = true

  screenshotOverlay = document.createElement('div')
  screenshotOverlay.id = 'cf-screenshot-overlay'
  document.documentElement.appendChild(screenshotOverlay)

  screenshotSelection = document.createElement('div')
  screenshotSelection.id = 'cf-screenshot-selection'
  screenshotSelection.style.display = 'none'
  document.documentElement.appendChild(screenshotSelection)

  screenshotDimensions = document.createElement('div')
  screenshotDimensions.id = 'cf-screenshot-dimensions'
  screenshotDimensions.style.display = 'none'
  document.documentElement.appendChild(screenshotDimensions)

  screenshotOverlay.addEventListener('mousedown', onSelMouseDown)
  document.addEventListener('keydown', onSelKeyDown, true)
}

function deactivateScreenshotSelection() {
  screenshotSelectionActive = false
  selDragging = false
  document.removeEventListener('mousemove', onSelMouseMove, true)
  document.removeEventListener('mouseup', onSelMouseUp, true)
  document.removeEventListener('keydown', onSelKeyDown, true)
  if (screenshotOverlay) { screenshotOverlay.remove(); screenshotOverlay = null }
  if (screenshotSelection) { screenshotSelection.remove(); screenshotSelection = null }
  if (screenshotDimensions) { screenshotDimensions.remove(); screenshotDimensions = null }
}

function onSelMouseDown(e) {
  e.preventDefault()
  selStartX = e.clientX
  selStartY = e.clientY
  selDragging = true
  screenshotSelection.style.display = 'block'
  screenshotSelection.style.left = selStartX + 'px'
  screenshotSelection.style.top = selStartY + 'px'
  screenshotSelection.style.width = '0px'
  screenshotSelection.style.height = '0px'

  document.addEventListener('mousemove', onSelMouseMove, true)
  document.addEventListener('mouseup', onSelMouseUp, true)
}

function onSelMouseMove(e) {
  if (!selDragging) return
  e.preventDefault()

  const x = Math.min(e.clientX, selStartX)
  const y = Math.min(e.clientY, selStartY)
  const w = Math.abs(e.clientX - selStartX)
  const h = Math.abs(e.clientY - selStartY)

  screenshotSelection.style.left = x + 'px'
  screenshotSelection.style.top = y + 'px'
  screenshotSelection.style.width = w + 'px'
  screenshotSelection.style.height = h + 'px'

  // Show dimensions label
  screenshotDimensions.style.display = 'block'
  screenshotDimensions.textContent = `${Math.round(w)} × ${Math.round(h)}`
  screenshotDimensions.style.left = (x + w + 6) + 'px'
  screenshotDimensions.style.top = (y + h + 6) + 'px'
}

function onSelMouseUp(e) {
  if (!selDragging) return
  selDragging = false
  document.removeEventListener('mousemove', onSelMouseMove, true)
  document.removeEventListener('mouseup', onSelMouseUp, true)

  const x = Math.min(e.clientX, selStartX)
  const y = Math.min(e.clientY, selStartY)
  const w = Math.abs(e.clientX - selStartX)
  const h = Math.abs(e.clientY - selStartY)

  // Ignore tiny selections (accidental clicks)
  if (w < 5 || h < 5) {
    deactivateScreenshotSelection()
    chrome.runtime.sendMessage({ type: 'area_screenshot_cancelled' })
    return
  }

  const dpr = window.devicePixelRatio || 1

  // Remove overlay elements before capture so they don't appear in screenshot
  deactivateScreenshotSelection()

  // Small delay to let the browser repaint after removing overlay
  setTimeout(() => {
    chrome.runtime.sendMessage({
      type: 'capture_area_screenshot',
      rect: { x, y, w, h },
      dpr,
    })
  }, 150)
}

function onSelKeyDown(e) {
  if (e.key === 'Escape' && screenshotSelectionActive) {
    deactivateScreenshotSelection()
    chrome.runtime.sendMessage({ type: 'area_screenshot_cancelled' })
  }
}

// --- Listen for messages from background/side panel ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'toggle_inspector') {
    if (inspectorActive) {
      deactivateInspector()
    } else {
      activateInspector()
    }
    sendResponse({ active: inspectorActive })
    return true
  }

  if (msg.type === 'start_area_screenshot') {
    if (screenshotSelectionActive) {
      deactivateScreenshotSelection()
    } else {
      activateScreenshotSelection()
    }
    sendResponse({ ok: true })
    return true
  }

  return false
})
