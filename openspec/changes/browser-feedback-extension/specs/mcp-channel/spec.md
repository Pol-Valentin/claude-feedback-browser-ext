## ADDED Requirements

### Requirement: MCP Channel avec WebSocket Server

Le MCP channel SHALL être un processus TypeScript unique exposant un serveur MCP stdio (vers Claude Code) et un serveur WebSocket (vers l'extension navigateur).

#### Scenario: Démarrage du channel
- **WHEN** Claude Code lance le channel via `--mcp`
- **THEN** le serveur MCP stdio est initialisé
- **THEN** un serveur WebSocket démarre sur le port configuré (défaut 9420, configurable via `FEEDBACK_WS_PORT`)

#### Scenario: Connexion d'une extension
- **WHEN** une extension se connecte via WebSocket
- **THEN** le channel enregistre la connexion avec un identifiant de session
- **THEN** les messages de l'extension sont routés vers Claude Code via les notifications MCP

### Requirement: Tool MCP reply

Le channel SHALL exposer un outil MCP `reply(session_id, message)` permettant à Claude Code d'envoyer une réponse textuelle au Side Panel de l'extension.

#### Scenario: Envoi d'une réponse
- **WHEN** Claude Code appelle `reply(session_id, "J'ai modifié le fichier")`
- **THEN** un message `reply` est envoyé via WebSocket à l'extension avec le session_id et le message

### Requirement: Tool MCP highlight

Le channel SHALL exposer un outil MCP `highlight(session_id, selector, label?)` permettant à Claude Code de déclencher un highlight distant sur un élément DOM.

#### Scenario: Envoi d'un highlight
- **WHEN** Claude Code appelle `highlight(session_id, ".card-title", "Modifié")`
- **THEN** un message `highlight` est envoyé via WebSocket à l'extension

#### Scenario: Highlight sans label
- **WHEN** Claude Code appelle `highlight(session_id, ".card-title")`
- **THEN** un message `highlight` est envoyé avec label null

### Requirement: Notification MCP pour element_feedback

Le channel SHALL émettre une notification MCP `notifications/claude/channel` quand un `element_feedback` est reçu de l'extension, avec toutes les métadonnées du fingerprint.

#### Scenario: Réception d'un element_feedback
- **WHEN** l'extension envoie un message `element_feedback` via WebSocket
- **THEN** le channel émet une notification MCP avec le commentaire en content et les métadonnées (url, selector, outerHTML, textContent, attributes, component, context) en meta

### Requirement: Notification MCP pour screenshot

Le channel SHALL émettre une notification MCP quand un `screenshot` est reçu de l'extension.

#### Scenario: Réception d'un screenshot
- **WHEN** l'extension envoie un message `screenshot` via WebSocket
- **THEN** le channel émet une notification MCP avec le commentaire en content et l'image + url en meta

### Requirement: Gestion des sessions

Le channel SHALL maintenir un registre des sessions (extensions connectées) et supporter plusieurs connexions simultanées.

#### Scenario: Connexion subscribe
- **WHEN** une extension se connecte et envoie un message `subscribe` avec son session_id et metadata
- **THEN** la session est enregistrée dans le registre

#### Scenario: Déconnexion
- **WHEN** une connexion WebSocket se ferme
- **THEN** la session correspondante est supprimée du registre
- **THEN** Claude Code est notifié du changement de sessions (optionnel)
