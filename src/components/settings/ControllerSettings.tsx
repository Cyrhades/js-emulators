import React, { useState, useEffect } from "react";
import { consoleRegistry } from "../../emulator/ConsoleRegistry";
import { configService, ConsoleControllerConfig } from "../../services/ConfigService";
import { ControlBinding } from "../../emulator/types";
import { Gamepad2, Keyboard, Save, Download, CheckCircle, Edit3, Cpu, Wifi } from "lucide-react";

/** Format key code for display */
function formatKey(code: string): string {
  if (!code) return "Non assignée";

  if (code.startsWith("Gamepad_Btn_")) {
    const num = parseInt(code.replace("Gamepad_Btn_", ""), 10);
    const labels: Record<number, string> = {
      0: "Manette A (0)",
      1: "Manette B (1)",
      2: "Manette X (2)",
      3: "Manette Y (3)",
      4: "Manette L1 (4)",
      5: "Manette R1 (5)",
      6: "Manette L2 (6)",
      7: "Manette R2 (7)",
      8: "Manette Select (8)",
      9: "Manette Start (9)",
      12: "Manette D-Pad Haut (12)",
      13: "Manette D-Pad Bas (13)",
      14: "Manette D-Pad Gauche (14)",
      15: "Manette D-Pad Droite (15)",
    };
    return labels[num] || `Manette Bouton ${num}`;
  }

  return code
    .replace("ArrowUp", "↑")
    .replace("ArrowDown", "↓")
    .replace("ArrowLeft", "←")
    .replace("ArrowRight", "→")
    .replace("ShiftLeft", "⇧ L")
    .replace("ShiftRight", "⇧ R")
    .replace("Space", "␣ ESPACE")
    .replace("Enter", "⏎ ENTRÉE")
    .replace("Numpad", "NUM ")
    .replace("Key", "");
}

export interface ConnectedGamepadInfo {
  index: number;
  id: string;
  buttonsCount: number;
  axesCount: number;
}

