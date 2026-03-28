## ADDED Requirements

### Requirement: Chat thread bidirectionnel dans le Side Panel

Le Side Panel SHALL afficher un thread de chat montrant les messages envoyés (commentaires, screenshots) et les réponses reçues de Claude Code.

#### Scenario: Affichage d'un commentaire envoyé
- **WHEN** un element_feedback ou screenshot est envoyé
- **THEN** le message apparaît dans le chat thread avec un style "message envoyé" (aligné à droite ou visuellement distinct)

#### Scenario: Réception d'une réponse de Claude
- **WHEN** le MCP channel envoie un message `reply` via WebSocket
- **THEN** la réponse apparaît dans le chat thread avec un style "message reçu" (aligné à gauche ou visuellement distinct)
- **THEN** le contenu markdown de la réponse est rendu en HTML

#### Scenario: Chat vide
- **WHEN** aucun message n'a été échangé
- **THEN** le chat affiche un message d'accueil expliquant comment utiliser l'extension

### Requirement: Session picker

Le Side Panel SHALL afficher un sélecteur de session permettant de choisir la session Claude Code active.

#### Scenario: Une seule session connectée
- **WHEN** une seule session Claude Code est connectée via WebSocket
- **THEN** le session picker affiche cette session comme sélectionnée automatiquement

#### Scenario: Plusieurs sessions connectées
- **WHEN** plusieurs sessions Claude Code sont connectées
- **THEN** le session picker affiche la liste des sessions avec leur identifiant (cwd abrégé + début du session_id)
- **THEN** l'utilisateur peut sélectionner la session cible

#### Scenario: Aucune session connectée
- **WHEN** aucune session n'est connectée (WebSocket déconnecté ou pas de session)
- **THEN** les boutons Inspect et Screenshot sont désactivés
- **THEN** un indicateur visuel montre l'état déconnecté

### Requirement: Indicateur de connexion WebSocket

Le Side Panel SHALL afficher l'état de connexion au MCP channel.

#### Scenario: Connecté
- **WHEN** le WebSocket est connecté au MCP channel
- **THEN** un indicateur vert est affiché

#### Scenario: Déconnecté
- **WHEN** le WebSocket est déconnecté
- **THEN** un indicateur rouge est affiché
- **THEN** les actions d'envoi sont désactivées
