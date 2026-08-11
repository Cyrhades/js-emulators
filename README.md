# Émulateur Rétro Web (JS-Emulators)

Plateforme d'émulation de consoles rétro développée en JavaScript et TypeScript, proposant une expérience dans le navigateur pour les consoles Nintendo NES et Atari 2600, je tenterais d'ajouter d'autres consoles plus tard.

---

## Sommaire

- [Présentation](#présentation)
- [Fonctionnalités principales](#fonctionnalités-principales)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Module Game Genie (NES)](#module-game-genie-nes)
- [Commandes et Contrôles](#commandes-et-contrôles)
- [Architecture Technique](#architecture-technique)
- [Tests et Compilation](#tests-et-compilation)

---

## Présentation

JS-Emulators est une application web moderne permettant de jouer à des jeux rétrogaming directement depuis un navigateur web.
L'émulation recherchée n'étant pas la plus réaliste possible.

### Atari 2600
Pour le moment j'ai beaucoup de mal à obtenir des émulations corrects, je continue mes recherches.


### NES

Pour la NES, je me suis basé sur le projet JSNES, que j'ai amélioré. J'ai choisi d'aller au-delà d'une simple émulation fidèle de la console lorsque cela permettait d'améliorer l'expérience de jeu.

Par exemple, j'ai optimisé la gestion de la limite d'affichage des sprites de la NES afin de réduire, voire d'éviter dans certains cas, le scintillement (sprite flickering) visible dans certains jeux. D'autres émulateurs font volontairement le choix de reproduire fidèlement cette limitation matérielle, ce qui peut entraîner ce phénomène.

L'émulation de certains jeux reste toutefois imparfaite. Des problèmes subsistent notamment avec certains mappers, dont la gestion doit encore être retravaillée et améliorée.



---

## Fonctionnalités principales

- Émulation de la console Nintendo Entertainment System (NES) et Atari 2600.
- Intégration complète du module Game Genie pour la NES (décodage et application de codes de triche en temps réel).
- Synchronisation vidéo fluide calée sur 60 FPS réels.
- Traitement sonore dynamique (AudioWorklet) avec filtres matériels.
- Interface moderne réactive adaptée à la navigation au clavier et à la manette (Gamepad API).
- Gestionnaire de bibliothèque de jeux et de sauvegardes locales.
---

## Prérequis

Pour exécuter et développer cette application localement, les outils suivants sont requis :

- Node.js (version 18.0.0 ou supérieure)
- npm (fourni avec Node.js) ou yarn

---

## Installation

1. Obtenir les sources de l'application
   ```bash
   git clone https://github.com/Cyrhades/js-emulators
   ```

2. Accéder au répertoire du projet :
   ```bash
   cd js-emulators
   ```

3. Installer les dépendances du projet :
   ```bash
   npm install
   ```

---

## Utilisation

### Lancement en mode développement

Pour démarrer le serveur de développement local avec rechargement à chaud (HMR) :

```bash
npm run dev
```

Une fois la commande exécutée, ouvrir votre navigateur et accéder à l'adresse indiquée dans le terminal.


## Module Game Genie (NES)

L'application intègre un moteur Game Genie complet pour la console NES.

### Fonctionnalités Game Genie

- Support des codes standard à 6 et 8 lettres (exemples : `AAUNYLPA`, `SZLSUV`, `YSAOPE`).
- Support des codes au format Hexadécimal et Dash (exemples : `11D9:AD`, `075A-09`).
- Prise en charge des combinaisons de plusieurs codes séparés par le symbole `+` ou des espaces (exemple : `YSAOPE + YEAOZA + YEAPYA`).
- Bascule globale de l'état d'activation des triches.
- Activation et désactivation individuelle par code.
- Sauvegarde automatique de vos codes dans le stockage local du navigateur par jeu.

---

## Commandes et Contrôles

### Clavier (Configuration par défaut)

- Flèches directionnelles : Croix directionnelle (Haut, Bas, Gauche, Droite)
- Touche Z / J : Bouton A
- Touche X / K : Bouton B
- Touche Entrée / Entrée Num. : Bouton Start
- Touche Maj (Shift) / Espace : Bouton Select

### Manettes de jeu

L'application détecte automatiquement les manettes USB et Bluetooth compatibles avec l'API Web Gamepad. Les boutons peuvent être configurés dans le menu des paramètres.

