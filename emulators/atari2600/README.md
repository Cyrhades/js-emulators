# Mission : compléter mon émulateur Atari 2600

Tu es un développeur senior spécialisé en **émulation de systèmes rétro**, architecture CPU, TypeScript/JavaScript et hardware Atari 2600.

Je développe actuellement un **émulateur Atari 2600 en TypeScript/JavaScript**. Le projet contient déjà une partie du code, notamment l'émulation du CPU MOS 6502/6507.

Ton objectif est de **transformer le code existant en un émulateur Atari 2600 fonctionnel**, en utilisant au maximum l'architecture et le code déjà présents.

## Règle principale

**Ne réécris pas inutilement le code existant.**

Avant de modifier quoi que ce soit :

1. Analyse l'intégralité du projet.
2. Identifie les composants déjà implémentés.
3. Identifie les composants partiellement implémentés.
4. Identifie les composants manquants.
5. Identifie les bugs ou incohérences empêchant l'émulation correcte.
6. Comprends l'architecture existante avant de proposer des modifications.

Conserve autant que possible :

* les classes existantes ;
* les interfaces ;
* les types TypeScript ;
* les conventions de nommage ;
* les tests ;
* l'organisation du projet ;
* le fonctionnement actuel du CPU.

Si une modification importante de l'architecture est nécessaire, explique d'abord **pourquoi elle est nécessaire**.

---

# Architecture cible

L'émulateur doit progressivement aboutir à une architecture de ce type :

```text
Atari2600
│
├── CPU6507
│
├── Bus
│   ├── TIA
│   ├── RIOT6532
│   └── Cartridge
│
├── TIA
│   ├── Video
│   ├── Audio
│   └── Registers
│
├── RIOT6532
│   ├── RAM
│   ├── I/O
│   └── Timer
│
└── Cartridge
```

Le CPU doit communiquer avec les différents composants via le **bus et le memory mapping**, et non via des appels directs arbitraires.

---

# 1. CPU : MOS 6507

Le MOS 6507 est la variante utilisée dans l'Atari 2600.

Le projet contient déjà une implémentation du CPU.

Analyse-la et vérifie notamment :

* instructions ;
* addressing modes ;
* registres A, X, Y ;
* PC ;
* SP ;
* flags ;
* stack ;
* branches ;
* JMP/JSR/RTS/RTI ;
* BRK ;
* ADC/SBC ;
* comparaison ;
* instructions de transfert ;
* instructions mémoire ;
* instructions read-modify-write ;
* instructions non documentées uniquement si elles sont nécessaires ;
* gestion correcte des cycles ;
* reset ;
* IRQ/NMI si pertinent.

Corrige les erreurs existantes sans réécrire inutilement le CPU.

Attention aux erreurs TypeScript telles que :

```ts
number | undefined
```

qui doivent être traitées correctement plutôt que masquées systématiquement avec `!`.

---

# 2. Bus

Créer ou compléter une classe `Bus` responsable du memory mapping de l'Atari 2600.

Le CPU ne doit pas connaître directement le TIA, le RIOT ou la cartouche.

L'architecture doit ressembler à :

```ts
cpu.read(address)
cpu.write(address, value)
```

puis :

```text
CPU
 ↓
BUS
 ├── TIA
 ├── RIOT
 └── Cartridge
```

Implémente le décodage des adresses conformément au hardware réel de l'Atari 2600.

Documente clairement le memory map utilisé.

---

# 3. TIA

Créer ou compléter l'émulation du :

**TIA — Television Interface Adaptor**

Le TIA est le composant vidéo et audio principal de l'Atari 2600.

Ne pas implémenter un simple framebuffer moderne.

L'émulation doit respecter autant que possible le fonctionnement réel du TIA :

