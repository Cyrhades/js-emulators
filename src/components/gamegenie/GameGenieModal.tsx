import React, { useState } from "react";
import { CheatCode } from "../../emulator/types";

export interface GameGenieModalProps {
  isOpen: boolean;
  onClose: () => void;
  codes: CheatCode[];
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onAddCode: (code: string, description: string) => boolean;
  onToggleCode: (id: string, active: boolean) => void;
  onDeleteCode: (id: string) => void;
  onClearAll: () => void;
}

/**
 * GameGenieModal - UI component to enter, toggle, and manage Game Genie / Hex cheat codes.
 */
export default function GameGenieModal({
  isOpen,
  onClose,
  codes,
  enabled,
  onToggleEnabled,
  onAddCode,
  onToggleCode,
  onDeleteCode,
  onClearAll,
}: GameGenieModalProps) {
  const [inputCode, setInputCode] = useState("");
  const [inputDescription, setInputDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const trimmedCode = inputCode.trim().toUpperCase();
    if (!trimmedCode) {
      setErrorMsg("Veuillez saisir un code.");
      return;
    }

    const description = inputDescription.trim() || `Code ${trimmedCode}`;
    const success = onAddCode(trimmedCode, description);
    if (success) {
      setInputCode("");
      setInputDescription("");
    } else {
      setErrorMsg(
        "Code invalide. Format attendu : 6 ou 8 lettres (ex: AAUNYLPA) ou Adresse:Valeur (ex: 11D9:AD)."
      );
    }
  };

  return (
    <div className="gg-modal-overlay" onClick={onClose}>
      <div className="gg-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="gg-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src="/img/game_genie.webp"
              alt="Game Genie"
              style={{
                height: "40px",
                width: "auto",
                objectFit: "contain",
                borderRadius: "8px",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                padding: "2px",
                backgroundColor: "rgba(0,0,0,0.6)",
                flexShrink: 0,
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div>
              <h2 className="gg-modal-title">Codes de triche (Game Genie)</h2>
              <p className="gg-modal-subtitle">
                Modifier la mémoire du jeu avec des codes Game Genie ou Hex
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="gg-modal-close-btn"
            aria-label="Fermer"
          >
            <svg style={{ width: "20px", height: "20px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Global Toggle */}
        <div className="gg-modal-toggle-bar">
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Activer les codes de triche dans le jeu
          </span>
          <button
            type="button"
            onClick={() => onToggleEnabled(!enabled)}
            className={`gg-toggle-switch ${enabled ? "active" : ""}`}
            title={enabled ? "Désactiver les triches" : "Activer les triches"}
          >
            <span className="gg-toggle-thumb" />
          </button>
        </div>

        {/* Content Body */}
        <div className="gg-modal-body">
          {/* Add Code Form */}
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>
              Ajouter un nouveau code
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label className="gg-input-label">
                  Code(s) (6/8 lettres ou Hex, séparés par +)
                </label>
                <input
                  type="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="ex: LEXVGYAA + ZAVNLGAA"
                  className="gg-input-field gg-input-code"
                />
              </div>

              <div>
                <label className="gg-input-label">
                  Description
                </label>
                <input
                  type="text"
                  value={inputDescription}
                  onChange={(e) => setInputDescription(e.target.value)}
                  placeholder="ex: Aller au dernier niveau"
                  className="gg-input-field"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="gg-error-banner">
                ⚠️ {errorMsg}
              </div>
            )}

            <button type="submit" className="gg-submit-btn">
              + Ajouter le(s) code(s)
            </button>
          </form>

          {/* Active Codes List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--text-secondary)" }}>
                Codes enregistrés ({codes.length})
              </h3>

              {codes.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  style={{ background: "none", border: "none", color: "#f87171", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}
                >
                  Tout supprimer
                </button>
              )}
            </div>

            {codes.length === 0 ? (
              <div className="gg-empty-state">
                <img
                  src="/img/game_genie.webp"
                  alt="Game Genie Logo"
                  style={{ height: "48px", width: "auto", objectFit: "contain", opacity: 0.8 }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontStyle: "italic" }}>
                  Aucun code de triche configuré pour ce jeu.
                </p>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  Exemples Double Dragon :{" "}
                  <span style={{ fontFamily: "monospace", color: "#fbbf24", fontWeight: "bold" }}>
                    AAUNYLPA
                  </span>{" "}
                  (Chrono),{" "}
                  <span style={{ fontFamily: "monospace", color: "#fbbf24", fontWeight: "bold" }}>
                    LEXVGYAA + ZAVNLGAA
                  </span>{" "}
                  (Dernier niveau).
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "220px", overflowY: "auto", paddingRight: "4px" }}>
                {codes.map((item) => {
                  const list = item.decodedList || (item.decoded ? [item.decoded] : []);
                  return (
                    <div
                      key={item.id}
                      className={`gg-code-card ${item.active ? "active" : ""}`}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", overflow: "hidden" }}>
                        <button
                          type="button"
                          onClick={() => onToggleCode(item.id, !item.active)}
                          className={`gg-toggle-switch ${item.active ? "active" : ""}`}
                          style={{ flexShrink: 0, marginTop: "2px" }}
                        >
                          <span className="gg-toggle-thumb" />
                        </button>

                        <div style={{ overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#fbbf24", fontSize: "0.8rem", letterSpacing: "1px" }}>
                              {item.code}
                            </span>
                            <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "#ffffff" }}>
                              {item.description}
                            </span>
                          </div>

                          {list.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                              {list.map((dec, idx) => (
                                <div key={idx} style={{ fontSize: "0.68rem", color: "#94a3b8", fontFamily: "monospace" }}>
                                  {list.length > 1 && (
                                    <span style={{ color: "#fbbf24", fontWeight: "bold", marginRight: "4px" }}>
                                      #{idx + 1}:
                                    </span>
                                  )}
                                  Addr: ${dec.addr.toString(16).toUpperCase().padStart(4, "0")}{" "}
                                  | Val: ${dec.value.toString(16).toUpperCase().padStart(2, "0")}
                                  {dec.key !== undefined &&
                                    ` | Key: $${dec.key.toString(16).toUpperCase().padStart(2, "0")}`}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteCode(item.id)}
                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px", borderRadius: "6px" }}
                        title="Supprimer ce code"
                      >
                        <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="gg-modal-footer">
          <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
            Combine plusieurs codes avec + (ex: LEXVGYAA + ZAVNLGAA)
          </p>

          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              padding: "8px 16px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              color: "#ffffff",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
