# Mission : créer une interface Web multi-consoles pour mon émulateur

Tu es un développeur senior spécialisé en **TypeScript, ReactJS, architecture frontend, émulation rétro et interfaces de jeux vidéo**.

Je possède un projet d'émulation écrit en **TypeScript/JavaScript**.

Dans un premier temps, le projet contient uniquement un émulateur **Atari 2600**, mais je souhaite construire une **interface Web générique capable d'accueillir plusieurs consoles d'émulation à l'avenir**.

L'objectif est donc de créer une architecture qui ne soit **pas spécifique à l'Atari 2600**, même si c'est la seule console disponible actuellement.

---

# Objectif

Créer une application Web permettant à l'utilisateur de :

1. démarrer l'application ;
2. voir les consoles disponibles ;
3. sélectionner une console ;
4. voir les jeux/ROM compatibles ;
5. charger une ROM ;
6. démarrer l'émulation ;
7. jouer directement dans le navigateur ;
8. mettre l'émulation en pause ;
9. reprendre ;
10. redémarrer ;
11. arrêter ;
12. afficher les contrôles ;
13. retourner à la sélection des consoles.

La première console disponible sera :

```text
Atari 2600
```

Mais l'architecture doit permettre d'ajouter ultérieurement par exemple :

```text
Atari 2600
NES
Master System
Mega Drive
Game Boy
SNES
etc.
```

**Ne pas coder une architecture spécifique à l'Atari 2600.**

---

# Stack technique

Utiliser obligatoirement :

* TypeScript
* ReactJS
* Vite
* HTML5
* CSS

Utiliser une architecture moderne React.

Privilégier :

* composants fonctionnels ;
* hooks ;
* TypeScript strict ;
* séparation claire UI / logique métier ;
* composants réutilisables ;
* interfaces/types ;
* gestion d'état propre.

Ne pas utiliser JavaScript pur lorsque TypeScript est possible.

---

# Architecture générale

L'application doit être organisée autour de trois couches principales :

```text
┌─────────────────────────────────────┐
│              React UI               │
│                                     │
│  Console Selector                   │
│  Game Library                       │
│  Emulator Screen                    │
│  Controls                            │
│  Emulator Toolbar                   │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│         Emulator Application        │
│                                     │
│  EmulatorManager                    │
│  ConsoleRegistry                    │
│  GameManager                        │
│  InputManager                       │
│  EmulatorSession                    │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│         Emulator Implementations    │
│                                     │
│  Atari2600Emulator                  │
│                                     │
│  Future:                             │
│  NES                                │
│  GameBoy                            │
│  SNES                               │
│  ...                                │
└─────────────────────────────────────┘
```

L'interface React ne doit **jamais dépendre directement d'une classe spécifique comme `Atari2600`**.

Elle doit communiquer avec une abstraction commune.

---

# 1. Interface Emulator

Créer une interface commune pour tous les émulateurs.

Par exemple :

```ts
interface Emulator {
    readonly id: string;
    readonly name: string;

    start(): void;
    pause(): void;
    resume(): void;
    reset(): void;
    stop(): void;

    loadRom(data: Uint8Array): Promise<void>;

    getVideoOutput(): VideoOutput;
    getAudioOutput(): AudioOutput;

    handleInput(input: EmulatorInput): void;
}
```

Cette interface doit être adaptée au code réel du projet.

Ne pas reprendre aveuglément cet exemple si l'architecture existante nécessite autre chose.

L'objectif est d'avoir une abstraction permettant :

```ts
Atari2600Emulator
```

aujourd'hui, puis :

```ts
NesEmulator
GameBoyEmulator
SnesEmulator
```

demain.

---

# 2. Console Registry

Créer un registre central des consoles disponibles.

Par exemple :

```ts
interface ConsoleDefinition {
    id: string;
    name: string;
    manufacturer: string;
    releaseYear?: number;

    createEmulator(): Emulator;

    supportedRomExtensions: string[];

    controls: ControllerDefinition;
}
```

Puis :

```ts
const consoleRegistry = new ConsoleRegistry();

consoleRegistry.register(atari2600Definition);
```

L'interface React pourra alors récupérer :

```ts
consoleRegistry.getAvailableConsoles();
```

et afficher automatiquement les consoles disponibles.

L'UI ne doit pas contenir :

```ts
if (console === "atari2600") {
   ...
}
```

pour gérer les fonctionnalités générales.

---

# 3. Atari 2600

Créer l'intégration de l'émulateur Atari 2600 existant.

Le code existant doit être **réutilisé**.

Ne pas recréer l'émulateur.

Créer simplement un adaptateur si nécessaire :

```text
Atari2600
    ↓
Atari2600EmulatorAdapter
    ↓
Emulator
```

