import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { consoleRegistry } from "../../emulator/ConsoleRegistry";
import { gameLibrary } from "../../emulator/GameLibrary";
import { emulatorManager } from "../../emulator/EmulatorManager";
import { inputManager } from "../../emulator/InputManager";
import { audioManager } from "../../emulator/AudioManager";
import { configService } from "../../services/ConfigService";
import { EmulatorSession, EmulatorStatus } from "../../emulator/types";
import { useConsoleWallpaper } from "../../hooks/useConsoleWallpaper";
import { EmulatorScreen } from "./EmulatorScreen";
import { EmulatorToolbar } from "./EmulatorToolbar";
import { ControlsOverlay } from "./ControlsOverlay";
import { ArrowLeft } from "lucide-react";

export const EmulatorViewPage: React.FC = () => {
  const { consoleId, gameId } = useParams<{ consoleId: string; gameId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<EmulatorSession>(emulatorManager.getSession());
  const [isMuted, setIsMuted] = useState<boolean>(audioManager.getMuted());
  const [notFound, setNotFound] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const wallpaperUrl = useConsoleWallpaper(consoleId);

  useEffect(() => {
    const unsubscribe = emulatorManager.subscribe(setSession);
    return () => unsubscribe();
  }, []);

  const loadedGameIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!consoleId || !gameId) return;

    if (loadedGameIdRef.current === gameId) {
      return;
    }

    setNotFound(false);
    let attempts = 0;
    let timer: any = null;

    const tryLoad = () => {
      const consoleDef = consoleRegistry.getConsole(consoleId);
      const gameDef = gameLibrary.getGame(gameId);

      if (consoleDef && gameDef) {
        if (loadedGameIdRef.current === gameId) {
          return true;
        }

        loadedGameIdRef.current = gameId;

        const userCfg = configService.getConsoleConfig(consoleId);
        const player1Config = userCfg?.players?.["1"];

        if (player1Config && Object.keys(player1Config).length > 0) {
          const effectiveBindings = consoleDef.controls.bindings.map((b) => ({
            ...b,
            defaultKey: player1Config[b.id] !== undefined ? player1Config[b.id] : b.defaultKey,
          }));
          inputManager.setBindings(effectiveBindings);
        } else {
          inputManager.setBindings(consoleDef.controls.bindings);
        }

        inputManager.startListening((input) => {
          emulatorManager.handleInput(input);
        });

        audioManager.resume().catch(() => {});
        emulatorManager.loadGame(consoleDef, gameDef);
        return true;
      }
      return false;
    };

    if (!tryLoad()) {
      timer = setInterval(() => {
        attempts++;
        if (tryLoad()) {
          if (timer) clearInterval(timer);
        } else if (attempts >= 20) {
          if (timer) clearInterval(timer);
          setNotFound(true);
        }
      }, 150);
    }

    return () => {
      if (timer) clearInterval(timer);
      loadedGameIdRef.current = null;
      inputManager.stopListening();
      emulatorManager.stop();
    };
  }, [consoleId, gameId]);

  const handlePlay = () => {
    audioManager.resume();
    if (session.status === EmulatorStatus.Paused) {
      emulatorManager.resume();
    } else {
      emulatorManager.start();
    }
  };

  const handlePause = () => {
    emulatorManager.pause();
  };

  const handleReset = () => {
    emulatorManager.reset();
  };

  const handleStop = () => {
    emulatorManager.stop();
    navigate(`/console/${consoleId}`);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    audioManager.setMuted(nextMute);
    setIsMuted(nextMute);
  };

  const [isColorMode, setIsColorMode] = useState<boolean>(true);

  const handleGameStart = () => {
    emulatorManager.handleInput({ buttons: { reset: true } });
    setTimeout(() => {
      emulatorManager.handleInput({ buttons: { reset: false } });
    }, 200);
  };

  const handleGameSelect = () => {
    emulatorManager.handleInput({ buttons: { select: true } });
    setTimeout(() => {
      emulatorManager.handleInput({ buttons: { select: false } });
    }, 200);
  };

  const handleToggleTvType = () => {
    const nextColor = !isColorMode;
    setIsColorMode(nextColor);
    emulatorManager.handleInput({ buttons: { tvType: !nextColor } });
  };

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  if (notFound && !session.game) {
    return (
      <div className="glass-panel" style={{ padding: "40px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
        <h2>ROM introuvable</h2>
        <p style={{ color: "var(--text-secondary)", marginTop: "12px", fontSize: "0.9rem" }}>
          Le fichier ROM n'a pas pu être chargé depuis votre dossier configuré. Assurez-vous d'avoir autorisé l'accès au dossier dans les paramètres du système.
        </p>
        <button onClick={() => navigate(`/console/${consoleId}`)} className="btn btn-primary" style={{ marginTop: "20px" }}>
          <ArrowLeft size={16} /> Retour à la bibliothèque
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Immersive Wallpaper background */}
      <div className="bg-wallpaper-container">
        {wallpaperUrl && (
          <img
            src={wallpaperUrl}
            alt="Wallpaper"
            className="bg-wallpaper-image"
          />
        )}
        <div className="bg-wallpaper-overlay" />
      </div>

      <div style={{ width: "100%", maxWidth: "800px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <button onClick={() => navigate(`/console/${consoleId}`)} className="btn btn-secondary">
          <ArrowLeft size={16} /> Bibliothèque de jeux
        </button>

        <div style={{ textAlign: "right" }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>{session.game?.name || "Émulation"}</h2>
          <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
            {session.consoleDef?.name}
          </span>
        </div>
      </div>

      <div ref={containerRef} className="emulator-stage">
        <EmulatorScreen
          emulator={session.emulator}
          status={session.status}
          error={session.error}
          onScreenClick={handlePlay}
        />

        <EmulatorToolbar
          status={session.status}
          consoleId={consoleId}
          onPlay={handlePlay}
          onPause={handlePause}
          onReset={handleReset}
          onStop={handleStop}
          onFullscreen={handleFullscreen}
          onToggleMute={handleToggleMute}
          isMuted={isMuted}
          onGameStart={handleGameStart}
          onGameSelect={handleGameSelect}
          onToggleTvType={handleToggleTvType}
          isColorMode={isColorMode}
        />
      </div>

      <ControlsOverlay controllerDef={session.consoleDef?.controls} />
    </div>
  );
};
