import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export type FocusZone = "header" | "carousel" | "previews";

interface FocusContextType {
  activeZone: FocusZone;
  setActiveZone: (zone: FocusZone) => void;
  headerIndex: number;
  setHeaderIndex: (idx: number | ((prev: number) => number)) => void;
  previewIndex: number;
  setPreviewIndex: (idx: number | ((prev: number) => number)) => void;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

export const FocusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeZone, setActiveZone] = useState<FocusZone>("carousel");
  const [headerIndex, setHeaderIndex] = useState<number>(0);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable UI focus navigation when inside an emulator game page (/play/...)
      if (window.location.pathname.startsWith("/play")) {
        return;
      }

      // Don't intercept if user is typing in an input or select
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "SELECT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (activeZone === "previews") {
          setActiveZone("carousel");
        } else if (activeZone === "carousel") {
          setActiveZone("header");
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (activeZone === "header") {
          setActiveZone("carousel");
        } else if (activeZone === "carousel") {
          setActiveZone("previews");
        }
      } else if (activeZone === "header") {
        const hasGgBtn = !!document.getElementById("game-genie-header-btn");
        const maxIdx = hasGgBtn ? 2 : 1;

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setHeaderIndex((prev) => (prev > 0 ? prev - 1 : maxIdx));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          setHeaderIndex((prev) => (prev < maxIdx ? prev + 1 : 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          // Trigger action for header item
          if (headerIndex === 0) navigate("/consoles");
          else if (headerIndex === 1) navigate("/settings");
          else if (headerIndex === 2) document.getElementById("game-genie-header-btn")?.click();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeZone, headerIndex, navigate]);

  return (
    <FocusContext.Provider
      value={{
        activeZone,
        setActiveZone,
        headerIndex,
        setHeaderIndex,
        previewIndex,
        setPreviewIndex,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
};

export const useFocus = (): FocusContextType => {
  const ctx = useContext(FocusContext);
  if (!ctx) {
    throw new Error("useFocus must be used within a FocusProvider");
  }
  return ctx;
};
