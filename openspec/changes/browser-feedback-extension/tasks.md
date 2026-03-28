## 1. Project Setup

- [x] 1.1 Créer le package.json avec webextension-polyfill comme dépendance
- [x] 1.2 Créer le manifest.json Chrome (Manifest V3 avec side_panel, permissions activeTab/tabs/storage, content_scripts, background service_worker)
- [x] 1.3 Créer la structure de répertoires (background/, content/, sidepanel/, channel/, icons/)
- [x] 1.4 Créer des icônes placeholder pour l'extension (16, 48, 128px)

## 2. MCP Channel

- [x] 2.1 Implémenter le serveur MCP stdio de base (TypeScript avec @modelcontextprotocol/sdk) — initialisation, liste des tools
- [x] 2.2 Implémenter le serveur WebSocket intégré (ws sur le port configurable, gestion connexions/déconnexions)
- [x] 2.3 Implémenter le Session Manager (registre des sessions, subscribe/unsubscribe, routage par session_id)
- [x] 2.4 Implémenter le tool MCP `reply(session_id, message)` — envoie un message reply via WS à l'extension
- [x] 2.5 Implémenter le tool MCP `highlight(session_id, selector, label?)` — envoie un message highlight via WS
- [x] 2.6 Implémenter les notifications MCP pour `element_feedback` (réception WS → notification channel vers Claude Code)
- [x] 2.7 Implémenter les notifications MCP pour `screenshot` (réception WS → notification channel vers Claude Code)
- [x] 2.8 Configurer le lancement du channel via le manifest MCP (.mcp.json du projet)

## 3. Background Service Worker

- [x] 3.1 Implémenter le client WebSocket avec reconnexion automatique (backoff exponentiel 1s→30s)
- [x] 3.2 Implémenter le routing des messages entre content script, side panel, et WebSocket
- [x] 3.3 Implémenter la capture screenshot via `chrome.tabs.captureVisibleTab()` et envoi via WS
- [x] 3.4 Gérer l'état de connexion (connecté/déconnecté) et le broadcast au side panel

## 4. Content Script — DOM Inspector

- [x] 4.1 Implémenter le mode inspecteur (activation/désactivation via message du side panel)
- [x] 4.2 Implémenter le hover highlight (overlay semi-transparent qui suit getBoundingClientRect de l'élément survolé)
- [x] 4.3 Implémenter la sélection au click (capturer l'élément, désactiver l'inspecteur, envoyer le fingerprint)
- [x] 4.4 Implémenter l'extraction du fingerprint multi-signaux (selector, outerHTML tronqué, textContent, attributes, component React/Vue, context)
- [x] 4.5 Implémenter l'annulation de l'inspecteur via Escape
- [x] 4.6 Créer le CSS des overlays d'inspection (content.css)

## 5. Content Script — Highlight distant

- [x] 5.1 Implémenter la réception et affichage des highlights distants (overlay + scroll into view + label optionnel)
- [x] 5.2 Implémenter le dismiss d'un highlight via click sur l'overlay
- [x] 5.3 Implémenter le masquage/affichage global des highlights (toggle ON/OFF depuis le side panel)

## 6. Side Panel UI

- [x] 6.1 Créer le HTML de base du side panel (sidepanel.html) — structure, layout
- [x] 6.2 Implémenter le bouton Inspect (toggle l'inspecteur DOM dans le content script)
- [x] 6.3 Implémenter le bouton Screenshot (déclenche la capture et affiche un aperçu avec champ commentaire)
- [x] 6.4 Implémenter le chat thread (affichage messages envoyés + réponses Claude, rendu markdown des réponses)
- [x] 6.5 Implémenter le formulaire de commentaire post-sélection (champ texte + bouton envoi + résumé de l'élément)
- [x] 6.6 Implémenter le session picker (liste des sessions, sélection, auto-select si une seule)
- [x] 6.7 Implémenter l'indicateur de connexion WebSocket (vert/rouge)
- [x] 6.8 Implémenter le toggle global des highlights avec état persisté
- [x] 6.9 Implémenter le dismiss unitaire des highlights depuis le chat (bouton ✕ sur chaque message highlight)
- [x] 6.10 Créer les styles du side panel (sidepanel.css)

## 7. Compatibilité Firefox

- [x] 7.1 Créer le module sidebar-compat.js (abstraction Side Panel Chrome / Sidebar Firefox)
- [x] 7.2 Créer le manifest Firefox (adaptations : sidebar_action, background.scripts)
- [x] 7.3 Ajouter un script de build minimal pour générer les deux variantes (Chrome/Firefox)
