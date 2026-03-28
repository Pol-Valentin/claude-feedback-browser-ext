## ADDED Requirements

### Requirement: Attacher un screenshot à un feedback d'élément

Après avoir sélectionné un élément DOM, l'utilisateur MUST pouvoir attacher un screenshot du viewport visible avant d'envoyer son commentaire.

#### Scenario: Sélection d'élément puis attach screenshot
- **WHEN** l'utilisateur a sélectionné un élément et le formulaire de commentaire est visible
- **AND** l'utilisateur clique sur le bouton "Attach screenshot"
- **THEN** le content script scroll l'élément sélectionné into view
- **THEN** après un court délai (150ms), le background capture le viewport
- **THEN** une preview du screenshot apparaît dans le side panel au-dessus du champ commentaire
- **THEN** le bouton "Attach" se transforme en indicateur "Screenshot attached ✓"

#### Scenario: Envoi du feedback combiné
- **WHEN** un élément est sélectionné, un screenshot est attaché, et l'utilisateur tape un commentaire
- **AND** l'utilisateur clique "Send"
- **THEN** un message `element_feedback` est envoyé avec tous les champs du fingerprint PLUS un champ `image` contenant le screenshot en base64

#### Scenario: Envoi sans screenshot (inchangé)
- **WHEN** un élément est sélectionné mais aucun screenshot n'est attaché
- **AND** l'utilisateur clique "Send"
- **THEN** le message `element_feedback` est envoyé sans champ `image` (comportement existant)

#### Scenario: Retirer le screenshot attaché
- **WHEN** un screenshot est attaché et l'utilisateur clique sur "✕" de la preview screenshot
- **THEN** le screenshot est retiré et le bouton "Attach" réapparaît

### Requirement: Le channel sauvegarde le screenshot combiné

Le MCP channel MUST sauvegarder le screenshot en fichier PNG quand un `element_feedback` inclut un champ `image`.

#### Scenario: element_feedback avec image
- **WHEN** le channel reçoit un `element_feedback` avec un champ `image`
- **THEN** le screenshot est sauvegardé dans `/tmp/peekback/screenshots/`
- **THEN** la notification MCP inclut `image_path` dans le meta en plus des champs fingerprint habituels
- **THEN** le content de la notification mentionne le chemin du screenshot

#### Scenario: element_feedback sans image (inchangé)
- **WHEN** le channel reçoit un `element_feedback` sans champ `image`
- **THEN** le comportement est identique à l'existant (pas de sauvegarde de fichier)
