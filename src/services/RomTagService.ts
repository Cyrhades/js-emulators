/**
 * RomTagService — Detects region and type tags (NTSC, PAL, NTSC-J, DEMO, PROTO, etc.)
 * from ROM filenames and console definitions.
 */

export interface RomTag {
  label: string;
  category: "region" | "type";
  color: string;
  bg: string;
  border: string;
}

export class RomTagService {
  /**
   * Detect region and type tags from ROM filename and console context
   */
  public detectTags(filename: string, consoleId?: string): RomTag[] {
    const tags: RomTag[] = [];
    const lower = (filename || "").toLowerCase();

    // --- Region Detection ---
    if (
      lower.includes("(usa)") ||
      lower.includes("(u)") ||
      lower.includes("(us)") ||
      lower.includes("(north america)")
    ) {
      tags.push({
        label: "NTSC-U",
        category: "region",
        color: "#60a5fa",
        bg: "rgba(59, 130, 246, 0.18)",
        border: "rgba(59, 130, 246, 0.4)",
      });
    } else if (
      lower.includes("(japan)") ||
      lower.includes("(j)") ||
      lower.includes("(jpn)") ||
      lower.includes("(ja)") ||
      lower.includes("famicom")
    ) {
      tags.push({
        label: consoleId === "nes" ? "FAMICOM" : "NTSC-J",
        category: "region",
        color: "#f87171",
        bg: "rgba(239, 68, 68, 0.18)",
        border: "rgba(239, 68, 68, 0.4)",
      });
    } else if (
      lower.includes("(europe)") ||
      lower.includes("(e)") ||
      lower.includes("(eur)") ||
      lower.includes("(pal)") ||
      lower.includes("(france)") ||
      lower.includes("(fr)") ||
      lower.includes("(germany)") ||
      lower.includes("(es)") ||
      lower.includes("(it)")
    ) {
      tags.push({
        label: "PAL",
        category: "region",
        color: "#c084fc",
        bg: "rgba(168, 85, 247, 0.18)",
        border: "rgba(168, 85, 247, 0.4)",
      });
    } else if (lower.includes("(world)") || lower.includes("(w)")) {
      tags.push({
        label: "WORLD",
        category: "region",
        color: "#34d399",
        bg: "rgba(16, 185, 129, 0.18)",
        border: "rgba(16, 185, 129, 0.4)",
      });
    } else {
      // Default fallback region if none matched explicitly
      tags.push({
        label: "NTSC",
        category: "region",
        color: "#38bdf8",
        bg: "rgba(14, 165, 233, 0.18)",
        border: "rgba(14, 165, 233, 0.4)",
      });
    }

    // --- Special Type / Format Detection ---
    if (lower.includes("demo") || lower.includes("rainbow")) {
      tags.push({
        label: "DEMO",
        category: "type",
        color: "#fbbf24",
        bg: "rgba(245, 158, 11, 0.18)",
        border: "rgba(245, 158, 11, 0.4)",
      });
    }

    if (lower.includes("proto") || lower.includes("beta")) {
      tags.push({
        label: "PROTO",
        category: "type",
        color: "#f472b6",
        bg: "rgba(236, 72, 153, 0.18)",
        border: "rgba(236, 72, 153, 0.4)",
      });
    }

    if (lower.includes("hack") || lower.includes("mod")) {
      tags.push({
        label: "HACK",
        category: "type",
        color: "#22d3ee",
        bg: "rgba(6, 182, 212, 0.18)",
        border: "rgba(6, 182, 212, 0.4)",
      });
    }

    if (lower.includes("[!]")) {
      tags.push({
        label: "GOOD DUMP",
        category: "type",
        color: "#4ade80",
        bg: "rgba(74, 222, 128, 0.15)",
        border: "rgba(74, 222, 128, 0.35)",
      });
    }

    return tags;
  }
}

export const romTagService = new RomTagService();
