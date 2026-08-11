import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { consoleRegistry } from "../../emulator/ConsoleRegistry";
import { gameLibrary } from "../../emulator/GameLibrary";
import { gameDatabaseService, IgdbGameMetadata } from "../../services/GameDatabaseService";
import { igdbApiService } from "../../services/IgdbApiService";
import { igdbConfigService } from "../../services/IgdbConfigService";
import { romTagService } from "../../services/RomTagService";
import { ConsoleDefinition, GameDefinition } from "../../emulator/types";
import { ConsoleCarousel } from "./ConsoleCarousel";
import { AtariCartridgeViewer } from "./AtariCartridgeViewer";
import { Gamepad2, Star } from "lucide-react";
import { useConsoleWallpaper } from "../../hooks/useConsoleWallpaper";
import { useFocus } from "../../context/FocusContext";

export const ConsoleSelector: React.FC = () => {
  const navigate = useNavigate();
  const consoles = consoleRegistry.getAllConsoles();

  const { activeZone, setActiveZone, previewIndex, setPreviewIndex } = useFocus();

  const [, setGameListTick] = useState(0);

  const [activeConsole, setActiveConsole] = useState<ConsoleDefinition>(() => {
    const savedId = localStorage.getItem("last_selected_console_id");
    if (savedId && consoles.length > 0) {
      const found = consoles.find((c) => c.id === savedId);
      if (found) return found;
    }
    return consoles[0] || {};
  });

  const [metadataMap, setMetadataMap] = useState<Record<string, IgdbGameMetadata>>({});

  // Subscribe to reactive GameLibrary updates (e.g. when startup ROM scan finishes)
  useEffect(() => {
    const unsubscribe = gameLibrary.subscribe(() => {
      setGameListTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const gamesForActiveConsole = activeConsole
    ? gameLibrary.getGamesForConsole(activeConsole.id)
    : [];

  const [hoveredGameIndex, setHoveredGameIndex] = useState<number | null>(null);

  const activeGameIdx = hoveredGameIndex !== null ? hoveredGameIndex : previewIndex;
  const activeGameDef = gamesForActiveConsole[activeGameIdx] || gamesForActiveConsole[0];
  const activeGameMeta = activeGameDef
    ? metadataMap[activeGameDef.filename || ""] || metadataMap[activeGameDef.name.toLowerCase()]
    : undefined;
  const activeCoverUrl = activeGameMeta?.coverUrl;

  const isPreviewsZone = activeZone === "previews";

  // Load cached IGDB game metadata & fetch missing covers whenever activeConsole changes
  useEffect(() => {
    if (!activeConsole?.id) return;

    let isSubscribed = true;

    const loadMetadata = async () => {
      // 1. Load local DB cache first
      const cachedList = await gameDatabaseService.getGamesForConsole(activeConsole.id);
      const map: Record<string, IgdbGameMetadata> = {};
      cachedList.forEach((m) => {
        if (m.romFilename) map[m.romFilename] = m;
        if (m.title) map[m.title.toLowerCase()] = m;
      });

      if (isSubscribed) {
        setMetadataMap({ ...map });
      }

      // 2. Fetch missing metadata for active console games (only if IGDB API keys are configured)
      if (!igdbConfigService.isConfigured()) return;

      const games = gameLibrary.getGamesForConsole(activeConsole.id);
      let hasNewMetadata = false;
      for (const g of games) {
        const filenameKey = g.filename || "";
        const titleKey = g.name.toLowerCase();
        if (!map[filenameKey] && !map[titleKey]) {
          try {
            const meta = await igdbApiService.getOrFetchMetadata(
              g.name,
              activeConsole.id,
              g.filename || g.name
            );
            if (meta && isSubscribed) {
              if (meta.romFilename) map[meta.romFilename] = meta;
              if (meta.title) map[meta.title.toLowerCase()] = meta;
              hasNewMetadata = true;
            }
          } catch (err) {
            console.warn(`[ConsoleSelector] Cover fetch error for ${g.name}:`, err);
          }
        }
      }

      if (hasNewMetadata && isSubscribed) {
        setMetadataMap({ ...map });
      }
    };

    loadMetadata();

    return () => {
      isSubscribed = false;
    };
  }, [activeConsole?.id, gamesForActiveConsole.length]);

  useEffect(() => {
    if (!isPreviewsZone || gamesForActiveConsole.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPreviewIndex((prev) => (prev > 0 ? prev - 1 : gamesForActiveConsole.length - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPreviewIndex((prev) => (prev < gamesForActiveConsole.length - 1 ? prev + 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedGame = gamesForActiveConsole[previewIndex] || gamesForActiveConsole[0];
        if (selectedGame && activeConsole.isAvailable) {
          navigate(`/play/${activeConsole.id}/${selectedGame.id}`);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPreviewsZone, previewIndex, gamesForActiveConsole, activeConsole, navigate, setPreviewIndex]);

  const handleSelectConsole = (consoleDef: ConsoleDefinition) => {
    if (consoleDef.isAvailable) {
      navigate(`/console/${consoleDef.id}`);
    }
  };

  const handlePlayGame = (game: GameDefinition) => {
    if (activeConsole.isAvailable) {
      navigate(`/play/${activeConsole.id}/${game.id}`);
    }
  };

  const wallpaperUrl = useConsoleWallpaper(activeConsole?.id);

  return (
    <div className="console-selector-page">
      {/* Immersive Wallpaper background */}
      <div className="bg-wallpaper-container">
        {wallpaperUrl ? (
          <img
            key={wallpaperUrl}
            src={wallpaperUrl}
            alt="Wallpaper"
            className="bg-wallpaper-image"
          />
        ) : null}
        <div className="bg-wallpaper-overlay" />
      </div>

      {/* Main 3D Carousel Component */}
      <ConsoleCarousel
        consoles={consoles}
        onSelectConsole={handleSelectConsole}
        onActiveConsoleChange={setActiveConsole}
      />

      {/* Console Metadata Line */}
      <div className="console-details-bar">
        <strong>{activeConsole.name}</strong>
        {activeConsole.releaseYear && ` | SORTIE : ${activeConsole.releaseYear}`}
        {` | ${gamesForActiveConsole.length} JEU(X) DISPONIBLE(S)`}
        {activeConsole.isAvailable && " | ÉMULATION PRÊTE"}
      </div>

      {/* Bottom Section (Preview list + Popular Sidebar) */}
      <div className={`bottom-section ${isPreviewsZone ? "zone-focused" : ""}`}>
        <div className="game-previews-container">
          <div className="preview-section-header">
            <span className="preview-section-title">
              APERÇU DES JEUX ({activeConsole.name})
            </span>
          </div>

          {gamesForActiveConsole.length > 0 ? (
            <div className="preview-grid">
              {gamesForActiveConsole.map((g, idx) => {
                const isFocusedCard = isPreviewsZone && idx === previewIndex;
                const meta = metadataMap[g.filename || ""] || metadataMap[g.name.toLowerCase()];
                const tags = romTagService.detectTags(g.filename || g.name, activeConsole.id);

                return (
                  <div
                    key={g.id}
                    className={`preview-card ${isFocusedCard ? "focused" : ""}`}
                    onMouseEnter={() => setHoveredGameIndex(idx)}
                    onMouseLeave={() => setHoveredGameIndex(null)}
                    onClick={() => {
                      setActiveZone("previews");
                      setPreviewIndex(idx);
                      handlePlayGame(g);
                    }}
                  >
                    {meta?.coverUrl ? (
                      <div className="preview-card-cover-wrapper">
                        <img
                          src={meta.coverUrl}
                          alt={g.name}
                          className="preview-card-cover-img"
                        />
                        {/* Top-Left Region / Type Badges */}
                        <div className="preview-card-top-left-badges">
                          {tags.map((tag) => (
                            <span
                              key={tag.label}
                              className="rom-badge"
                              style={{
                                color: tag.color,
                                background: "rgba(0, 0, 0, 0.82)",
                                border: `1px solid ${tag.border}`,
                              }}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>

                        {/* Top-Right Rating Badge */}
                        {meta.rating > 0 && (
                          <span className="preview-card-rating">
                            <Star size={10} fill="#f59e0b" color="#f59e0b" />
                            {meta.rating}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="preview-card-fallback-wrapper">
                        <Gamepad2 size={28} color="var(--accent-cyan)" className="preview-card-icon" />
                        <div className="preview-card-top-left-badges">
                          {tags.map((tag) => (
                            <span
                              key={tag.label}
                              className="rom-badge"
                              style={{
                                color: tag.color,
                                background: "rgba(0, 0, 0, 0.82)",
                                border: `1px solid ${tag.border}`,
                              }}
                            >
                              {tag.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <span className="preview-card-name">{meta?.title || g.name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass-panel no-games-panel">
              Aucun jeu préinstallé. Glissez un fichier ROM dans la section Bibliothèque !
            </div>
          )}
        </div>

        {/* Sidebar: 3D Cartridge Model for Atari 2600 or Popular List fallback */}
        <div className="popular-sidebar">
          {activeConsole.id === "atari2600" ? (
            <AtariCartridgeViewer
              customCoverUrl={activeCoverUrl}
              gameTitle={activeGameDef?.name || activeGameMeta?.title || "ATARI 2600"}
            />
          ) : (
            <>
              <div className="popular-title">POPULAIRES</div>
              <ul className="popular-list">
                <li className="popular-item">SUPER MARIO BROS</li>
                <li className="popular-item">SONIC THE HEDGEHOG</li>
                <li className="popular-item">THE LEGEND OF ZELDA</li>
                <li className="popular-item">TETRIS</li>
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
