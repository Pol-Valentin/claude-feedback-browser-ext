## ADDED Requirements

### Requirement: Inspecteur DOM activable

L'extension SHALL fournir un mode inspecteur DOM activable/désactivable depuis le Side Panel. Quand activé, le survol d'un élément dans la page MUST afficher un overlay de highlight. Un click MUST sélectionner l'élément et désactiver le mode inspecteur.

#### Scenario: Activation de l'inspecteur
- **WHEN** l'utilisateur clique sur le bouton "Inspect" dans le Side Panel
- **THEN** le content script entre en mode inspecteur (écoute hover/click sur la page)

#### Scenario: Hover highlight
- **WHEN** l'inspecteur est actif et l'utilisateur survole un élément
- **THEN** un overlay semi-transparent MUST apparaître sur l'élément survolé
- **THEN** l'overlay MUST suivre les dimensions exactes de l'élément (via getBoundingClientRect)

#### Scenario: Sélection d'un élément
- **WHEN** l'inspecteur est actif et l'utilisateur clique sur un élément
- **THEN** l'élément est sélectionné et l'overlay reste affiché
- **THEN** le mode inspecteur se désactive automatiquement
- **THEN** le Side Panel affiche un formulaire de commentaire pré-rempli avec un résumé de l'élément

#### Scenario: Annulation de l'inspecteur
- **WHEN** l'inspecteur est actif et l'utilisateur appuie sur Escape
- **THEN** le mode inspecteur se désactive sans sélectionner d'élément

### Requirement: Fingerprint multi-signaux de l'élément sélectionné

Le content script SHALL extraire un fingerprint multi-signaux de l'élément sélectionné contenant : selector CSS unique, outerHTML (tronqué à 500 caractères), textContent (tronqué à 200 caractères), attributs clés (class, id, data-*, role, aria-*), nom du composant React/Vue (si disponible), et contexte (parent tag + previous sibling tag).

#### Scenario: Extraction du fingerprint pour un élément HTML statique
- **WHEN** un élément est sélectionné dans une page HTML statique
- **THEN** le fingerprint contient selector, outerHTML, textContent, attributes, context
- **THEN** le champ component est null

#### Scenario: Extraction du fingerprint pour un composant React
- **WHEN** un élément est sélectionné dans une page React en dev mode
- **THEN** le fingerprint contient tous les champs standard PLUS le nom du composant React extrait via `__reactFiber$`

#### Scenario: Élément avec outerHTML long
- **WHEN** l'élément sélectionné a un outerHTML de plus de 500 caractères
- **THEN** le outerHTML est tronqué à 500 caractères avec "..." à la fin

### Requirement: Envoi du commentaire avec fingerprint

L'utilisateur MUST pouvoir taper un commentaire dans le Side Panel après avoir sélectionné un élément. L'envoi MUST transmettre le fingerprint + commentaire + URL de la page au MCP channel via le Background SW.

#### Scenario: Envoi d'un commentaire sur un élément
- **WHEN** l'utilisateur a sélectionné un élément et tape un commentaire puis clique "Envoyer"
- **THEN** un message `element_feedback` est envoyé via WebSocket contenant url, selector, outerHTML, textContent, attributes, component, context, et comment
- **THEN** le commentaire apparaît dans le chat thread du Side Panel

#### Scenario: Envoi sans commentaire
- **WHEN** l'utilisateur a sélectionné un élément et clique "Envoyer" sans commentaire
- **THEN** l'envoi est bloqué et un message d'erreur s'affiche demandant un commentaire
