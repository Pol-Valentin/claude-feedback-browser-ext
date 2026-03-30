## Context

Le side panel Peekback a un Composer unifié avec des boutons Element et Screenshot. On ajoute des raccourcis clavier pour accélérer le workflow.

## Goals / Non-Goals

**Goals :** Raccourcis clavier pour Element, Screenshot, et Enter-to-send.
**Non-Goals :** Raccourcis configurables, raccourcis depuis la page (hors side panel).

## Decisions

### D1 : Ctrl+Shift+E et Ctrl+Shift+S

Choix de Ctrl+Shift car ça n'entre pas en conflit avec les raccourcis navigateur standards. E pour Element, S pour Screenshot — mnémoniques directs.

### D2 : Enter = send, Shift+Enter = newline

Pattern standard (Slack, Discord, ChatGPT). Déjà partiellement implémenté dans le code actuel mais à vérifier/corriger.
