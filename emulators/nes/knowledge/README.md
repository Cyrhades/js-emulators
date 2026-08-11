# Architecture & Émulation de la NES

## Ricoh 2A03 / 2A07 (Le CPU)

Le processeur de la NES est un **Ricoh 2A03** pour les consoles NTSC et un **Ricoh 2A07** pour les consoles PAL.

Il est basé sur l'architecture du **MOS Technology 6502** (comme le processeur de l'Atari 2600), mais il s'agit d'une version personnalisée par Ricoh pour Nintendo.

Le processeur est entièrement **8 bits** et fonctionne à environ :
* **1,79 MHz** sur NES NTSC
* **1,66 MHz** sur NES PAL

Le 2A03/2A07 intègre également une partie importante du système audio de la NES : l'**APU** (*Audio Processing Unit*).

> [!NOTE]
> **Différence majeure avec un 6502 classique :** Certaines instructions du 6502 ont été supprimées, notamment les instructions **BCD** (*Binary Coded Decimal*). On peut donc considérer le processeur NES comme un 6502 fortement personnalisé.

---

## Bus Mémoire CPU

Le CPU dispose d'un espace d'adressage de **64 Ko** (`0000` - `FFFF`), réparti entre plusieurs composants :

| Plage d'adresses | Composant associé |
| :--- | :--- |
| `0000 - 07FF` | RAM interne CPU (2 Ko) |
| `0800 - 1FFF` | Miroirs de la RAM (3 répliques) |
| `2000 - 2007` | Registres PPU |
| `2008 - 3FFF` | Miroirs des registres PPU |
| `4000 - 4017` | APU + Contrôleurs (Manettes) |
| `4018 - 401F` | Zone normalement inutilisée |
| `4020 - FFFF` | Cartouche / Mapper |

### Le Système de Mirroring RAM
La RAM interne de la NES ne fait que 2 Ko (`0000-07FF`). Cependant, elle est visible **4 fois** dans le bus mémoire grâce au système de *mirroring* :

* `0000 - 07FF` : RAM physique (2 Ko)
* `0800 - 0FFF` : Miroir 1
* `1000 - 17FF` : Miroir 2
* `1800 - 1FFF` : Miroir 3

---

## La PPU (Picture Processing Unit)

La PPU est le processeur graphique de la NES. Elle est basée sur la puce **Ricoh RP2C02** en NTSC (et des variantes pour les consoles PAL).

Contrairement à l'Atari 2600, la NES possède une véritable architecture graphique structurée avec :
* Tiles
* Nametables
* Attribute Tables
* Palettes
* Sprites
* VRAM
* Système de scrolling

La PPU génère une image finale de **256 × 240 pixels** *(certaines zones de bordure peuvent varier selon le système vidéo).*

---

## Les Composants de la PPU & Le Bus PPU

La PPU possède son propre espace d'adressage allant de `0000` à `3FFF`, **totalement indépendant** du bus mémoire du CPU.

```
0000 - 0FFF ─── Pattern Table 0 ───┐
1000 - 1FFF ─── Pattern Table 1 ───┴── CHR-ROM / CHR-RAM (Cartouche)

2000 - 23FF ─── Nametable 0 ───────┐
2400 - 27FF ─── Nametable 1 ───────┼── Disposition des écrans
2800 - 2BFF ─── Nametable 2 ───────┤   (VRAM)
2C00 - 2FFF ─── Nametable 3 ───────┘

3000 - 3EFF ─── Miroir des Nametables
3F00 - 3F1F ─── Palettes de couleurs
3F20 - 3FFF ─── Miroirs des Palettes
```

### Strates de Rendu Graphique
Pour former un pixel final à l'écran, la PPU traverse plusieurs niveaux d'information :

Tile ──> Pattern Table ──> Nametable ──> Attribute Table ──> Palette ──> Pixel

* **Pattern Tables :** Contiennent le dessin matriciel brut des tiles et des sprites.
* **Nametables :** Cartographient l'écran en indiquant les indices des tiles à afficher.
* **Attribute Tables :** Définissent les palettes de couleurs associées aux différentes zones de l'écran.

