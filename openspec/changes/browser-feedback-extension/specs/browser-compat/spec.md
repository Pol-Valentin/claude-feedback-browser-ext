## ADDED Requirements

### Requirement: Compatibilité Chrome et Firefox via polyfill

L'extension SHALL utiliser webextension-polyfill pour unifier les APIs et fonctionner sur Chrome et Firefox avec le même code source.

#### Scenario: APIs Chrome utilisées via le polyfill
- **WHEN** le code utilise des APIs comme `chrome.runtime.sendMessage`, `chrome.tabs.captureVisibleTab`, `chrome.storage.local`
- **THEN** ces appels passent par le polyfill `browser.*` qui fonctionne sur les deux navigateurs

### Requirement: Abstraction Side Panel / Sidebar

L'extension SHALL fournir un module `sidebar-compat.js` qui abstrait la différence entre Chrome Side Panel (`chrome.sidePanel`) et Firefox Sidebar (`browser.sidebarAction`).

#### Scenario: Ouverture du panel sur Chrome
- **WHEN** l'extension tourne sur Chrome
- **THEN** le Side Panel est enregistré via `chrome.sidePanel.setOptions()` et ouvert via l'action de l'extension

#### Scenario: Ouverture du panel sur Firefox
- **WHEN** l'extension tourne sur Firefox
- **THEN** la sidebar est enregistrée via `browser.sidebarAction` dans le manifest et ouverte via l'action de l'extension

### Requirement: Manifests par navigateur

Le projet SHALL maintenir les manifests nécessaires pour supporter les deux navigateurs.

#### Scenario: Build Chrome
- **WHEN** on construit pour Chrome
- **THEN** le manifest.json contient `"side_panel"` et `"background": {"service_worker": "..."}`

#### Scenario: Build Firefox
- **WHEN** on construit pour Firefox
- **THEN** le manifest.json contient `"sidebar_action"` et `"background": {"scripts": ["..."]}` avec les adaptations Firefox MV3
