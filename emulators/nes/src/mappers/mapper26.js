import Mapper24 from "./mapper24.js";

// Mapper 26: Konami VRC6b
// Used by games such as Madara and Esper Dream 2.
// Identical to Mapper 24 (VRC6a), except address lines A0 and A1 are swapped.
class Mapper26 extends Mapper24 {
  static mapperName = "VRC6b";

  constructor(nes) {
    super(nes);
    this.a0a1Swapped = true;
  }
}

export default Mapper26;
