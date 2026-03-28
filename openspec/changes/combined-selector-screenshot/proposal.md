## Why

Actuellement, l'inspection d'un élément DOM et la capture de screenshot sont deux actions séparées. Quand on pointe un élément et qu'on veut montrer son contexte visuel (layout cassé, overflow, mauvaise couleur), il faut envoyer deux feedbacks distincts. Claude perd le lien entre les deux. Pouvoir envoyer les deux en même temps donne un feedback beaucoup plus riche et actionnable.

## What Changes

- Après avoir sélectionné un élément DOM via l'inspecteur, le side panel propose de **joindre un screenshot** au feedback avant envoi
- Le screenshot est automatiquement centré sur l'élément sélectionné (scroll into view + capture de la zone visible)
- Le message `element_feedback` envoyé au MCP channel inclut optionnellement un champ `image` avec le screenshot
- Le channel sauvegarde le screenshot en fichier PNG (comme pour les screenshots classiques) et inclut le chemin dans la notification MCP
- L'UI du side panel montre une preview du screenshot attaché avant envoi

## Capabilities

### New Capabilities
- `combined-feedback`: Possibilité de joindre un screenshot à un feedback d'élément DOM en un seul envoi

### Modified Capabilities
- `dom-inspector`: Le flow post-sélection propose d'attacher un screenshot
- `screenshot-capture`: La capture peut être déclenchée depuis le contexte d'un élément sélectionné (auto-scroll + capture)
- `mcp-channel`: Le message `element_feedback` accepte un champ `image` optionnel et le channel le sauvegarde en fichier

## Impact

- **Side panel** : Ajout d'un bouton "Attach screenshot" dans le formulaire post-sélection d'élément
- **Background SW** : Le handler `element_feedback` doit pouvoir inclure une image
- **Channel** : Le handler `element_feedback` doit sauvegarder l'image si présente et inclure le chemin dans la notification
- **Content script** : Scroll into view de l'élément sélectionné avant capture
