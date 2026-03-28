## Context

L'extension Peekback a actuellement deux actions distinctes : inspection DOM et screenshot. On veut fusionner les deux dans un flow unique où l'utilisateur sélectionne un élément puis peut optionnellement joindre un screenshot avant d'envoyer.

## Goals / Non-Goals

**Goals :**
- Permettre d'attacher un screenshot au feedback d'élément en un clic
- Auto-scroll vers l'élément sélectionné avant la capture
- Sauvegarder le screenshot et inclure le chemin dans la notification MCP

**Non-Goals :**
- Area screenshot combiné (sélection de zone + élément) — trop complexe pour cette itération
- Modification du flow screenshot standalone (reste inchangé)

## Decisions

### D1 : Bouton "Attach screenshot" dans le formulaire post-sélection

**Choix :** Ajouter un bouton dans le comment area (à côté de Send/Cancel) qui capture le viewport visible et l'attache au feedback.

**Flow :**
1. L'utilisateur sélectionne un élément → preview apparaît dans le side panel
2. Le content script scroll l'élément into view
3. L'utilisateur clique "📸 Attach" → le background capture le viewport → preview du screenshot apparaît
4. L'utilisateur tape son commentaire et clique Send
5. Le message `element_feedback` est envoyé avec le fingerprint + image

**Rationale :** Simple, un seul clic supplémentaire. L'auto-scroll garantit que l'élément est visible dans le screenshot.

### D2 : Champ `image` optionnel dans `element_feedback`

**Choix :** Ajouter un champ `image` (base64 PNG) optionnel au message `element_feedback` existant. Pas de nouveau type de message.

**Rationale :** Backwards-compatible. Les element_feedback sans image continuent de fonctionner.

### D3 : Sauvegarde PNG côté channel

**Choix :** Même logique que pour les screenshots standalone — le channel sauvegarde en `/tmp/peekback/screenshots/` et met le chemin dans le meta de la notification.

**Rationale :** Réutilise le code existant. Claude peut lire l'image via Read tool.

## Risks / Trade-offs

- Le screenshot capture le viewport **après** scroll, donc il peut y avoir un léger décalage si la page a des animations ou du lazy loading
- Le screenshot est toujours full viewport, pas recadré sur l'élément — mais c'est suffisant car l'élément est visible après scroll
