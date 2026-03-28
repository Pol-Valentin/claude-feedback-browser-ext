## ADDED Requirements

### Requirement: Capture de screenshot de la page visible

L'extension SHALL permettre de capturer le viewport visible de la page active et de l'envoyer à Claude Code avec un commentaire optionnel.

#### Scenario: Capture et envoi avec commentaire
- **WHEN** l'utilisateur clique sur le bouton "Screenshot" dans le Side Panel
- **THEN** le viewport visible est capturé via `chrome.tabs.captureVisibleTab()`
- **THEN** le Side Panel affiche un aperçu de la capture avec un champ de commentaire
- **WHEN** l'utilisateur tape un commentaire et clique "Envoyer"
- **THEN** un message `screenshot` est envoyé via WebSocket contenant url, image (base64 PNG), et comment

#### Scenario: Capture et envoi sans commentaire
- **WHEN** l'utilisateur clique "Envoyer" sans commentaire après une capture
- **THEN** le message `screenshot` est envoyé avec un champ comment vide (le commentaire est optionnel pour les screenshots)

#### Scenario: Capture affichée dans le chat
- **WHEN** un screenshot est envoyé
- **THEN** un message avec miniature du screenshot et le commentaire apparaît dans le chat thread du Side Panel
