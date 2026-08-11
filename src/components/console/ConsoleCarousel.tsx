import React, { useState, useEffect } from "react";
import { ConsoleDefinition } from "../../emulator/types";
import { ChevronLeft, ChevronRight, Gamepad2, Lock } from "lucide-react";
import { useFocus } from "../../context/FocusContext";

interface ConsoleCarouselProps {
  consoles: ConsoleDefinition[];
  onSelectConsole: (consoleDef: ConsoleDefinition) => void;
  onActiveConsoleChange: (consoleDef: ConsoleDefinition) => void;
}

const GRADIENT_MAP: Record<string, string> = {
  atari2600: "#7c4dff, #311b92",
  nes: "#e53935, #880e4f",
  snes: "#5c6bc0, #1a237e",
  gb: "#66bb6a, #1b5e20",
  md: "#ff7043, #bf360c",
  sms: "#29b6f6, #01579b",
  gg: "#26c6da, #006064",
};

export const ConsoleCarousel: React.FC<ConsoleCarouselProps> = ({
  consoles,
  onSelectConsole,
  onActiveConsoleChange,
}) => {
  const [activeIndex, setActiveIndex] = useState(() => {
    const savedId = localStorage.getItem("last_selected_console_id");
    if (savedId && consoles.length > 0) {
      const idx = consoles.findIndex((c) => c.id === savedId);
      if (idx !== -1) return idx;
    }
    return 0;
  });
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  const { activeZone, setActiveZone } = useFocus();
  const isCarouselZone = activeZone === "carousel";

  const activeConsole = consoles[activeIndex] || consoles[0];

  useEffect(() => {
    if (activeConsole?.id) {
      localStorage.setItem("last_selected_console_id", activeConsole.id);
      onActiveConsoleChange(activeConsole);
    }
  }, [activeIndex, activeConsole]);

  // Keyboard/Gamepad navigation when carousel zone is active
  useEffect(() => {
    if (!isCarouselZone) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : consoles.length - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveIndex((prev) => (prev < consoles.length - 1 ? prev + 1 : 0));
      } else if (e.key === "Enter" && activeConsole) {
        e.preventDefault();
        onSelectConsole(activeConsole);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCarouselZone, consoles, activeConsole, onSelectConsole]);

  const handlePrev = () => {
    setActiveZone("carousel");
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : consoles.length - 1));
  };

  const handleNext = () => {
    setActiveZone("carousel");
    setActiveIndex((prev) => (prev < consoles.length - 1 ? prev + 1 : 0));
  };

  const handleImageError = (consoleId: string) => {
    setImageErrorMap((prev) => ({ ...prev, [consoleId]: true }));
  };

  return (
    <div className="carousel-wrapper">
      {/* 3D Carousel Stage */}
      <div className={`carousel-stage ${isCarouselZone ? "zone-focused" : ""}`}>
        <button className="nav-arrow" onClick={handlePrev} title="Console Précédente">
          <ChevronLeft size={24} />
        </button>

        <div className="carousel-track">
          {consoles.map((c, index) => {
            const isActive = index === activeIndex;
            const thumbnailUrl = `/emulators/${c.id}/thumbnail.png`;
            const hasError = imageErrorMap[c.id];
            const gradientColors = GRADIENT_MAP[c.id] || "#26c6da, #006064";

            return (
              <div
                key={c.id}
                className={`carousel-card ${isActive ? "active" : "inactive"} ${
                  isActive && isCarouselZone ? "focused" : ""
                }`}
                onClick={() => {
                  setActiveZone("carousel");
                  setActiveIndex(index);
                  if (isActive) onSelectConsole(c);
                }}
              >
                {!hasError ? (
                  <img
                    src={thumbnailUrl}
                    alt={c.name}
                    className="card-bg-image"
                    onError={() => handleImageError(c.id)}
                  />
                ) : (
                  <div
                    className="card-bg-image card-bg-fallback"
                    style={{ background: `linear-gradient(135deg, ${gradientColors})` }}
                  >
                    <Gamepad2 size={64} color="rgba(255,255,255,0.3)" />
                  </div>
                )}

                <div className="card-gradient-overlay" />

                <div className="card-content">
                  <div className="card-title">{c.name}</div>

                  {c.isAvailable ? (
                    <button
                      className="card-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveZone("carousel");
                        onSelectConsole(c);
                      }}
                    >
                      JOUER
                    </button>
                  ) : (
                    <button className="card-action-btn disabled">
                      <Lock size={12} /> BIENTÔT
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button className="nav-arrow" onClick={handleNext} title="Console Suivante">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Pagination Dots */}
      <div className="pagination-dots">
        {consoles.map((c, idx) => (
          <div
            key={c.id}
            className={`dot ${idx === activeIndex ? "active" : ""}`}
            onClick={() => {
              setActiveZone("carousel");
              setActiveIndex(idx);
            }}
          />
        ))}
      </div>
    </div>
  );
};
