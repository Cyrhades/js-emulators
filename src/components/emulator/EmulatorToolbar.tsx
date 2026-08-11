import React from "react";
import { EmulatorStatus } from "../../emulator/types";
import { Play, Pause, RotateCcw, Square, Maximize, Volume2, VolumeX, Tv, ListFilter, Gamepad2, Wand2 } from "lucide-react";

interface EmulatorToolbarProps {
  status: EmulatorStatus;
  consoleId?: string;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onStop: () => void;
  onFullscreen: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  onGameStart?: () => void;
  onGameSelect?: () => void;
  onToggleTvType?: () => void;
  isColorMode?: boolean;
  hasGameGenie?: boolean;
  onOpenGameGenie?: () => void;
}

export const EmulatorToolbar: React.FC<EmulatorToolbarProps> = ({
  status,
  consoleId,
  onPlay,
  onPause,
  onReset,
  onStop,
  onFullscreen,
  onToggleMute,
  isMuted,
  onGameStart,
  onGameSelect,
  onToggleTvType,
  isColorMode = true,
  hasGameGenie = false,
  onOpenGameGenie,
}) => {
  const isRunning = status === EmulatorStatus.Running;
  const isAtari = consoleId === "atari2600";

  return (
    <div className="glass-panel toolbar-container" style={{ flexWrap: "wrap", gap: "10px" }}>
      <div className="toolbar-group">
        {isRunning ? (
          <button onClick={onPause} className="btn btn-secondary" title="Pause">
            <Pause size={18} /> Pause
          </button>
        ) : (
          <button onClick={onPlay} className="btn btn-primary" title="Play">
            <Play size={18} /> Jouer
          </button>
        )}

        <button onClick={onReset} className="btn btn-secondary" title="Reset (Redémarrer)">
          <RotateCcw size={18} /> Reset
        </button>

        <button onClick={onStop} className="btn btn-secondary" title="Stop (Arrêter)">
          <Square size={18} /> Stop
        </button>
      </div>



      {isAtari && (
        <>
          <div className="toolbar-divider" />
          <div className="toolbar-group">
            <button
              onClick={onGameStart || onReset}
              className="btn btn-primary"
              style={{ backgroundColor: "#ff6b00", borderColor: "#ff8533", color: "#fff" }}
              title="Game Reset / Start Game (Touche F12 ou R)"
            >
              <Gamepad2 size={18} /> Start Game (F12)
            </button>

            <button
              onClick={onGameSelect}
              className="btn btn-secondary"
              title="Game Select (Touche F11 ou S)"
            >
              <ListFilter size={18} /> Game Select (F11)
            </button>

            <button
              onClick={onToggleTvType}
              className={`btn ${isColorMode ? "btn-secondary" : "btn-primary"}`}
              title="TV Type (Color / Noir & Blanc - Touche F2)"
            >
              <Tv size={18} /> {isColorMode ? "TV: Couleur" : "TV: N&B"}
            </button>
          </div>
        </>
      )}

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button onClick={onToggleMute} className="btn btn-secondary btn-icon" title={isMuted ? "Activer le son" : "Couper le son"}>
          {isMuted ? <VolumeX size={18} color="#ff4d4f" /> : <Volume2 size={18} />}
        </button>

        <button onClick={onFullscreen} className="btn btn-secondary btn-icon" title="Plein Écran">
          <Maximize size={18} />
        </button>
      </div>
    </div>
  );
};
