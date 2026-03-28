## 1. Content Script — Auto-scroll

- [x] 1.1 Après sélection d'un élément, scroll l'élément into view (`element.scrollIntoView({ behavior: 'smooth', block: 'center' })`) avant d'envoyer le message `element_selected`

## 2. Side Panel — UI Attach Screenshot

- [x] 2.1 Ajouter un bouton "📸 Attach" dans le `#comment-area` (entre le textarea et les boutons Send/Cancel)
- [x] 2.2 Au clic sur "Attach", envoyer `capture_screenshot` au background et afficher la preview dans un conteneur au-dessus du textarea
- [x] 2.3 Transformer le bouton en "Screenshot attached ✓" quand un screenshot est attaché
- [x] 2.4 Ajouter un bouton "✕" sur la preview pour retirer le screenshot attaché
- [x] 2.5 Au clic sur "Send", inclure le champ `image` (base64) dans le message `element_feedback` si un screenshot est attaché

## 3. Background — Passer l'image dans element_feedback

- [x] 3.1 Le handler `element_feedback` envoie déjà le message tel quel via `sendToChannel`. Aucune modification nécessaire car le champ `image` sera simplement passé avec le message.

## 4. Channel — Sauvegarder l'image combinée

- [x] 4.1 Dans `handleFeedbackFromExtension`, si un `element_feedback` contient un champ `image`, sauvegarder le screenshot en PNG dans `/tmp/peekback/screenshots/`
- [x] 4.2 Inclure `image_path` dans le meta de la notification MCP
- [x] 4.3 Ajouter une mention du chemin du screenshot dans le `content` de la notification

## 5. Chat — Affichage combiné

- [x] 5.1 Dans `addChatMessage`, si le meta contient à la fois un `selector` et une `image`, afficher la miniature du screenshot en plus du selector dans le message envoyé
