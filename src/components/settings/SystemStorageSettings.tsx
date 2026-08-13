import React, { useState, useEffect } from "react";
import { consoleRegistry } from "../../emulator/ConsoleRegistry";
import { storagePathService, getRomKey } from "../../services/StoragePathService";
import { romScannerService } from "../../services/RomScannerService";
import { igdbConfigService } from "../../services/IgdbConfigService";
import { igdbApiService } from "../../services/IgdbApiService";
import { screenScraperApiService } from "../../services/ScreenScraperApiService";
import { gameDatabaseService } from "../../services/GameDatabaseService";
import { gameLibrary } from "../../emulator/GameLibrary";
import { GameDefinition } from "../../emulator/types";
import {
  Folder,
  FileCode,
  Edit2,
  Save,
  RotateCcw,
  CheckCircle2,
  HardDrive,
  FolderSearch,
  AlertCircle,
  Loader2,
  Trash2,
  Globe,
  Sparkles,
  Image,
  Database,
} from "lucide-react";

interface StorageRowItem {
  id: string;
  name: string;
  category: "system" | "roms";
  consoleId?: string;
  icon: React.ReactNode;
  defaultPath: string;
}

interface RomFolderStatus {
  hasHandle: boolean;
  scanning: boolean;
  count: number | null;
  folderName: string | null;
}

interface SyncProgress {
  serviceName: string;
  consoleName: string;
  current: number;
  total: number;
  currentGameName: string;
}

