# Atari 2600


## MOS Technology 6507

Le processeur de l'Atari 2600 est le MOS Technology 6507, une version du 6502 simplifié, fonctionnant à une fréquence de 1,19 MHz dans la console. Bien que leur silicium interne soit identique, le 6507 est moins coûteux que le 6502, car son boîtier comporte moins de broches d'adressage mémoire, 13 au lieu de 16.

Le 2600 utilise un processeur 6507 qui est simplement une version à coût réduit du 6502, les deux puces sont entièrement 8 bits.


## Bus mémoire Atari 2600

Le CPU voit seulement 8 Ko.
0000-007F  TIA
0080-00FF  RIOT RAM
0280-0297  RIOT I/O
1000-1FFF  ROM cartouche


Le TIA est la puce graphique et audio de l'Atari 2600.
Son nom complet est Television Interface Adaptor.


RIOT 6532 - RIOT signifie RAM-I/O-Timer.

La puce MOS 6532 RIOT regroupe trois choses : RAM,  I/O (Input / Ouput),  Timer   

### 1. RAM
Le RIOT contient 128 octets de RAM. C'est extrêmement peu, mais c'est la RAM principale de l'Atari 2600.

### 2. I/O (Input / Ouput)

Le RIOT gère également les entrées/sorties.

Par exemple :
- joysticks
- switches de la console
- boutons
- signaux des contrôleurs

Il possède notamment deux ports :
- Port A
- Port B


### 3. Timer

Le RIOT possède également un timer programmable.

Le jeu peut demander quelque chose comme : "Compte 100 cycles"
puis le timer descend progressivement : 100 -> 99 -> 98 -> ... -> 0

Cela permet aux jeux de synchroniser certaines opérations.


L'architecture est relativement simple :

+----------------------+
| ROM (.bin)           |
+----------+-----------+
           |
           v
+----------------------+
| CPU 6507             |
+----------+-----------+
           |
   Bus mémoire
           |
  +--------+--------+
  |                 |
  v                 v
TIA              RAM (128 octets)
(graphisme       RIOT
 et son)         (RAM + timers + I/O)
Les composants à émuler

L'Atari 2600 comporte seulement quatre composants principaux :

CPU 6507 (version simplifiée du 6502)
TIA (vidéo, son, collisions)
RIOT 6532 (128 octets de RAM, minuteur, manettes)
ROM (la cartouche)

En JavaScript, on peut représenter chaque composant par une classe :

class CPU6507 {}
class TIA {}
class RIOT {}
class Atari2600 {}

L'émulateur principal coordonne ces éléments.

class Atari2600 {
    constructor(rom) {
        this.cpu = new CPU6507(this);
        this.tia = new TIA();
        this.riot = new RIOT();
        this.rom = rom;
    }

    step() {
        this.cpu.step();
    }
}
Le bus mémoire

Le processeur ne communique jamais directement avec les composants. Il lit et écrit des adresses mémoire.

Par exemple :

0000-007F -> RAM

0080-00FF -> registres TIA

0280-0297 -> RIOT

1000-1FFF -> ROM

On implémente donc deux fonctions essentielles :

read(address)

write(address, value)

Toutes les instructions du CPU passent par elles.

Le processeur

Le cœur de l'émulateur est le processeur.

Une boucle ressemble à ceci :

step() {

    const opcode = this.read(this.PC++);

    switch(opcode){

        case 0xA9:
            this.LDAImmediate();
            break;

        case 0x8D:
            this.STAAbsolute();
            break;

        ...
    }
}

Chaque instruction :

lit les opérandes,
modifie les registres,
retourne le nombre de cycles consommés.

Exemple :

LDA #$20

cycles = 2
Le TIA

C'est la partie la plus délicate.

Il faut simuler le balayage du téléviseur.

ligne 0

=====================

ligne 1

=====================

ligne 2

=====================

Le TIA avance pixel par pixel.

Une approche classique est :

tia.clock();
tia.clock();
tia.clock();

Le CPU avance beaucoup moins vite que le TIA : chaque cycle CPU correspond à 3 cycles TIA. Après chaque instruction CPU, il faut donc faire avancer le TIA du bon nombre de cycles.

Le framebuffer

Même si la console originale n'avait pas de framebuffer, un émulateur moderne en utilise un pour afficher l'image dans un <canvas>.

const frame = new Uint32Array(160 * 192);

Chaque pixel est une couleur.

Quand le TIA dessine un pixel :

frame[y * 160 + x] = color;

Puis :

ctx.putImageData(...)
Les collisions

Le TIA calcule aussi les collisions.

Par exemple :

Player 0

█████

Player 1

    █████

Le recouvrement met à jour un registre interne.

Le jeu lit ensuite ce registre pour savoir si deux objets se touchent.

Les manettes

Les événements clavier peuvent être convertis en états des joysticks :

ArrowLeft

ArrowRight

ArrowUp

Space

Le RIOT renvoie ensuite ces états quand le CPU lit les registres correspondants.

Le son

Le TIA possède deux générateurs sonores. Pour un premier prototype, il est raisonnable de ne pas implémenter le son, puis de l'ajouter avec l'API Web Audio.

L'ordre d'implémentation recommandé

Ne cherchez pas à tout faire d'un coup. Un ordre progressif fonctionne bien :

Chargeur de ROM.
Bus mémoire (read/write).
CPU 6507 avec quelques instructions (LDA, STA, JMP, JSR, RTS, ADC, SBC, etc.).
RIOT (RAM et minuteur).
TIA minimal (synchronisation et couleurs de fond).
Affichage des sprites et du playfield.
Collisions.
Son.
Optimisations et prise en charge des différents systèmes de bank switching.
Les principales difficultés

L'Atari 2600 est réputée difficile à émuler parce que :

le TIA n'a pas de mémoire vidéo : les registres doivent être mis à jour avec un timing très précis ;
les jeux exploitent souvent des comportements très spécifiques du matériel ;
de nombreuses cartouches utilisent des mécanismes de bank switching différents ;
le CPU, le TIA et le RIOT doivent rester parfaitement synchronisés.

Si vous débutez dans l'émulation, une bonne stratégie consiste à écrire d'abord un émulateur 6502 générique (plus simple à tester), puis à l'adapter au 6507 avant d'intégrer progressivement le TIA et le RIOT. Cette approche permet de valider le processeur indépendamment des subtilités de la vidéo.