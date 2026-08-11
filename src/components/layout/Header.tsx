import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Settings, Wand2 } from "lucide-react";
import { useFocus } from "../../context/FocusContext";
import { emulatorManager } from "../../emulator/EmulatorManager";
import { EmulatorSession, EmulatorStatus, CheatCode } from "../../emulator/types";
import GameGenieModal from "../gamegenie/GameGenieModal";
import { NesEmulatorAdapter } from "../../../emulators/nes/src/NesEmulatorAdapter";

export const Header: React.FC = () => {
  const location = useLocation();
  const { activeZone, headerIndex, setHeaderIndex, setActiveZone } = useFocus();

  const [session, setSession] = useState<EmulatorSession>(emulatorManager.getSession());
  const [isGameGenieOpen, setIsGameGenieOpen] = useState<boolean>(false);
  const [gameGenieCodes, setGameGenieCodes] = useState<CheatCode[]>([]);
  const [gameGenieEnabled, setGameGenieEnabled] = useState<boolean>(true);

  // Fallback NES adapter when no active emulator session is running
  const fallbackAdapter = useRef<NesEmulatorAdapter | null>(null);
  const getFallbackAdapter = () => {
    if (!fallbackAdapter.current) {
      fallbackAdapter.current = new NesEmulatorAdapter();
    }
    return fallbackAdapter.current;
  };

  useEffect(() => {
    const unsubscribe = emulatorManager.subscribe(setSession);
    return () => unsubscribe();
  }, []);

  const isHeaderZone = activeZone === "header";

  const isPlayPage = location.pathname.startsWith("/play");
  const isConsolePage = location.pathname.startsWith("/console");

  const pathParts = location.pathname.split("/").filter(Boolean);
  const pathConsoleId = isPlayPage || isConsolePage ? pathParts[1] : undefined;
  const pathGameId = isPlayPage ? pathParts[2] : undefined;

  const currentConsoleId = session.consoleDef?.id || pathConsoleId;
  const isNesSupported = currentConsoleId === "nes";
  const hasGameGenie = isNesSupported || !!session.emulator?.gameGenie;

  const getActiveGameGenie = () => {
    if (session.emulator?.gameGenie) {
      return session.emulator.gameGenie;
    }
    if (isNesSupported) {
      return getFallbackAdapter().gameGenie;
    }
    return null;
  };

  const handleOpenGameGenie = () => {
    if (session.status === EmulatorStatus.Running) {
      emulatorManager.pause();
    }
    const gg = getActiveGameGenie();
    if (gg) {
      if (pathGameId) {
        gg.setGameId?.(pathGameId);
      }
      setGameGenieEnabled(gg.isGameGenieEnabled());
      setGameGenieCodes([...gg.getGameGenieCodes()]);
    }
    setIsGameGenieOpen(true);
  };

  const handleToggleEnabled = (enabled: boolean) => {
    const gg = getActiveGameGenie();
    if (gg) {
      gg.setGameGenieEnabled(enabled);
      setGameGenieEnabled(enabled);
    }
  };

  const handleAddCode = (code: string, description: string): boolean => {
    const gg = getActiveGameGenie();
    if (!gg) return false;
    const ok = gg.addGameGenieCode(code, description);
    if (ok) {
      setGameGenieCodes([...gg.getGameGenieCodes()]);
    }
    return ok;
  };

  const handleToggleCode = (id: string, active: boolean) => {
    const gg = getActiveGameGenie();
    if (gg) {
      gg.toggleGameGenieCode(id, active);
      setGameGenieCodes([...gg.getGameGenieCodes()]);
    }
  };

  const handleDeleteCode = (id: string) => {
    const gg = getActiveGameGenie();
    if (gg) {
      gg.deleteGameGenieCode(id);
      setGameGenieCodes([...gg.getGameGenieCodes()]);
    }
  };

  const handleClearAll = () => {
    const gg = getActiveGameGenie();
    if (gg) {
      gg.clearGameGenieCodes();
      setGameGenieCodes([]);
    }
  };

  return (
    <>
      {/* Top Tagline */}
      <div className="top-tagline">
       ÉMULEZ • REDÉCOUVREZ • JOUEZ
      </div>

      {/* Pill Navigation Bar */}
      <div className={`pill-nav-container ${isHeaderZone ? "zone-focused" : ""}`}>
        <Link
          to="/consoles"
          onClick={() => {
            setActiveZone("header");
            setHeaderIndex(0);
          }}
          className={`pill-nav-item ${
            location.pathname.startsWith("/consoles") || location.pathname === "/" ? "active" : ""
          } ${isHeaderZone && headerIndex === 0 ? "focused" : ""}`}
        >
          <LayoutGrid size={16} /> MA BIBLIOTHÈQUE
        </Link>

        <Link
          to="/settings"
          onClick={() => {
            setActiveZone("header");
            setHeaderIndex(1);
          }}
          className={`pill-nav-item ${location.pathname.startsWith("/settings") ? "active" : ""} ${
            isHeaderZone && headerIndex === 1 ? "focused" : ""
          }`}
        >
          <Settings size={16} /> PARAMÈTRES
        </Link>

        {hasGameGenie && (
          <button
            id="game-genie-header-btn"
            type="button"
            onClick={() => {
              setActiveZone("header");
              setHeaderIndex(2);
              handleOpenGameGenie();
            }}
            className={`pill-nav-item ${isHeaderZone && headerIndex === 2 ? "focused" : ""}`}
            style={{ color: "#fbbf24" }}
          >
            <Wand2 size={16} /> GAME GENIE
          </button>
        )}
      </div>

      <GameGenieModal
        isOpen={isGameGenieOpen}
        onClose={() => setIsGameGenieOpen(false)}
        codes={gameGenieCodes}
        enabled={gameGenieEnabled}
        onToggleEnabled={handleToggleEnabled}
        onAddCode={handleAddCode}
        onToggleCode={handleToggleCode}
        onDeleteCode={handleDeleteCode}
        onClearAll={handleClearAll}
      />
    </>
  );
};
