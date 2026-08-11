import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ControllerSettings } from "./ControllerSettings";
import { SystemStorageSettings } from "./SystemStorageSettings";
import { IgdbSettings } from "./IgdbSettings";
import { useConsoleWallpaper } from "../../hooks/useConsoleWallpaper";
import { Gamepad2, Monitor, Volume2, HardDrive, ArrowLeft, Settings, Globe } from "lucide-react";

const MENU_ITEMS = [
  { id: "controllers", label: "Gestion des Manettes", icon: Gamepad2 },
  { id: "display", label: "Affichage & Vidéo", icon: Monitor },
  { id: "audio", label: "Audio", icon: Volume2 },
  { id: "system", label: "Stockage & Système", icon: HardDrive },
  { id: "igdb", label: "API IGDB.com", icon: Globe },
];

export const SettingsPage: React.FC = () => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const activeTab = tab || "controllers";
  const wallpaperUrl = useConsoleWallpaper("atari2600");

  const handleTabChange = (tabId: string) => {
    navigate(`/settings/${tabId}`);
  };

  return (
    <div style={{ width: "100%", position: "relative" }}>
      {/* Immersive Wallpaper background */}
      <div className="bg-wallpaper-container">
        {wallpaperUrl && (
          <img key={wallpaperUrl} src={wallpaperUrl} alt="" className="bg-wallpaper-image" />
        )}
        <div className="bg-wallpaper-overlay" />
      </div>

      {/* Header */}
      <div className="settings-header">
        <button onClick={() => navigate("/consoles")} className="settings-back-btn">
          <ArrowLeft size={18} />
        </button>
        <div className="settings-header-text">
          <div className="settings-header-icon">
            <Settings size={24} color="var(--accent-cyan)" />
          </div>
          <div>
            <h1 className="settings-title">Paramètres</h1>
            <p className="settings-subtitle">
              Configuration des contrôleurs, affichage, audio, système et API IGDB
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="settings-layout">
        {/* Left Sidebar */}
        <nav className="settings-sidebar">
          <div className="settings-sidebar-label">CONFIGURATION</div>
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`settings-menu-item ${isActive ? "active" : ""}`}
                onClick={() => handleTabChange(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {isActive && <div className="settings-menu-indicator" />}
              </button>
            );
          })}
        </nav>

        {/* Right Content */}
        <div className="settings-content">
          {activeTab === "controllers" && <ControllerSettings />}

          {activeTab === "display" && (
            <div className="settings-placeholder-panel">
              <Monitor size={48} color="var(--accent-cyan)" />
              <h3>Affichage & Vidéo</h3>
              <p>
                Filtres CRT scanline, ratio d'aspect 4:3, lissage bilinéaire et résolution d'affichage.
              </p>
              <span className="settings-coming-soon">BIENTÔT DISPONIBLE</span>
            </div>
          )}

          {activeTab === "audio" && (
            <div className="settings-placeholder-panel">
              <Volume2 size={48} color="var(--accent-cyan)" />
              <h3>Audio</h3>
              <p>
                Volume master, fréquence d'échantillonnage et latence Web Audio API.
              </p>
              <span className="settings-coming-soon">BIENTÔT DISPONIBLE</span>
            </div>
          )}

          {activeTab === "system" && <SystemStorageSettings />}

          {activeTab === "igdb" && <IgdbSettings />}
        </div>
      </div>
    </div>
  );
};
