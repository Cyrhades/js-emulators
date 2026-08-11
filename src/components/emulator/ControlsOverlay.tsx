import React from "react";
import { ControllerDefinition } from "../../emulator/types";
import { Keyboard, Gamepad } from "lucide-react";

interface ControlsOverlayProps {
  controllerDef?: ControllerDefinition;
}

export const ControlsOverlay: React.FC<ControlsOverlayProps> = ({ controllerDef }) => {
  if (!controllerDef) return null;

  return (
    <div className="glass-panel" style={{ padding: "20px", marginTop: "20px", width: "100%", maxWidth: "640px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <Keyboard size={20} color="var(--accent-secondary)" />
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700 }}>Contrôles ({controllerDef.name})</h3>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px" }}>
        {controllerDef.bindings.map((b) => (
          <div
            key={b.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              background: "rgba(255, 255, 255, 0.04)",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>{b.name}</span>
            <kbd
              style={{
                fontFamily: "var(--font-pixel)",
                fontSize: "0.65rem",
                background: "var(--accent-primary)",
                color: "#ffffff",
                padding: "4px 8px",
                borderRadius: "4px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}
            >
              {b.defaultKey
                .replace("ArrowUp", "↑")
                .replace("ArrowDown", "↓")
                .replace("ArrowLeft", "←")
                .replace("ArrowRight", "→")
                .replace("Key", "")}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
};