L'adaptateur doit connecter :

* CPU6507 ;
* Bus ;
* TIA ;
* RIOT6532 ;
* Cartridge ;
* timing ;
* vidéo ;
* audio ;
* contrôleurs.

---

# 4. Console Selector

Créer une page permettant de sélectionner une console.

Exemple :

```text
┌─────────────────────────────────────────────┐
│              RETRO EMULATOR                 │
├─────────────────────────────────────────────┤
│                                             │
│  SELECT YOUR CONSOLE                        │
│                                             │
│  ┌─────────────────┐                        │
│  │                 │                        │
│  │   ATARI 2600    │                        │
│  │                 │                        │
│  │    Atari        │                        │
│  │                 │                        │
│  └─────────────────┘                        │
│                                             │
│  ┌─────────────────┐                        │
│  │    COMING SOON  │                        │
│  │                 │                        │
│  │      NES        │                        │
│  │                 │                        │
│  └─────────────────┘                        │
│                                             │
└─────────────────────────────────────────────┘
```

Les consoles futures peuvent être affichées comme indisponibles.

Cependant, ne crée pas de faux émulateurs pour les consoles non implémentées.

---

# 5. Game Library

Après avoir sélectionné une console, afficher les jeux disponibles.

Exemple :

```text
Atari 2600

┌─────────────────────────────────────────────┐
│ Games                                       │
├─────────────────────────────────────────────┤
│                                             │
│  My Atari Game                              │
│  Atari 2600                                 │
│                                             │
│  [ PLAY ]                                   │
│                                             │
└─────────────────────────────────────────────┘

[ Load ROM ]
```

Prévoir deux sources de ROM :

### ROM locale

L'utilisateur peut sélectionner un fichier :

```html
<input type="file">
```

### Bibliothèque

Prévoir une abstraction permettant à terme de charger des ROM depuis :

* IndexedDB ;
* stockage local ;
* serveur ;
* bibliothèque utilisateur.

Ne pas implémenter un téléchargement illégal de ROM.

---

# 6. Emulator Screen

Créer un composant React générique :

```tsx
<EmulatorScreen />
```

Il ne doit pas être nommé :

```tsx
<Atari2600Screen />
```

Le composant doit pouvoir afficher la sortie vidéo de n'importe quel émulateur compatible.

Pour l'Atari 2600, utiliser un `<canvas>` HTML5.

Architecture :

```text
Emulator
   ↓
VideoOutput
   ↓
EmulatorScreen
   ↓
Canvas
```

Le canvas doit gérer :

* résolution native ;
* scaling ;
* aspect ratio ;
* pixel perfect rendering ;
* fullscreen ;
* redimensionnement.

Éviter le lissage des pixels pour les consoles rétro.

---

# 7. Emulator Toolbar

Créer une barre de contrôle générique :

```text
┌─────────────────────────────────────────────┐
│ ▶ Play   ⏸ Pause   ↻ Reset   ⏹ Stop   ⛶    │
└─────────────────────────────────────────────┘
```

Elle doit fonctionner avec l'interface :

```ts
Emulator
```

et ne pas connaître l'Atari 2600.

---

# 8. Input System

Créer un système d'entrée générique.

Exemple :

```ts
interface EmulatorInput {
    buttons: Record<string, boolean>;
}
```

Chaque console peut définir ses propres contrôleurs.

Par exemple, Atari 2600 :

```ts
interface Atari2600Controller {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    fire: boolean;
}
```

Mais le frontend doit communiquer avec une abstraction générique.

Prévoir :

* clavier ;
* éventuellement gamepad API ;
* remapping des touches ;
* plusieurs contrôleurs à terme.

Créer un système de mapping :

```text
Keyboard
   ↓
InputManager
   ↓
EmulatorInput
   ↓
Emulator
```

---

# 9. Gamepad

Préparer le support de :

```ts
navigator.getGamepads()
```

Créer une abstraction :

```ts
GamepadInputProvider
```

Le système doit pouvoir détecter :

* connexion ;
* déconnexion ;
* boutons ;
* sticks ;
* plusieurs manettes.

Ne pas rendre le Gamepad obligatoire pour la première version.

---

# 10. Audio

Prévoir une architecture audio générique :

```text
Emulator
    ↓
AudioOutput
    ↓
AudioManager
    ↓
Web Audio API
```

L'émulateur ne doit pas manipuler directement l'interface utilisateur.

Prévoir :

* volume ;
* mute ;
* activation audio après interaction utilisateur ;
* arrêt propre lors de la pause/fermeture.

---

# 11. Emulator Session

Créer une abstraction représentant une session d'émulation.

Par exemple :

