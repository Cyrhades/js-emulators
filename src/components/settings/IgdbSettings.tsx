import React, { useState, useEffect } from "react";
import { igdbConfigService } from "../../services/IgdbConfigService";
import { gameDatabaseService } from "../../services/GameDatabaseService";
import {
  Globe,
  Key,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  Trash2,
  RefreshCw,
  Info,
} from "lucide-react";

export const IgdbSettings: React.FC = () => {
  const [creds, setCreds] = useState(igdbConfigService.getCredentials());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(
    null
  );
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [dbCount, setDbCount] = useState<number>(0);

  useEffect(() => {
    gameDatabaseService.countGames().then((count) => setDbCount(count));
  }, []);

  const handleSave = () => {
    igdbConfigService.saveCredentials(creds);
    setSaveSuccess("Configuration IGDB enregistrée avec succès !");
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    igdbConfigService.saveCredentials(creds);
    const res = await igdbConfigService.testOrRefreshToken();
    setTestResult(res);
    setCreds(igdbConfigService.getCredentials());
    setTesting(false);
  };

  const handleClearCache = async () => {
    if (confirm("Voulez-vous vraiment vider la base de données SQLite locale des métadonnées de jeux ?")) {
      await gameDatabaseService.clearDatabase();
      const newCount = await gameDatabaseService.countGames();
      setDbCount(newCount);
      setSaveSuccess("Base de données SQLite vidée !");
      setTimeout(() => setSaveSuccess(null), 3000);
    }
  };

  const isConfigured = igdbConfigService.isConfigured();

  return (
    <div className="ctrl-settings">
      {/* Header Panel */}
      <div className="ctrl-bindings-panel" style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Globe size={24} color="var(--accent-cyan)" />
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#ffffff" }}>
                API IGDB.com & Base de Données Métadonnées
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Interrogez l'API IGDB (Internet Game Database) pour récupérer les jaquettes, captures d'écran, éditeurs et résumés des jeux.
              </p>
            </div>
          </div>

          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: "var(--radius-pill)",
              background: isConfigured ? "rgba(52, 211, 153, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: isConfigured ? "#34d399" : "#ef4444",
              border: `1px solid ${isConfigured ? "rgba(52, 211, 153, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            }}
          >
            {isConfigured ? "• API Configurée" : "• Non configurée"}
          </span>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div
          className="ctrl-success"
          style={{
            padding: "10px 16px",
            background: "rgba(52, 211, 153, 0.12)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid rgba(52, 211, 153, 0.3)",
          }}
        >
          <CheckCircle2 size={16} /> {saveSuccess}
        </div>
      )}

      {/* Credentials Form Panel */}
      <div className="ctrl-bindings-panel" style={{ padding: "20px" }}>
        <div className="ctrl-bindings-header" style={{ margin: "-20px -20px 20px -20px" }}>
          <Key size={18} color="var(--accent-cyan)" />
          <span>Identifiants de Connexion API IGDB / Twitch Developer</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Client ID */}
          <div className="ctrl-field">
            <label className="ctrl-label">CLIENT ID (API TWITCH / IGDB)</label>
            <input
              type="text"
              value={creds.clientId}
              onChange={(e) => setCreds({ ...creds, clientId: e.target.value })}
              placeholder="ex: gp762nuuoqmysahi3xr0..."
              className="ctrl-select"
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </div>

          {/* Client Secret */}
          <div className="ctrl-field">
            <label className="ctrl-label">CLIENT SECRET (POUR GÉNÉRATION AUTOMATIQUE DU JETON OAUTH2)</label>
            <input
              type="password"
              value={creds.clientSecret}
              onChange={(e) => setCreds({ ...creds, clientSecret: e.target.value })}
              placeholder="ex: 9k28d7a1q6s..."
              className="ctrl-select"
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          </div>

          {/* Auto fetch checkbox */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <input
              type="checkbox"
              id="autoFetch"
              checked={creds.autoFetchMetadata}
              onChange={(e) => setCreds({ ...creds, autoFetchMetadata: e.target.checked })}
              style={{ accentColor: "var(--accent-cyan)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <label htmlFor="autoFetch" style={{ fontSize: "0.85rem", color: "var(--text-primary)", cursor: "pointer", fontWeight: 600 }}>
              Rechercher automatiquement les jaquettes et informations IGDB lors de l'ajout de nouvelles ROMs
            </label>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.82rem",
                fontWeight: 600,
                background: testResult.success ? "rgba(52, 211, 153, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: testResult.success ? "#34d399" : "#ef4444",
                border: `1px solid ${testResult.success ? "rgba(52, 211, 153, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              }}
            >
              {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
            <button
              className="ctrl-action-btn secondary"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? <RefreshCw size={15} className="spin" /> : <Globe size={15} />}
              {testing ? "Test en cours..." : "Tester la connexion API IGDB"}
            </button>

            <button className="ctrl-action-btn primary" onClick={handleSave}>
              <Save size={15} /> Enregistrer la Configuration IGDB
            </button>
          </div>
        </div>
      </div>

      {/* SQLite Local Database Caching Panel */}
      <div className="ctrl-bindings-panel" style={{ padding: "20px" }}>
        <div className="ctrl-bindings-header" style={{ margin: "-20px -20px 20px -20px" }}>
          <Database size={18} color="var(--accent-cyan)" />
          <span>Base de Données SQLite Locale (Mise en Cache)</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{dbCount} jeux enregistrés dans la BDD SQLite locale</span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)", maxWidth: "520px" }}>
              Les jaquettes, résumés, genres et notes récupérés sont automatiquement conservés en base de données locale afin d'éviter les requêtes API répétitives.
            </p>
          </div>

          <button className="ctrl-action-btn secondary" onClick={handleClearCache} style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "#ef4444" }}>
            <Trash2 size={15} /> Vider la BDD SQLite locale
          </button>
        </div>
      </div>

      {/* Info Help Note */}
      <div className="ctrl-bindings-panel" style={{ padding: "14px 18px", background: "rgba(0, 229, 255, 0.04)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <Info size={18} color="var(--accent-cyan)" style={{ marginTop: "2px", flexShrink: 0 }} />
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            <strong style={{ color: "#ffffff" }}>Comment obtenir vos identifiants IGDB gratuit ?</strong>
            <br />
            1. Connectez-vous sur <a href="https://dev.twitch.tv/console" target="_blank" rel="noreferrer" style={{ color: "var(--accent-cyan)", textDecoration: "underline" }}>Twitch Developer Console</a>.
            <br />
            2. Créez une application gratuite.
            <br />
            3. Le champ URL de redirection OAuth n'est pas utilisé par IGDB. Veuillez ajouter "https://localhost" et choisir "confidentiel" en type de client.
            <br />
            4. Copiez votre <code>Client ID</code> et <code>Client Secret</code>.
          </div>
        </div>
      </div>
    </div>
  );
};