---

## Les Sprites & l'OAM

Les sprites sont gérés indépendamment du fond (*background*). Leurs données sont stockées dans une mémoire interne dédiée appelée **OAM** (*Object Attribute Memory*).

Chaque sprite est défini sur **4 octets** :
1. Position **Y**
2. Indice de la **Tile**
3. **Attributs** (couleur, priorité, flip horizontal/vertical)
4. Position **X**

La NES peut stocker **64 sprites** au total dans son OAM.

> [!WARNING]
> **Limitation matérielle :** La PPU ne peut afficher au maximum que **8 sprites par ligne de balayage** (*scanline*). Au-delà, les sprites en trop ne sont pas affichés, ce qui provoque le phénomène bien connu de **flickering** (clignotement).

---

## Schéma Architectural Général

```
                    +----------------+
                    |      CPU       |
                    |  Ricoh 2A03    |
                    +-------+--------+
                            |
                     CPU Memory Bus
                            |
       +--------------------+--------------------+
       |                    |                    |
       v                    v                    v
     RAM                   PPU                  APU
    2 Ko               registres + son
       |                    |
       |                    v
       |                   VRAM
       |                    |
       |                    v
       |                   OAM
       |
       +----------------------------------+
                                          |
                                          v
                                      Cartridge
                                      + Mapper
```

---

## L'APU (Audio Processing Unit)

Intégrée au processeur Ricoh, l'APU génère le son sur **5 canaux indépendants** :

* **Pulse 1 & Pulse 2 :** Ondes carrées utilisées pour les mélodies principales et effets sonores.
* **Triangle :** Onde triangulaire, principalement utilisée pour la basse.
* **Noise :** Générateur de bruit blanc pour les percussions et tirs.
* **DMC** (*Delta Modulation Channel*) : Joue des échantillons audio (*samples*) compressés.

*(Pour un premier émulateur, le son peut être mis de côté et ajouté plus tard via la **Web Audio API**).*

---

## Les Contrôleurs

Le CPU communique avec les manettes via les registres `$4016` et `$4017`. Le jeu effectue une opération de *latch*, puis lit l'état des boutons de manière séquentielle dans cet ordre précis :

A ──> B ──> Select ──> Start ──> Up ──> Down ──> Left ──> Right

### Mapping Clavier pour Émulateur (Exemple)
| Bouton NES | Touche Clavier |
| :--- | :--- |
| **A** | `Z` |
| **B** | `X` |
| **Start** | `Entrée` |
| **Select** | `Maj` |
| **D-Pad** | `Flèches Directionnelles` |

---

## La Cartouche et les Mappers

La cartouche NES est un composant complexe contenant :
* **PRG-ROM** (Code du jeu)
* **CHR-ROM** ou **CHR-RAM** (Graphismes)
* **Mapper** (Circuit intégré spécialisé)
* **RAM supplémentaire** *(optionnelle, parfois sauvegardée par pile)*

### Le rôle du Mapper
Le **Mapper** étend les capacités de la console en assurant :
1. La commutation de banques ROM (*Bank Switching*) pour dépasser la limite des 64 Ko d'adressage du CPU.
2. La commutation de banques CHR pour les graphismes.
3. La gestion des interruptions matérielles (**IRQ**).
4. Le contrôle dynamique du *mirroring* vidéo.

**Mappers fréquents :** `NROM` (aucun mapper), `MMC1`, `UxROM`, `CNROM`, `MMC3`.

### Configurations de Mirroring vidéo
* **Horizontal**
* **Vertical**
* **Single Screen**
* **Four Screen**

---

## Timings et Synchronisation CPU / PPU

Le timing est crucial : la PPU cadense beaucoup plus vite que le CPU.

Sur un système NTSC :
1 cycle CPU = 3 cycles PPU

* **1 Scanline** = 341 cycles PPU
* **1 Frame NTSC** = 262 scanlines

```
CPU
 │
 ├── instruction
 │
 ├── 2 cycles CPU
 │
 └── 3 × 2 = 6 cycles PPU
             │
             ├── pixel 1
             ├── pixel 2
             ├── pixel 3
             └── ...
```