* scanlines ;
* cycles ;
* position horizontale ;
* synchronisation ;
* playfield ;
* Player 0 ;
* Player 1 ;
* Missile 0 ;
* Missile 1 ;
* Ball ;
* couleurs ;
* registres TIA ;
* collisions ;
* sprites ;
* réflexion du playfield ;
* tailles et copies des players/missiles ;
* VSync ;
* VBlank ;
* HMOVE ;
* WSYNC ;
* RESPx ;
* RESMx ;
* RESBL ;
* CTRLPF ;
* GRPx ;
* ENAMx ;
* ENABL ;
* COLUPx ;
* COLUBK ;
* collision registers.

L'implémentation doit être progressive.

Commence par obtenir une génération vidéo correcte d'une scanline, puis ajoute les fonctionnalités restantes.

---

# 4. RIOT 6532

Créer ou compléter l'émulation du **MOS 6532 RIOT**.

Le RIOT doit gérer :

### RAM

Implémenter les **128 octets de RAM**.

```ts
Uint8Array(128)
```

### I/O

Implémenter les ports I/O nécessaires à l'Atari 2600 :

* Port A ;
* Port B ;
* data direction registers ;
* lecture ;
* écriture ;
* switches ;
* contrôleurs.

Prévoir une API permettant au système externe de fournir l'état des contrôleurs.

Par exemple :

```ts
riot.setJoystick(...)
riot.setSwitch(...)
```

ou une abstraction équivalente adaptée à l'architecture existante.

### Timer

Implémenter le timer du RIOT :

* chargement ;
* décompte ;
* prescalers ;
* expiration ;
* flags ;
* lecture du timer ;
* comportement après expiration.

L'émulation doit être synchronisée avec les cycles CPU.

---

# 5. Cartridge

Créer une abstraction de cartouche :

```ts
interface Cartridge {
    read(address: number): number;
    write(address: number, value: number): void;
    reset(): void;
}
```

Commencer avec le format de cartouche le plus simple compatible avec l'Atari 2600.

Supporter au minimum :

* ROM ;
* tailles classiques ;
* chargement d'un fichier ROM ;
* reset ;
* lecture par adresse.

Ensuite prévoir une architecture extensible pour ajouter les différents systèmes de bank switching :

* F8 ;
* F6 ;
* F4 ;
* FE ;
* FA ;
* etc.

Ne pas implémenter tous les systèmes de bank switching immédiatement si ce n'est pas nécessaire.

Créer une abstraction permettant de les ajouter proprement.

---

# 6. Timing

Le timing est extrêmement important pour l'émulation Atari 2600.

Ne considère pas simplement :

```text
1 instruction CPU = 1 unité de temps
```

Il faut gérer les cycles CPU et leur relation avec :

* TIA ;
* RIOT ;
* vidéo ;
* scanlines ;
* WSYNC ;
* timers.

Construire une architecture permettant quelque chose comme :

```ts
const cycles = cpu.step();

tia.tick(cycles);
riot.tick(cycles);
```

ou une architecture équivalente plus correcte si le code existant le nécessite.

L'objectif est d'obtenir une synchronisation déterministe.

---

# 7. Audio

Prévoir une architecture permettant d'émuler l'audio du TIA.

Dans un premier temps, implémenter :

* registres audio ;
* oscillateurs ;
* fréquences ;
* volumes ;
* canaux audio.

Séparer l'émulation du hardware audio de la sortie audio réelle.

Par exemple :

```text
TIA audio state
      ↓
Audio renderer
      ↓
Web Audio API
```

Le cœur de l'émulateur ne doit pas dépendre directement du navigateur.

---

# 8. Manette / Input

Créer une abstraction des contrôleurs :

```ts
interface Controller {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    fire: boolean;
}
```

Adapter ensuite cette abstraction au RIOT.

Prévoir également les switches de la console :

* Reset ;
* Select ;
* difficulté ;
* Color/B&W.

---

# 9. Tests

Ne te contente pas d'écrire le code.

Ajoute des tests pour chaque composant.

Minimum :

### CPU

Tester :

```text
ADC
SBC
LDA
LDX
LDY
STA
STX
STY
JMP
JSR
RTS
branches
stack
flags
```

### RIOT

Tester :

```text
RAM
I/O
timer
```

### Bus

