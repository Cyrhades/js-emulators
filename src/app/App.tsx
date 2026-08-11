import React, { useEffect } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { AppRoutes } from "./routes";
import { initConsoleRegistry } from "../emulator/initRegistry";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { FocusProvider } from "../context/FocusContext";
import { romScannerService } from "../services/RomScannerService";
import { emulatorManager } from "../emulator/EmulatorManager";
import { inputManager } from "../emulator/InputManager";
import { audioManager } from "../emulator/AudioManager";

// Initialize registry with available and future consoles
initConsoleRegistry();

const AppContent: React.FC = () => {
  useGamepadNavigation();
  const location = useLocation();

  // Restore previously granted ROM folder permissions and scan on startup
  useEffect(() => {
    romScannerService.restoreAndScanAll().catch((err) =>
      console.error("[RomScanner] restoreAndScanAll failed:", err)
    );
  }, []);

  // Guarantee emulation and audio are cleanly stopped whenever leaving /play
  useEffect(() => {
    if (!location.pathname.startsWith("/play")) {
      inputManager.stopListening();
      emulatorManager.stop();
      audioManager.clear();
    }
  }, [location.pathname]);

  return (
    <>
      <Header />
      <main className="main-content">
        <AppRoutes />
      </main>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <FocusProvider>
        <AppContent />
      </FocusProvider>
    </BrowserRouter>
  );
};

export default App;
