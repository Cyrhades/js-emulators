import React, { useRef, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { consoleRegistry } from "../../emulator/ConsoleRegistry";
import { gameLibrary } from "../../emulator/GameLibrary";
import { audioManager } from "../../emulator/AudioManager";
import { gameDatabaseService, IgdbGameMetadata } from "../../services/GameDatabaseService";
import { igdbConfigService } from "../../services/IgdbConfigService";
import { igdbApiService } from "../../services/IgdbApiService";
import { screenScraperApiService } from "../../services/ScreenScraperApiService";
import { romTagService } from "../../services/RomTagService";
import { Upload, Play, ArrowLeft, Gamepad2, Star, Sparkles, Loader2, Image } from "lucide-react";
import { useConsoleWallpaper } from "../../hooks/useConsoleWallpaper";

export const GameLibraryView: React.FC = () => {
  const { consoleId } = useParams<{ consoleId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const consoleDef = consoleId ? consoleRegistry.getConsole(consoleId) : undefined;
  const [isDragging, setIsDragging] = useState(false);
  const [games, setGames] = useState(
    consoleId ? gameLibrary.getGamesForConsole(consoleId) : []
  );
  const [metadataMap, setMetadataMap] = useState<Record<string, IgdbGameMetadata>>({});
  const [syncingIgdb, setSyncingIgdb] = useState(false);
  const [syncingScreenScraper, setSyncingScreenScraper] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const wallpaperUrl = useConsoleWallpaper(consoleDef?.id);

  // Load cached IGDB/ScreenScraper metadata
  const loadMetadata = () => {
    if (!consoleDef?.id) return;
    gameDatabaseService.getGamesForConsole(consoleDef.id).then((list) => {
      const map: Record<string, IgdbGameMetadata> = {};
      list.forEach((m) => {
        if (m.romFilename) map[m.romFilename] = m;
        if (m.title) map[m.title.toLowerCase()] = m;
      });
      setMetadataMap(map);
    });
  };

  useEffect(() => {
    loadMetadata();
  }, [consoleDef?.id]);

  if (!consoleDef) {
    return (
      <div className="glass-panel" style={{ padding: "40px", textAlign: "center" }}>
        <h2>Console introuvable</h2>
        <button onClick={() => navigate("/consoles")} className="btn btn-primary" style={{ marginTop: "16px" }}>
          Retour aux consoles
        </button>
      </div>
    );
  }

  const refreshGames = () => {
    if (consoleId) {
      setGames(gameLibrary.getGamesForConsole(consoleId));
      loadMetadata();
    }
  };

  const handlePlayGame = (gameId: string) => {
    audioManager.resume().catch(() => {});
    navigate(`/play/${consoleDef.id}/${gameId}`);
  };

  const processFile = async (file: File) => {
    const game = await gameLibrary.loadFromFile(file, consoleDef.id);
    refreshGames();
    handlePlayGame(game.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleSyncIgdb = async () => {
    if (!consoleId || syncingIgdb || syncingScreenScraper) return;
    setSyncingIgdb(true);
    setSyncMsg("Synchronisation avec l'API IGDB en cours…");

    let count = 0;
    for (const g of games) {
      try {
        const meta = await igdbApiService.getOrFetchMetadata(
          g.name,
          consoleId,
          g.filename || g.name
        );
        if (meta) count++;
      } catch {
        // ignore
      }
    }

    loadMetadata();
    setSyncingIgdb(false);
    setSyncMsg(`${count} jaquette(s) & métadonnées enregistrées via IGDB !`);
    setTimeout(() => setSyncMsg(null), 4000);
  };

  const handleSyncScreenScraper = async () => {
    if (!consoleId || syncingIgdb || syncingScreenScraper) return;
    setSyncingScreenScraper(true);
    setSyncMsg("Synchronisation avec ScreenScraper en cours…");

    let count = 0;
    for (const g of games) {
      try {
        const meta = await screenScraperApiService.getOrFetchMetadata(
          g.name,
          consoleId,
          g.filename || g.name,
          g.romData
        );
        if (meta && meta.coverUrl) count++;
      } catch {
        // ignore
      }
    }

    loadMetadata();
    setSyncingScreenScraper(false);
    setSyncMsg(`${count} jaquette(s) & métadonnées enregistrées via ScreenScraper !`);
    setTimeout(() => setSyncMsg(null), 4000);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const isIgdbConfigured = igdbConfigService.isConfigured();

  return (
    <div>
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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => navigate("/consoles")} className="btn btn-secondary btn-icon">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="page-title">{consoleDef.name}</h1>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Bibliothèque de jeux ({games.length}) &amp; Métadonnées
            </p>
          </div>
        </div>

        {games.length > 0 && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {isIgdbConfigured && (
              <button
                className="ctrl-action-btn primary"
                onClick={handleSyncIgdb}
                disabled={syncingIgdb || syncingScreenScraper}
                style={{ padding: "8px 16px", fontSize: "0.82rem" }}
              >
                {syncingIgdb ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {syncingIgdb ? "Recherche IGDB…" : "Synchroniser via IGDB"}
              </button>
            )}

            <button
              className="ctrl-action-btn primary"
              onClick={handleSyncScreenScraper}
              disabled={syncingIgdb || syncingScreenScraper}
              style={{
                padding: "8px 16px",
                fontSize: "0.82rem",
                background: isIgdbConfigured ? "rgba(0, 229, 255, 0.15)" : undefined,
                border: isIgdbConfigured ? "1px solid rgba(0, 229, 255, 0.3)" : undefined,
              }}
            >
              {syncingScreenScraper ? <Loader2 size={16} className="spin" /> : <Image size={16} />}
              {syncingScreenScraper ? "Recherche ScreenScraper…" : "Synchroniser via ScreenScraper"}
            </button>
          </div>
        )}
      </div>

      {syncMsg && (
        <div
          style={{
            padding: "10px 16px",
            marginBottom: "20px",
            background: "rgba(0, 229, 255, 0.12)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(0, 229, 255, 0.3)",
            color: "var(--accent-cyan)",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {syncMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr", gap: "24px" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--text-primary)" }}>
            Jeux disponibles ({games.length})
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {games.map((g) => {
              const meta = metadataMap[g.filename || ""] || metadataMap[g.name.toLowerCase()];
              const tags = romTagService.detectTags(g.filename || g.name, consoleDef.id);

              return (
                <div
                  key={g.id}
                  className="glass-panel"
                  style={{
                    padding: "18px 22px",
                    display: "flex",
                    gap: "20px",
                    alignItems: "center",
                  }}
                >
                  {/* Game Cover Art Image Container with Top-Left Badges */}
                  <div style={{ position: "relative", width: "84px", height: "112px", flexShrink: 0 }}>
                    {meta?.coverUrl ? (
                      <img
                        src={meta.coverUrl}
                        alt={g.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          boxShadow: "0 4px 14px rgba(0, 0, 0, 0.5)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "rgba(0, 229, 255, 0.08)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px dashed rgba(0, 229, 255, 0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Gamepad2 size={32} color="var(--accent-cyan)" />
                      </div>
                    )}

                    {/* Region / Type Badges Overlay Top-Left */}
                    <div
                      style={{
                        position: "absolute",
                        top: "4px",
                        left: "4px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "3px",
                        zIndex: 2,
                      }}
                    >
                      {tags.map((tag) => (
                        <span
                          key={tag.label}
                          style={{
                            fontSize: "0.58rem",
                            fontWeight: 800,
                            padding: "1px 5px",
                            borderRadius: "3px",
                            color: tag.color,
                            background: "rgba(0, 0, 0, 0.85)",
                            border: `1px solid ${tag.border}`,
                            letterSpacing: "0.5px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.6)",
                          }}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Game Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
                        {meta?.title || g.name}
                      </h3>

                      {meta?.rating ? (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            background: "rgba(245, 158, 11, 0.15)",
                            color: "#f59e0b",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                            padding: "2px 8px",
                            borderRadius: "var(--radius-pill)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Star size={11} fill="#f59e0b" color="#f59e0b" />
                          {meta.rating}%
                        </span>
                      ) : null}
                    </div>

                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                      {meta?.developer && <span>Éditeur: <strong style={{ color: "#ffffff" }}>{meta.developer}</strong></span>}
                      {meta?.releaseDate && <span>Année: <strong style={{ color: "#ffffff" }}>{meta.releaseDate}</strong></span>}
                    </div>

                    {meta?.genres && meta.genres.length > 0 && (
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                        {meta.genres.map((genre) => (
                          <span
                            key={genre}
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              background: "rgba(0, 229, 255, 0.1)",
                              color: "var(--accent-cyan)",
                              border: "1px solid rgba(0, 229, 255, 0.2)",
                              padding: "2px 8px",
                              borderRadius: "4px",
                            }}
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}

                    <p
                      style={{
                        fontSize: "0.82rem",
                        color: "var(--text-secondary)",
                        marginTop: "8px",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {meta?.summary || g.description}
                    </p>
                  </div>

                  {/* Play Button */}
                  <button
                    onClick={() => handlePlayGame(g.id)}
                    className="btn btn-primary"
                    style={{ flexShrink: 0 }}
                  >
                    <Play size={16} /> JOUER
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "16px", color: "var(--text-primary)" }}>
            Charger une ROM locale
          </h2>

          <div
            className="dropzone"
            style={{
              borderColor: isDragging ? "var(--accent-secondary)" : undefined,
              backgroundColor: isDragging ? "rgba(0, 229, 255, 0.12)" : undefined,
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload size={36} color="var(--accent-secondary)" style={{ marginBottom: "12px" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "6px" }}>
              Parcourir ou Déposer un fichier ROM
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Formats supportés: {consoleDef.supportedRomExtensions.join(", ")} ou .zip
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept={[...consoleDef.supportedRomExtensions, ".zip"].join(",")}
              style={{ display: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