```ts
interface EmulatorSession {
    emulator: Emulator;
    console: ConsoleDefinition;
    game?: GameDefinition;

    status: EmulatorStatus;
}
```

Avec :

```ts
enum EmulatorStatus {
    Idle,
    Loading,
    Running,
    Paused,
    Stopped,
    Error
}
```

Cela permettra à React de représenter facilement l'état :

```text
Loading
Running
Paused
Stopped
Error
```

---

# 12. Routing

Utiliser un système de routing React.

Prévoir des routes similaires à :

```text
/
├── /consoles
├── /console/:consoleId
├── /console/:consoleId/games
└── /play/:consoleId/:gameId
```

L'URL doit permettre d'identifier la console et éventuellement le jeu.

Exemple :

```text
/play/atari2600/pacman
```

Même si aucun jeu n'est fourni initialement.

---

# 13. Architecture des composants React

Créer une structure similaire à :

```text
src/
│
├── app/
│   ├── App.tsx
│   ├── routes.tsx
│   └── providers/
│
├── components/
│   ├── layout/
│   ├── console/
│   ├── game/
│   ├── emulator/
│   │   ├── EmulatorScreen.tsx
│   │   ├── EmulatorToolbar.tsx
│   │   └── EmulatorControls.tsx
│   └── common/
│
├── emulator/
│   ├── Emulator.ts
│   ├── EmulatorManager.ts
│   ├── ConsoleRegistry.ts
│   ├── InputManager.ts
│   ├── AudioManager.ts
│   └── types.ts
│
├── consoles/
│   └── atari2600/
│       ├── Atari2600Emulator.ts
│       ├── Atari2600Definition.ts
│       └── ...
│
├── games/
│   ├── GameLibrary.ts
│   └── types.ts
│
├── hooks/
│
├── services/
│
├── styles/
│
└── main.tsx
```

Adapte cette structure au projet existant si celui-ci possède déjà une organisation cohérente.

---

# 14. Design

Créer une interface inspirée des consoles rétro, mais moderne.

Style souhaité :

* sombre ;
* sobre ;
* légèrement rétro ;
* responsive ;
* animations discrètes ;
* excellente lisibilité ;
* interface utilisable sur desktop et tablette.

L'écran d'émulation doit être la partie centrale de l'expérience.

Exemple :

```text
┌────────────────────────────────────────────────────┐
│ RETRO EMULATOR                                     │
├────────────────────────────────────────────────────┤
│                                                    │
│                                                    │
│                 ┌──────────────┐                   │
│                 │              │                   │
│                 │    GAME      │                   │
│                 │              │                   │
│                 │    SCREEN    │                   │
│                 │              │                   │
│                 └──────────────┘                   │
│                                                    │
│          ▶   ⏸   ↻   ⏹   ⛶                        │
│                                                    │
│  Atari 2600                         Controller     │
│                                                    │
└────────────────────────────────────────────────────┘
```

Le design doit être responsive.

---

# 15. État global

Utiliser une solution adaptée pour l'état global.

Ne pas introduire Redux uniquement par habitude.

Si l'application reste suffisamment petite, React Context + hooks peut être utilisé.

Séparer clairement :

```text
UI State
        ≠
Emulator State
```

Le CPU, la RAM, le TIA, etc. ne doivent pas être stockés dans le state React.

L'émulateur doit rester dans une couche indépendante de React.

React doit uniquement observer son état nécessaire à l'interface.

---

# 16. Performance

L'émulation ne doit pas provoquer de re-render React à chaque cycle CPU.

**Ne jamais faire :**

```ts
setState(cpuState)
```

à chaque cycle.

L'émulateur doit fonctionner indépendamment du cycle de rendu React.

Utiliser éventuellement :

```text
requestAnimationFrame
```

pour synchroniser l'affichage vidéo.

L'émulation et l'UI doivent être découplées.

Si nécessaire, prévoir à terme :

```text
Main Thread
 ├── React UI
 └── Emulator

Future:
Web Worker
 └── Emulator
```

L'architecture doit permettre de déplacer l'émulateur dans un Web Worker ultérieurement.

---

# 17. Web Worker

Ne pas obligatoirement implémenter le Web Worker dans la première version.

Mais concevoir les interfaces de manière à ce qu'un futur :

```ts
EmulatorWorker
```

puisse remplacer :

```ts
LocalEmulator
```

sans modifier toute l'interface React.

---

# 18. Gestion des erreurs

Prévoir une gestion propre des erreurs :

```text
ROM incompatible
ROM invalide
Console inconnue
Erreur d'initialisation
Erreur audio
Erreur vidéo
Erreur émulateur
```

Afficher des messages compréhensibles à l'utilisateur.