export const ControllerSettings: React.FC = () => {
  const consoles = consoleRegistry.getAllConsoles();
  const [selectedConsoleId, setSelectedConsoleId] = useState<string>(
    consoles[0]?.id || "atari2600"
  );
  const [activePlayer, setActivePlayer] = useState<number>(1);
  const [consoleConfig, setConsoleConfig] = useState<ConsoleControllerConfig>(
    configService.getConsoleConfig(selectedConsoleId)
  );

  const [connectedGamepads, setConnectedGamepads] = useState<ConnectedGamepadInfo[]>([]);
  const [remappingAction, setRemappingAction] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const selectedConsoleDef = consoleRegistry.getConsole(selectedConsoleId);
  const maxPlayers = selectedConsoleDef?.maxPlayers ?? 4;

  // Sync state when console selection changes
  useEffect(() => {
    configService.init().then(() => {
      const cfg = configService.getConsoleConfig(selectedConsoleId);
      setConsoleConfig({ ...cfg });
      if (activePlayer > (cfg.maxPlayers || maxPlayers)) {
        setActivePlayer(1);
      }
    });
  }, [selectedConsoleId]);

  // Scan physical connected gamepads — poll every 500ms to catch already-connected gamepads
  useEffect(() => {
    const scanGamepads = () => {
      const gps = navigator.getGamepads?.() || [];
      const list: ConnectedGamepadInfo[] = [];
      for (const gp of gps) {
        if (gp && gp.connected) {
          list.push({
            index: gp.index,
            id: gp.id,
            buttonsCount: gp.buttons.length,
            axesCount: gp.axes.length,
          });
        }
      }
      setConnectedGamepads(list);
    };

    scanGamepads();
    window.addEventListener("gamepadconnected", scanGamepads);
    window.addEventListener("gamepaddisconnected", scanGamepads);
    const interval = setInterval(scanGamepads, 500);

    return () => {
      window.removeEventListener("gamepadconnected", scanGamepads);
      window.removeEventListener("gamepaddisconnected", scanGamepads);
      clearInterval(interval);
    };
  }, []);

  // Interactive key & gamepad rebinding listener
  useEffect(() => {
    if (!remappingAction) return;

    document.body.dataset.disableGamepadNav = "true";

    let readyToListen = false;
    const readyTimer = setTimeout(() => {
      readyToListen = true;
    }, 150);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!readyToListen) return;
      e.preventDefault();
      e.stopPropagation();

      const code = e.code || e.key;

      if (code === "Escape") {
        setRemappingAction(null);
        return;
      }

      const newKey = code === "Backspace" || code === "Delete" ? "" : code;

      configService.updateBinding(selectedConsoleId, activePlayer, remappingAction, newKey);
      setConsoleConfig({ ...configService.getConsoleConfig(selectedConsoleId) });
      setRemappingAction(null);
    };

    let rafId: number;
    let initialButtonsState: boolean[] = [];

    const pollGamepad = () => {
      if (!readyToListen) {
        rafId = requestAnimationFrame(pollGamepad);
        return;
      }

      const gamepads = navigator.getGamepads?.() || [];
      for (const gp of gamepads) {
        if (!gp) continue;

        if (initialButtonsState.length === 0) {
          initialButtonsState = gp.buttons.map((b) => b.pressed || b.value > 0.5);
        }

        for (let i = 0; i < gp.buttons.length; i++) {
          const pressed = gp.buttons[i]?.pressed || gp.buttons[i]?.value > 0.5;
          const wasPressed = initialButtonsState[i] || false;

          if (pressed && !wasPressed) {
            const btnName = `Gamepad_Btn_${i}`;
            configService.updateBinding(selectedConsoleId, activePlayer, remappingAction, btnName);
            setConsoleConfig({ ...configService.getConsoleConfig(selectedConsoleId) });
            setRemappingAction(null);
            return;
          }
        }
      }
      rafId = requestAnimationFrame(pollGamepad);
    };

    window.addEventListener("keydown", handleKeyDown);
    rafId = requestAnimationFrame(pollGamepad);

    return () => {
      delete document.body.dataset.disableGamepadNav;
      clearTimeout(readyTimer);
      window.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(rafId);
    };
  }, [remappingAction, selectedConsoleId, activePlayer]);

  const handleClearBinding = (actionId: string) => {
    configService.updateBinding(selectedConsoleId, activePlayer, actionId, "");
    setConsoleConfig({ ...configService.getConsoleConfig(selectedConsoleId) });
    setRemappingAction(null);
  };

  const handleResetDefaults = () => {
    configService.resetConsoleDefaults(selectedConsoleId);
    setConsoleConfig({ ...configService.getConsoleConfig(selectedConsoleId) });
    setSaveSuccessMsg("Touches réinitialisées aux valeurs par défaut !");
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handlePlayerCountChange = (count: number) => {
    configService.updateConsolePlayerCount(selectedConsoleId, count);
    const updatedCfg = configService.getConsoleConfig(selectedConsoleId);
    setConsoleConfig({ ...updatedCfg });
    if (activePlayer > count) setActivePlayer(1);
  };

  const handleGamepadAssignment = (gamepadIdx: string) => {
    const idx = gamepadIdx === "none" ? null : parseInt(gamepadIdx, 10);
    configService.updatePlayerGamepadIndex(selectedConsoleId, activePlayer, idx);
    if (idx !== null) {
      configService.applyStandardGamepadBindings(selectedConsoleId, activePlayer);
    }
    setConsoleConfig({ ...configService.getConsoleConfig(selectedConsoleId) });
  };

  const handleSaveConfig = () => {
    configService.saveConfig();
    setSaveSuccessMsg("Configuration enregistrée avec succès !");
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const currentBindings: ControlBinding[] = selectedConsoleDef?.controls.bindings || [
    { id: "up", name: "Haut", defaultKey: "ArrowUp" },
    { id: "down", name: "Bas", defaultKey: "ArrowDown" },
    { id: "left", name: "Gauche", defaultKey: "ArrowLeft" },
    { id: "right", name: "Droite", defaultKey: "ArrowRight" },
    { id: "fire", name: "Tir / Fire", defaultKey: "Space" },
    { id: "reset", name: "Reset", defaultKey: "KeyR" },
    { id: "select", name: "Select", defaultKey: "KeyS" },
  ];

  const playerKeyMap = consoleConfig.players[activePlayer.toString()] || {};
  // The stored gamepadIndex value for this player — used to pre-select the right option
  const currentGamepadIndex: string = playerKeyMap.gamepadIndex ?? "none";
  // Find the label of the assigned gamepad (may not be in connectedGamepads if browser hasn't polled yet)
  const assignedGamepadLabel = currentGamepadIndex !== "none"
    ? connectedGamepads.find((gp) => gp.index.toString() === currentGamepadIndex)?.id
      ?? `Manette #${currentGamepadIndex} (déconnectée)`
    : null;

  // Build array of player count options up to maxPlayers
  const playerCountOptions = Array.from({ length: maxPlayers }, (_, i) => i + 1);

  return (
    <div className="ctrl-settings">
      {/* Console Selector & Max Players Row */}
      <div className="ctrl-console-row">
        <div className="ctrl-field">
          <label className="ctrl-label">CONSOLE</label>
          <select
            value={selectedConsoleId}
            onChange={(e) => {
              setSelectedConsoleId(e.target.value);
              setActivePlayer(1);
            }}
            className="ctrl-select"
          >
            {consoles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.maxPlayers ? `(Max: ${c.maxPlayers} joueur${c.maxPlayers > 1 ? "s" : ""})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="ctrl-field">
          <label className="ctrl-label">NOMBRE DE MANETTES (MAX: {maxPlayers})</label>
          <div className="ctrl-player-count">
            {playerCountOptions.map((num) => (
              <button
                key={num}
                className={`ctrl-count-btn ${consoleConfig.playerCount === num ? "active" : ""}`}
                onClick={() => handlePlayerCountChange(num)}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Connected Gamepads Status Panel */}
      <div className="ctrl-bindings-panel" style={{ padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase" }}>
            <Wifi size={16} color={connectedGamepads.length > 0 ? "#34d399" : "var(--text-muted)"} />
            <span>Manettes physiques connectées ({connectedGamepads.length})</span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {connectedGamepads.length > 0 ? (
              connectedGamepads.map((gp) => (
                <span
                  key={gp.index}
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    background: "rgba(52, 211, 153, 0.15)",
                    color: "#34d399",
                    border: "1px solid rgba(52, 211, 153, 0.3)",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                  }}
                >
                  Manette #{gp.index}: {gp.id.substring(0, 24)}...
                </span>
              ))
            ) : (
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Aucune manette détectée (Branchez une manette USB / Bluetooth et appuyez sur un bouton)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Player Tabs */}
      <div className="ctrl-player-tabs">
        {Array.from({ length: consoleConfig.playerCount }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            className={`ctrl-player-tab ${activePlayer === num ? "active" : ""}`}
            onClick={() => setActivePlayer(num)}
          >
            <Gamepad2 size={15} />
            <span>Joueur {num}</span>
          </button>
        ))}
      </div>

      {/* Physical Gamepad Association for Current Player */}
      <div className="ctrl-gamepad-assign-panel">
        <div className="ctrl-gamepad-assign-header">
          <Cpu size={18} color="var(--accent-cyan)" />
          <span className="ctrl-gamepad-assign-label">
            Manette physique — Joueur {activePlayer} :
          </span>
          {assignedGamepadLabel && (
            <span className="ctrl-gamepad-assigned-badge">
              {assignedGamepadLabel}
            </span>
          )}
        </div>

        <select
          value={currentGamepadIndex}
          onChange={(e) => handleGamepadAssignment(e.target.value)}
          className="ctrl-select ctrl-select-gamepad"
        >
          <option value="none">— Aucune (Clavier seul)</option>
          {connectedGamepads.map((gp) => (
            <option key={gp.index} value={gp.index.toString()}>
              Manette #{gp.index} — {gp.id}
            </option>
          ))}
          {/* Keep the stored option visible even if temporarily disconnected */}
          {currentGamepadIndex !== "none" &&
            !connectedGamepads.find((gp) => gp.index.toString() === currentGamepadIndex) && (
              <option value={currentGamepadIndex}>
                Manette #{currentGamepadIndex} (déconnectée)
              </option>
            )}
        </select>
      </div>

      {/* Bindings Grid */}
      <div className="ctrl-bindings-panel">
        <div className="ctrl-bindings-header">
          <Keyboard size={18} color="var(--accent-cyan)" />
          <span>Configuration des Touches — Joueur {activePlayer} ({selectedConsoleDef?.name})</span>
        </div>

        <div className="ctrl-bindings-grid">
          {currentBindings.map((binding) => {
            const mappedKey = playerKeyMap[binding.id] || binding.defaultKey;
            const isEditing = remappingAction === binding.id;

            return (
              <div
                key={binding.id}
                className={`ctrl-binding-row ${isEditing ? "editing" : ""}`}
              >
                <div className="ctrl-binding-info">
                  <span className="ctrl-binding-name">{binding.name}</span>
                  <span className="ctrl-binding-id">{binding.id}</span>
                </div>
                <div className="ctrl-binding-actions">
                  <kbd className={`ctrl-key ${isEditing ? "listening" : ""}`}>
                    {isEditing ? "Appuyez..." : formatKey(mappedKey)}
                  </kbd>
                  <button
                    className="ctrl-edit-btn"
                    onClick={() => setRemappingAction(binding.id)}
                    title="Remapper cette commande"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="ctrl-footer">
        {saveSuccessMsg && (
          <div className="ctrl-success">
            <CheckCircle size={16} /> {saveSuccessMsg}
          </div>
        )}
        <div className="ctrl-actions">
          <button className="ctrl-action-btn secondary" onClick={handleResetDefaults}>
            Réinitialiser par défaut
          </button>
          <button className="ctrl-action-btn secondary" onClick={() => configService.downloadJson()}>
            <Download size={15} /> Exporter controllers.json
          </button>
          <button className="ctrl-action-btn primary" onClick={handleSaveConfig}>
            <Save size={15} /> Sauvegarder la Configuration
          </button>
        </div>
      </div>

      {/* Remapping Modal */}
      {remappingAction && (
        <div className="ctrl-modal-backdrop">
          <div className="ctrl-modal">
            <div className="ctrl-modal-pulse" />
            <Keyboard size={44} color="var(--accent-cyan)" />
            <h3>Appuyez sur une touche ou un bouton</h3>
            <p>Pressez une touche du clavier ou un bouton de la manette physique pour réassigner la commande.</p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
              (Pressez Echap pour annuler, Backspace/Suppr pour effacer)
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button className="ctrl-action-btn secondary" onClick={() => handleClearBinding(remappingAction)}>
                Laisser vide (Non assignée)
              </button>
              <button className="ctrl-action-btn secondary" onClick={() => setRemappingAction(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