export const SystemStorageSettings: React.FC = () => {
  const consoles = consoleRegistry.getAllConsoles();

  const systemItems: StorageRowItem[] = [
    {
      id: "config_path",
      name: "Configuration des manettes",
      category: "system",
      icon: <FileCode size={18} color="var(--accent-cyan)" />,
      defaultPath: "/config/controllers.json",
    },
  ];

  const romItems: StorageRowItem[] = consoles.map((c) => ({
    id: getRomKey(c.id),
    name: `Dossier ROMs — ${c.name}`,
    category: "roms",
    consoleId: c.id,
    icon: <Folder size={18} color="var(--accent-cyan)" />,
    defaultPath: `/emulators/${c.id}/roms`,
  }));

  const allItems = [...systemItems, ...romItems];

  // Paths for system entries
  const [paths, setPaths] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    systemItems.forEach((item) => {
      initial[item.id] = storagePathService.get(item.id);
    });
    return initial;
  });

  // ROM folder statuses
  const [romStatus, setRomStatus] = useState<Record<string, RomFolderStatus>>(() => {
    const init: Record<string, RomFolderStatus> = {};
    romItems.forEach((item) => {
      init[item.consoleId!] = { hasHandle: false, scanning: false, count: null, folderName: null };
    });
    return init;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync progress state
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);

  // Total loaded games across all ROM folders
  const [totalGames, setTotalGames] = useState<GameDefinition[]>(() => gameLibrary.getAllGames());

  // Local SQLite metadata DB state
  const [dbCount, setDbCount] = useState<number>(0);

  const refreshDbCount = () => {
    gameDatabaseService.countGames().then((count) => setDbCount(count));
  };

  // On mount: subscribe to gameLibrary, check stored handles & load local DB count
  useEffect(() => {
    refreshDbCount();

    const unsubscribe = gameLibrary.subscribe(() => {
      setTotalGames(gameLibrary.getAllGames());
    });

    consoles.forEach(async (c) => {
      const has = await romScannerService.hasStoredHandle(c.id);
      if (has) {
        setRomStatus((prev) => ({
          ...prev,
          [c.id]: { ...prev[c.id], hasHandle: true },
        }));
      }
    });

    return unsubscribe;
  }, []);

  const handleClearCache = async () => {
    if (confirm("Voulez-vous vraiment vider la base de données SQLite locale des métadonnées de jeux ?")) {
      await gameDatabaseService.clearDatabase();
      refreshDbCount();
      showSuccess("Base de données SQLite locale vidée avec succès !");
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  // ── System path row handlers ──────────────────────────────────

  const handleSaveRow = (id: string) => {
    storagePathService.set(id, paths[id] || "");
    setEditingId(null);
    showSuccess("Emplacement de stockage enregistré avec succès !");
  };

  const handleResetRow = (item: StorageRowItem) => {
    const defaultVal = storagePathService.reset(item.id);
    setPaths((prev) => ({ ...prev, [item.id]: defaultVal }));
    setEditingId(null);
    showSuccess(`Emplacement réinitialisé : ${defaultVal}`);
  };

  // ── ROM folder handlers ────────────────────────────────────

  const handlePickRomFolder = async (consoleId: string, consoleName: string) => {
    if (!(window as any).showDirectoryPicker) {
      showError(
        "Votre navigateur ne supporte pas l'API File System Access (showDirectoryPicker). Utilisez Chrome ou Edge récent."
      );
      return;
    }

    setRomStatus((prev) => ({
      ...prev,
      [consoleId]: { ...prev[consoleId], scanning: true, count: null },
    }));

    try {
      const result = await romScannerService.pickAndScanDirectory(consoleId);

      if (!result) {
        setRomStatus((prev) => ({
          ...prev,
          [consoleId]: { ...prev[consoleId], scanning: false },
        }));
        return;
      }

      setRomStatus((prev) => ({
        ...prev,
        [consoleId]: {
          hasHandle: true,
          scanning: false,
          count: result.count,
          folderName: result.folderName ?? null,
        },
      }));

      setTotalGames(gameLibrary.getAllGames());

      if (result.count === 0) {
        showSuccess(
          `Aucun fichier ROM compatible trouvé dans ce dossier pour ${consoleName}.`
        );
      } else {
        showSuccess(
          `${result.count} ROM${result.count > 1 ? "s" : ""} disponible${result.count > 1 ? "s" : ""} pour ${consoleName} !`
        );
      }
    } catch (err: any) {
      setRomStatus((prev) => ({
        ...prev,
        [consoleId]: { ...prev[consoleId], scanning: false },
      }));
      showError(`Erreur lors du scan du dossier : ${err?.message ?? err}`);
    }
  };

  const handleStartIgdbSync = async () => {
    const games = gameLibrary.getAllGames();
    if (games.length === 0) {
      showError("Aucun jeu disponible dans vos dossiers ROMs à synchroniser.");
      return;
    }

    setSyncProgress({
      serviceName: "IGDB",
      consoleName: "vos dossiers ROMs",
      current: 0,
      total: games.length,
      currentGameName: games[0]?.name || "",
    });

    let successCount = 0;
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      setSyncProgress({
        serviceName: "IGDB",
        consoleName: "vos dossiers ROMs",
        current: i + 1,
        total: games.length,
        currentGameName: game.name,
      });

      try {
        const meta = await igdbApiService.getOrFetchMetadata(
          game.name,
          game.consoleId,
          game.filename || game.name,
          game.romData
        );
        if (meta) successCount++;
      } catch {
        // ignore individual failures
      }
    }

    setSyncProgress(null);
    refreshDbCount();
    showSuccess(
      `Synchronisation IGDB terminée ! ${successCount} jaquette(s) & métadonnées enregistrées dans la BDD locale.`
    );
  };

  const handleStartScreenScraperSync = async () => {
    const games = gameLibrary.getAllGames();
    if (games.length === 0) {
      showError("Aucun jeu disponible dans vos dossiers ROMs à synchroniser.");
      return;
    }

    setSyncProgress({
      serviceName: "ScreenScraper",
      consoleName: "vos dossiers ROMs",
      current: 0,
      total: games.length,
      currentGameName: games[0]?.name || "",
    });

    let successCount = 0;
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      setSyncProgress({
        serviceName: "ScreenScraper",
        consoleName: "vos dossiers ROMs",
        current: i + 1,
        total: games.length,
        currentGameName: game.name,
      });

      try {
        const meta = await screenScraperApiService.getOrFetchMetadata(
          game.name,
          game.consoleId,
          game.filename || game.name,
          game.romData
        );
        if (meta && meta.coverUrl) successCount++;
      } catch {
        // ignore individual failures
      }
    }

    setSyncProgress(null);
    refreshDbCount();
    showSuccess(
      `Synchronisation ScreenScraper terminée ! ${successCount} jaquette(s) & métadonnées enregistrées dans la BDD locale.`
    );
  };

  const handleClearRomFolder = async (consoleId: string, consoleName: string) => {
    await romScannerService.clearStoredHandle(consoleId);
    setRomStatus((prev) => ({
      ...prev,
      [consoleId]: { hasHandle: false, scanning: false, count: null, folderName: null },
    }));
    setTotalGames(gameLibrary.getAllGames());
    showSuccess(`Dossier ROMs retiré pour ${consoleName}.`);
  };

  const isIgdbConfigured = igdbConfigService.isConfigured();

  return (
    <div className="ctrl-settings">
      {/* Header Banner */}
      <div className="ctrl-bindings-panel" style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <HardDrive size={22} color="var(--accent-cyan)" />
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#ffffff" }}>
              Gestion des Emplacements de Stockage
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Configurez les dossiers ROMs par console et les chemins de fichiers système.
              Les ROMs sont lues directement depuis votre disque.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div
          className="ctrl-success"
          style={{
            padding: "10px 16px",
            background: "rgba(52, 211, 153, 0.12)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(52, 211, 153, 0.3)",
          }}
        >
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            background: "rgba(239, 68, 68, 0.12)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#ef4444",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {/* Permanent Metadata Sync Banner */}
      <div
        className="ctrl-bindings-panel"
        style={{
          padding: "16px 20px",
          background: "rgba(0, 229, 255, 0.08)",
          border: "1px solid rgba(0, 229, 255, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Globe size={20} color="var(--accent-cyan)" />
            <div>
              <strong style={{ color: "#ffffff", fontSize: "0.9rem" }}>
                Télécharger les jaquettes &amp; métadonnées ?
              </strong>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Rechercher les jaquettes pour les {totalGames.length} jeu{totalGames.length > 1 ? "x" : ""} disponible{totalGames.length > 1 ? "s" : ""} dans vos dossiers ROMs et les stocker en BDD locale.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {isIgdbConfigured && (
              <button
                className="ctrl-action-btn primary"
                onClick={handleStartIgdbSync}
                disabled={syncProgress !== null || totalGames.length === 0}
                style={{ padding: "6px 14px", fontSize: "0.78rem" }}
              >
                <Sparkles size={14} /> Synchroniser via IGDB
              </button>
            )}

            <button
              className="ctrl-action-btn primary"
              onClick={handleStartScreenScraperSync}
              disabled={syncProgress !== null || totalGames.length === 0}
              style={{
                padding: "6px 14px",
                fontSize: "0.78rem",
                background: isIgdbConfigured ? "rgba(0, 229, 255, 0.15)" : undefined,
                border: isIgdbConfigured ? "1px solid rgba(0, 229, 255, 0.3)" : undefined,
              }}
            >
              <Image size={14} /> Synchroniser via ScreenScraper
            </button>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      {syncProgress && (
        <div
          className="ctrl-bindings-panel"
          style={{
            padding: "16px 20px",
            background: "rgba(52, 211, 153, 0.1)",
            border: "1px solid rgba(52, 211, 153, 0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Loader2 size={20} color="#34d399" className="spin" />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 700, color: "#ffffff" }}>
                <span>Recherche {syncProgress.serviceName} pour {syncProgress.consoleName}…</span>
                <span>{syncProgress.current} / {syncProgress.total}</span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Jeu en cours : <strong style={{ color: "var(--accent-cyan)" }}>{syncProgress.currentGameName}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SQLite Local Database Caching Panel */}
      <div className="ctrl-bindings-panel" style={{ padding: "20px" }}>
        <div className="ctrl-bindings-header" style={{ margin: "-20px -20px 20px -20px" }}>
          <Database size={18} color="var(--accent-cyan)" />
          <span>Base de Données SQLite Locale (Mise en Cache)</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{dbCount} jeu{dbCount > 1 ? "x" : ""} enregistré{dbCount > 1 ? "s" : ""} dans la BDD SQLite locale</span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", maxWidth: "520px" }}>
              Les jaquettes, résumés, genres et notes récupérés via ScreenScraper ou IGDB sont automatiquement conservés en base de données locale afin d'éviter les requêtes répétitives.
            </p>
          </div>

          <button className="ctrl-action-btn secondary" onClick={handleClearCache} style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}>
            <Trash2 size={15} /> Vider la BDD SQLite locale
          </button>
        </div>
      </div>

      {/* Storage Table Panel */}
      <div className="ctrl-bindings-panel">
        <div
          className="ctrl-bindings-header"
          style={{ justifyContent: "space-between" }}
        >
          <span>Tableau des Chemins Système &amp; Dossiers ROMs</span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {allItems.length} emplacements
          </span>
        </div>

        <table
          className="storage-table"
          style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(0,0,0,0.3)",
              }}
            >
              <th className="storage-th" style={{ width: "35%" }}>Nom du Stockage</th>
              <th className="storage-th">Valeur / Emplacement</th>
              <th className="storage-th" style={{ width: "200px", textAlign: "right" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {allItems.map((item) => {
              const isEditing = editingId === item.id;

              if (item.category === "roms" && item.consoleId) {
                const consoleId = item.consoleId;
                const status = romStatus[consoleId] ?? {
                  hasHandle: false,
                  scanning: false,
                  count: null,
                  folderName: null,
                };
                const consoleDef = consoleRegistry.getConsole(consoleId);
                const exts = consoleDef?.supportedRomExtensions?.join(", ") ?? "";

                return (
                  <tr
                    key={item.id}
                    className="storage-row"
                    style={{
                      background: status.hasHandle
                        ? "rgba(52, 211, 153, 0.04)"
                        : "transparent",
                    }}
                  >
                    {/* Col 1: Name */}
                    <td className="storage-td">
                      <div className="storage-name-cell">
                        {item.icon}
                        <div>
                          <div className="storage-name">{item.name}</div>
                          <div className="storage-category-label">
                            {exts ? `Extensions : ${exts}` : "Dossier de Jeux"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Folder name or placeholder */}
                    <td className="storage-td">
                      {status.hasHandle ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.82rem",
                              color: "#34d399",
                              background: "rgba(52, 211, 153, 0.1)",
                              padding: "5px 12px",
                              borderRadius: "4px",
                              border: "1px solid rgba(52, 211, 153, 0.25)",
                            }}
                          >
                            {status.folderName ?? "Dossier sélectionné"}
                          </span>
                          {status.count !== null && (
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              — {status.count} ROM{status.count > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                            fontStyle: "italic",
                          }}
                        >
                          Aucun dossier sélectionné
                        </span>
                      )}
                    </td>

                    {/* Col 3: Actions */}
                    <td className="storage-td" style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" }}>
                        <button
                          className="ctrl-action-btn primary storage-icon-btn"
                          disabled={status.scanning}
                          onClick={() => handlePickRomFolder(consoleId, item.name)}
                          title={status.scanning ? "Scan en cours…" : "Choisir le dossier de ROMs"}
                        >
                          {status.scanning ? (
                            <Loader2 size={18} color="#ffffff" className="spin" />
                          ) : (
                            <FolderSearch size={18} color="#ffffff" />
                          )}
                        </button>

                        {status.hasHandle && (
                          <button
                            className="ctrl-action-btn storage-icon-btn"
                            style={{
                              background: "rgba(239, 68, 68, 0.15)",
                              border: "1px solid rgba(239, 68, 68, 0.4)",
                              color: "#ef4444",
                              cursor: "pointer",
                            }}
                            onClick={() => handleClearRomFolder(consoleId, item.name)}
                            title="Retirer le dossier ROM"
                          >
                            <Trash2 size={17} color="#ef4444" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              // ── System row (text editable) ────────────────────────────────
              const currentPath = paths[item.id] ?? item.defaultPath;
              return (
                <tr
                  key={item.id}
                  className="storage-row"
                  style={{
                    background: isEditing
                      ? "rgba(0, 229, 255, 0.06)"
                      : "transparent",
                  }}
                >
                  <td className="storage-td">
                    <div className="storage-name-cell">
                      {item.icon}
                      <div>
                        <div className="storage-name">{item.name}</div>
                        <div className="storage-category-label">Fichier Système</div>
                      </div>
                    </div>
                  </td>

                  <td className="storage-td">
                    {isEditing ? (
                      <input
                        type="text"
                        value={currentPath}
                        onChange={(e) =>
                          setPaths((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="ctrl-select"
                        style={{ width: "100%", fontFamily: "monospace", fontSize: "0.82rem" }}
                        autoFocus
                      />
                    ) : (
                      <code
                        onClick={() => setEditingId(item.id)}
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.82rem",
                          color: "var(--accent-cyan)",
                          background: "rgba(0, 229, 255, 0.08)",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          border: "1px solid rgba(0, 229, 255, 0.2)",
                          cursor: "pointer",
                          display: "inline-block",
                          wordBreak: "break-all",
                        }}
                        title="Cliquer pour modifier"
                      >
                        {currentPath}
                      </code>
                    )}
                  </td>

                  <td className="storage-td" style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {isEditing ? (
                        <button
                          className="ctrl-action-btn primary"
                          style={{ padding: "6px 12px", fontSize: "0.75rem" }}
                          onClick={() => handleSaveRow(item.id)}
                        >
                          <Save size={14} /> Sauver
                        </button>
                      ) : (
                        <button
                          className="ctrl-action-btn secondary"
                          style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                          onClick={() => setEditingId(item.id)}
                        >
                          <Edit2 size={14} /> Modif.
                        </button>
                      )}
                      <button
                        className="ctrl-action-btn secondary"
                        style={{ padding: "6px 10px", fontSize: "0.75rem" }}
                        onClick={() => handleResetRow(item)}
                        title="Réinitialiser le chemin par défaut"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