---

## Fonctionnement d'une Frame & Framebuffer

L'émulateur reconstruit l'image dans un **framebuffer** virtuel de 256 × 240 qu'il envoie ensuite à l'élément HTML `<canvas>`.

```javascript
const frame = new Uint32Array(256 * 240);
frame[y * 256 + x] = color;
ctx.putImageData(...);
```

### Déroulement d'une Frame

```
            FRAME
              │
              ▼
    +-------------------+
    |    Scanline 0     |
    +-------------------+
              │
              ▼
    +-------------------+
    |    Scanline 1     |
    +-------------------+
              │
              ▼
             ...
              │
              ▼
    +-------------------+
    |   Scanline 239    |
    +-------------------+
              │
              ▼
    +-------------------+
    |      VBlank       |  <── Interruption NMI déclenchée
    +-------------------+
              │
              ▼
       FRAME SUIVANTE
```

> [!TIP]
> Pendant le **VBlank**, la PPU n'affiche rien à l'écran. C'est la période critique où le jeu met à jour l'OAM (sprites), le scrolling et la VRAM via la NMI.

---

## Émulation du CPU (Ricoh 2A03)

### Registres CPU
* `A` : Accumulateur
* `X` & `Y` : Registres d'index
* `PC` : Program Counter
* `SP` : Stack Pointer
* `P` : Processor Status (Flags : `N`, `V`, `D`, `I`, `Z`, `C`)

### Les Interruptions
1. **RESET** (Démarrage / Redémarrage)
2. **NMI** (Non-Maskable Interrupt, déclenchée par le VBlank)
3. **IRQ** (Interrupt Request, déclenchée par les Mappers ou l'APU)

### Boucle d'instruction basique

```javascript
step() {
    const opcode = this.read(this.PC++);

    switch(opcode) {
        case 0xA9:
            this.LDAImmediate();
            break;
        case 0x8D:
            this.STAAbsolute();
            break;
        case 0x4C:
            this.JMPAbsolute();
            break;
        // ...
    }
}
```

---

## Architecture Logicielle Recommandée

### PPU et CPU Indépendants

Contrairement à l'Atari 2600 où le CPU trace "directement" les lignes, la NES requiert deux cœurs complètement séparés qui communiquent par bus.

```
                  NES
                   │
         +---------+---------+
         │                   │
         ▼                   ▼
       CPU                 PPU
    2A03/2A07           RP2C02/etc.
         │                   │
         ▼                   ▼
      CPU Bus             PPU Bus
         │                   │
    +----+----+         +----+----+
    │    │    │         │    │    │
   RAM  APU  Cart      VRAM OAM  Cart
```

### Implémentation du Bus CPU (JS)

```javascript
read(address) {
    if (address < 0x2000)
        return this.ram[address & 0x07FF]; // Mirroring RAM 2Ko

    if (address < 0x4000)
        return this.ppu.cpuRead(address & 0x0007); // Mirroring registres PPU

    if (address >= 0x4020)
        return this.mapper.cpuRead(address);
}

write(address, value) {
    if (address < 0x2000) {
        this.ram[address & 0x07FF] = value;
        return;
    }

    if (address < 0x4000) {
        this.ppu.cpuWrite(address & 0x0007, value);
        return;
    }
}
```

---

## Feuille de Route d'Implémentation Recommandée

```
 1. Chargeur de ROM iNES
 2. Composant Cartridge
 3. Mapper NROM (Mapper 0)
 4. Bus CPU
 5. CPU 6502 / 2A03 (Registres, Flags, Instructions, Timing)
 6. RAM 2 Ko
 7. PPU (Registres, VRAM, Palettes, Nametables, Pattern Tables, Rendu)
 8. VBlank + NMI
 9. Sprites + OAM
10. Contrôleurs (Manettes)
11. Scrolling
12. APU (Audio)
13. Mappers supplémentaires (MMC1, UxROM, CNROM, MMC3)
14. Tests de compatibilité
15. Optimisations
```