Tester :

```text
memory mapping
TIA access
RIOT access
cartridge access
```

### Cartridge

Tester :

```text
ROM loading
ROM reading
bank switching
```

### TIA

Tester progressivement :

```text
registers
scanline
playfield
players
missiles
ball
colors
collisions
```

---

# 10. Debugging

Créer un système de debug permettant notamment d'afficher :

```text
CPU
PC
A
X
Y
SP
P
cycles
scanline
horizontal position
```

Exemple :

```text
PC: 0xF123
A:  0x42
X:  0x10
Y:  0x00
SP: 0xFD
P:  0x24

Cycle: 123456
Scanline: 42
Pixel: 87
```

Cela doit permettre de diagnostiquer facilement les problèmes de synchronisation.

---

# 11. Architecture propre

Utiliser TypeScript correctement.

Éviter :

```ts
any
```

sauf nécessité exceptionnelle.

Éviter également de résoudre les erreurs TypeScript avec :

```ts
value!
```

sans justification.

Préférer :

```ts
if (value !== undefined) {
    ...
}
```

ou une architecture où le type garantit réellement la présence de la valeur.

Utiliser :

* interfaces ;
* types ;
* enums si approprié ;
* classes lorsque nécessaire ;
* `Uint8Array` pour les mémoires ;
* constantes pour les adresses ;
* fonctions petites et testables.

---

# 12. Méthode de travail obligatoire

Travaille par étapes.

Pour chaque étape :

1. Analyse le code existant.
2. Explique brièvement ce qui existe.
3. Explique ce qui manque.
4. Implémente uniquement ce qui est nécessaire.
5. Compile le projet.
6. Corrige les erreurs TypeScript.
7. Lance les tests.
8. Ajoute les tests manquants.
9. Vérifie qu'aucune fonctionnalité existante n'a été cassée.
10. Passe ensuite à l'étape suivante.

Ordre recommandé :

```text
1. Analyse du projet
       ↓
2. CPU6507
       ↓
3. Bus / Memory Mapping
       ↓
4. RIOT6532
       ↓
5. Cartridge
       ↓
6. Timing
       ↓
7. TIA
       ↓
8. Input
       ↓
9. Audio
       ↓
10. Debugger
       ↓
11. Tests ROM réelles
```

---

# 13. Critère de réussite

Le projet doit finalement pouvoir faire :

```ts
const emulator = new Atari2600();

const rom = loadRom("game.bin");

emulator.insertCartridge(rom);

emulator.reset();

while (emulator.running) {
    emulator.step();
}
```

Et permettre à terme de charger une ROM Atari 2600 réelle et de l'exécuter correctement.

Le résultat final doit être une **émulation hardware**, et non une simulation spécifique à un jeu.

Ne fais surtout pas :

```ts
if (game === "PacMan") {
    ...
}
```

Le code doit émuler le hardware générique de l'Atari 2600.

---

# Important

Lorsque tu rencontres une ambiguïté dans le code existant :

* ne supprime pas automatiquement le code ;
* ne réécris pas une classe entière sans nécessité ;
* cherche d'abord comment l'architecture actuelle fonctionne ;
* conserve les API existantes lorsque c'est raisonnable ;
* signale les incompatibilités importantes.

Lorsque tu dois faire un choix technique, privilégie :

**exactitude hardware > simplicité du code > performance**

mais évite toute complexité qui n'est pas nécessaire à l'émulation.

À chaque étape, donne-moi :

```text
ANALYSE
→ ce qui existe

MANQUE
→ ce qui doit être ajouté

MODIFICATIONS
→ fichiers/classes modifiés

IMPLÉMENTATION
→ code

TESTS
→ tests ajoutés/exécutés

ÉTAT
→ ce qui fonctionne maintenant

PROCHAINE ÉTAPE
→ ce qui doit être fait ensuite
```

Commence maintenant par **analyser le projet existant sans réécrire de code**, puis présente-moi les composants existants, les composants manquants et un plan d'implémentation adapté au code réellement présent.
