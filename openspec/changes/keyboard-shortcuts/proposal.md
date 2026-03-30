## Why

Utiliser la souris pour cliquer sur les boutons Element/Screenshot dans le composer ralentit le workflow. Des raccourcis clavier permettent de rester dans le flow sans quitter le clavier. De plus, Enter devrait envoyer le message (comme dans Slack/Discord) et Shift+Enter sauter une ligne.

## What Changes

1. **Raccourcis clavier globaux** (dans le side panel) :
   - `Ctrl+Shift+E` → active l'inspecteur DOM (équivalent du bouton Element)
   - `Ctrl+Shift+S` → active la capture de zone (équivalent du bouton Screenshot)

2. **Enter/Shift+Enter dans le textarea** :
   - `Enter` → envoie le message
   - `Shift+Enter` → insère un saut de ligne

## Capabilities

### Modified Capabilities
- `feedback-chat`: Le textarea du composer gère Enter/Shift+Enter
- `dom-inspector`: Activable via raccourci clavier
- `screenshot-capture`: Activable via raccourci clavier

## Impact

- **Side panel JS** : Ajout d'un listener keydown global + modification du handler textarea
