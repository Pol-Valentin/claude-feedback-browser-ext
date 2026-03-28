// Sidebar compatibility layer: Chrome Side Panel vs Firefox Sidebar Action
// Chrome: chrome.sidePanel API (MV3, Chrome 114+)
// Firefox: browser.sidebarAction API

const isFirefox = typeof browser !== 'undefined' && browser.runtime?.getBrowserInfo

export function openSidePanel(tabId) {
  if (isFirefox) {
    // Firefox: sidebar is toggled via sidebarAction
    browser.sidebarAction.open()
  } else {
    // Chrome: use sidePanel API
    chrome.sidePanel.open({ tabId })
  }
}

export function setupActionClick() {
  if (isFirefox) {
    // Firefox: clicking the action toggles the sidebar
    browser.browserAction.onClicked.addListener(() => {
      browser.sidebarAction.toggle()
    })
  } else {
    // Chrome: clicking the action opens the side panel
    chrome.action.onClicked.addListener((tab) => {
      chrome.sidePanel.open({ tabId: tab.id })
    })
  }
}
