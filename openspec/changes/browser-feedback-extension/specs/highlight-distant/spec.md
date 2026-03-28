## ADDED Requirements

### Requirement: Highlight distant déclenché par Claude

Le content script SHALL pouvoir afficher un overlay de highlight sur un élément DOM quand Claude envoie une commande `highlight` via le MCP channel.

#### Scenario: Réception d'un highlight
- **WHEN** le MCP channel envoie un message `highlight` avec un selector et un label optionnel
- **THEN** le content script trouve l'élément via `document.querySelector(selector)`
- **THEN** un overlay de highlight est affiché sur l'élément avec scroll into view
- **THEN** si un label est fourni, il est affiché à côté du highlight

#### Scenario: Élément non trouvé
- **WHEN** le selector du highlight ne correspond à aucun élément dans la page
- **THEN** le highlight est ignoré silencieusement
- **THEN** un message d'avertissement est affiché dans le chat du Side Panel

### Requirement: Dismiss unitaire de highlight

Chaque highlight distant MUST pouvoir être fermé individuellement.

#### Scenario: Dismiss via le Side Panel
- **WHEN** un highlight distant est affiché et l'utilisateur clique sur "✕" dans le message correspondant du chat
- **THEN** l'overlay de highlight est supprimé de la page

#### Scenario: Dismiss via l'overlay
- **WHEN** un highlight distant est affiché et l'utilisateur clique sur l'overlay lui-même dans la page
- **THEN** l'overlay de highlight est supprimé

### Requirement: Toggle global des highlights

Le Side Panel SHALL fournir un toggle ON/OFF global pour tous les highlights distants.

#### Scenario: Désactivation globale
- **WHEN** l'utilisateur bascule le toggle highlights sur OFF
- **THEN** tous les highlights distants actuellement affichés sont masqués
- **THEN** les nouveaux highlights reçus ne sont pas affichés (mais restent dans le chat avec le bouton "Voir")

#### Scenario: Réactivation globale
- **WHEN** l'utilisateur bascule le toggle highlights sur ON
- **THEN** les highlights distants non-dismissés individuellement sont ré-affichés

#### Scenario: Highlight reçu quand toggle est OFF
- **WHEN** le toggle highlights est OFF et un nouveau highlight est reçu
- **THEN** le message apparaît dans le chat avec un bouton "🔦 Voir dans la page"
- **THEN** l'overlay n'est PAS affiché automatiquement dans la page
