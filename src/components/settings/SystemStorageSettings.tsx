import React, { useState, useEffect } from "react";
import { consoleRegistry } from "../../emulator/ConsoleRegistry";
import { storagePathService, getRomKey } from "../../services/StoragePathService";
import { romScannerService } from "../../services/RomScannerService";
import { igdbConfigService } from "../../services/IgdbConfigService";
import { igdbApiService } from "../../services/IgdbApiService";
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

interface IgdbSyncPrompt {
  consoleId: string;
  consoleName: string;
  games: GameDefinition[];
}

interface IgdbSyncProgress {
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

  // IGDB prompt & progress state
  const [igdbPrompt, setIgdbPrompt] = useState<IgdbSyncPrompt | null>(null);
  const [igdbProgress, setIgdbProgress] = useState<IgdbSyncProgress | null>(null);

  // On mount: check which consoles have stored handles
  useEffect(() => {
    consoles.forEach(async (c) => {
      const has = await romScannerService.hasStoredHandle(c.id);
      if (has) {
        setRomStatus((prev) => ({
          ...prev,
          [c.id]: { ...prev[c.id], hasHandle: true },
        }));
      }
    });
  }, []);

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

      if (result.count === 0) {
        showSuccess(
          `Aucun fichier ROM compatible trouvé dans ce dossier pour ${consoleName}.`
        );
      } else {
        showSuccess(
          `${result.count} ROM${result.count > 1 ? "s" : ""} disponible${result.count > 1 ? "s" : ""} pour ${consoleName} !`
        );

        // Offer IGDB metadata fetch if IGDB API is configured
        if (igdbConfigService.isConfigured()) {
          setIgdbPrompt({
            consoleId,
            consoleName,
            games: result.games,
          });
        }
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
    if (!igdbPrompt) return;
    const { consoleId, consoleName, games } = igdbPrompt;
    setIgdbPrompt(null);

    setIgdbProgress({
      consoleName,
      current: 0,
      total: games.length,
      currentGameName: games[0]?.name || "",
    });

    let successCount = 0;
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      setIgdbProgress({
        consoleName,
        current: i + 1,
        total: games.length,
        currentGameName: game.name,
      });

      try {
        const meta = await igdbApiService.getOrFetchMetadata(
          game.name,
          consoleId,
          game.filename || game.name
        );
        if (meta) successCount++;
      } catch {
        // ignore individual failures
      }
    }

    setIgdbProgress(null);
    showSuccess(
      `Synchronisation IGDB terminée ! ${successCount} jaquettes et métadonnées enregistrées dans la BDD SQLite.`
    );
  };

  const handleClearRomFolder = async (consoleId: string, consoleName: string) => {
    await romScannerService.clearStoredHandle(consoleId);
    setRomStatus((prev) => ({
      ...prev,
      [consoleId]: { hasHandle: false, scanning: false, count: null, folderName: null },
    }));
    showSuccess(`Dossier ROMs retiré pour ${consoleName}.`);
  };

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

      {/* IGDB Prompt Modal / Banner */}
      {igdbPrompt && (
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
                  API IGDB configurée — Télécharger les jaquettes &amp; métadonnées ?
                </strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  Rechercher les jaquettes, éditeurs, notes et résumés pour les {igdbPrompt.games.length} jeux de {igdbPrompt.consoleName} et les stocker en BDD SQLite locale.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="ctrl-action-btn primary"
                onClick={handleStartIgdbSync}
                style={{ padding: "6px 14px", fontSize: "0.78rem" }}
              >
                <Sparkles size={14} /> Synchroniser via IGDB
              </button>
              <button
                className="ctrl-action-btn secondary"
                onClick={() => setIgdbPrompt(null)}
                style={{ padding: "6px 12px", fontSize: "0.78rem" }}
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IGDB Progress Indicator */}
      {igdbProgress && (
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
                <span>Recherche IGDB pour {igdbProgress.consoleName}…</span>
                <span>{igdbProgress.current} / {igdbProgress.total}</span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Jeu en cours : <strong style={{ color: "var(--accent-cyan)" }}>{igdbProgress.currentGameName}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

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