Ne jamais laisser une exception silencieuse casser toute l'application.

---

# 19. Tests

Ajouter des tests pour :

### ConsoleRegistry

```text
register
unregister
get
list
```

### EmulatorManager

```text
start
pause
resume
stop
reset
```

### GameLibrary

```text
load
list
remove
```

### InputManager

Tester les mappings clavier.

### Atari2600 adapter

Vérifier que l'émulateur Atari 2600 respecte l'interface générique.

### React

Tester au minimum :

* affichage des consoles ;
* sélection d'une console ;
* chargement d'une ROM ;
* affichage de l'écran ;
* boutons Play/Pause/Reset/Stop.

---

# 20. Extensibilité obligatoire

L'ajout d'une nouvelle console doit idéalement ressembler à :

```ts
consoleRegistry.register(nesDefinition);
```

et non nécessiter de modifier :

```text
App.tsx
EmulatorScreen.tsx
EmulatorToolbar.tsx
InputManager.ts
GameLibrary.ts
```

Exemple futur :

```text
consoles/
├── atari2600/
│   └── Atari2600Definition.ts
│
├── nes/
│   └── NesDefinition.ts
│
└── gameboy/
    └── GameBoyDefinition.ts
```

L'interface doit découvrir automatiquement les consoles enregistrées.

---

# 21. Séparation stricte

Respecter cette règle :

```text
React
  ↓
Application services
  ↓
Emulator abstraction
  ↓
Console implementation
```

Une console ne doit jamais importer un composant React.

Par exemple, ceci est interdit :

```ts
// Atari2600.ts
import React from "react";
```

L'émulateur doit pouvoir fonctionner sans navigateur/React si nécessaire.

---

# 22. Ce qu'il ne faut PAS faire

Ne pas créer :

```ts
if (console === "atari2600") ...
```

dans toute l'application.

Ne pas mettre le CPU dans React state.

Ne pas faire dépendre l'émulateur de React.

Ne pas créer un composant :

```tsx
<Atari2600UI />
```

pour les fonctionnalités génériques.

Ne pas mélanger :

```text
CPU
TIA
RIOT
React
Canvas
Keyboard
```

dans une même classe.

Ne pas réécrire l'émulateur Atari 2600 existant.

---

# 23. Première phase de développement

Avant de coder :

1. Analyse le projet existant.
2. Analyse l'émulateur Atari 2600 existant.
3. Identifie comment l'émulateur peut être exposé derrière une interface générique.
4. Analyse la structure actuelle du frontend, s'il existe déjà.
5. Propose l'architecture finale.
6. Identifie les fichiers à créer/modifier.
7. Vérifie les dépendances existantes.
8. Ne réécris rien inutilement.

Puis implémente progressivement.

---

# 24. Ordre d'implémentation

Utilise cet ordre :

```text
1. Analyse du projet
        ↓
2. Architecture Emulator
        ↓
3. ConsoleRegistry
        ↓
4. Atari2600 adapter
        ↓
5. EmulatorManager
        ↓
6. React application shell
        ↓
7. Console selector
        ↓
8. Game library
        ↓
9. ROM loader
        ↓
10. EmulatorScreen
        ↓
11. Emulator toolbar
        ↓
12. Keyboard input
        ↓
13. Audio
        ↓
14. Gamepad
        ↓
15. Routing
        ↓
16. Tests
        ↓
17. Optimisation
```

---

# 25. Résultat attendu

À la fin de la première version, l'utilisateur doit pouvoir :

```text
Ouvrir l'application
      ↓
Voir Atari 2600
      ↓
Sélectionner Atari 2600
      ↓
Charger une ROM
      ↓
Voir le jeu sur Canvas
      ↓
Jouer au clavier
      ↓
Pause
      ↓
Resume
      ↓
Reset
      ↓
Fullscreen
      ↓
Retour au menu
```

Et surtout, l'architecture doit déjà être prête pour :

```text
Atari 2600
    +
NES
    +
Game Boy
    +
SNES
    +
...
```

sans devoir refaire l'application React.

---

# Méthode de travail

À chaque étape, réponds avec :

```text
ANALYSE
→ état actuel du projet

ARCHITECTURE
→ architecture proposée

FICHIERS
→ fichiers créés/modifiés

CODE
→ implémentation

TESTS
→ tests ajoutés/exécutés

VALIDATION
→ ce qui fonctionne

PROCHAINE ÉTAPE
→ prochaine tâche
```

**Commence par analyser le projet existant. Ne génère aucun nouveau code avant cette analyse.**

Ton premier objectif est de comprendre l'architecture actuelle et de proposer la meilleure manière d'intégrer l'interface React multi-consoles sans casser l'émulateur Atari 2600 existant.
