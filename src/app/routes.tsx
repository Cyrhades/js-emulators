import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ConsoleSelector } from "../components/console/ConsoleSelector";
import { GameLibraryView } from "../components/game/GameLibraryView";
import { EmulatorViewPage } from "../components/emulator/EmulatorViewPage";
import { SettingsPage } from "../components/settings/SettingsPage";

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/consoles" replace />} />
      <Route path="/consoles" element={<ConsoleSelector />} />
      <Route path="/console/:consoleId" element={<GameLibraryView />} />
      <Route path="/play/:consoleId/:gameId" element={<EmulatorViewPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/:tab" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/consoles" replace />} />
    </Routes>
  );
};
