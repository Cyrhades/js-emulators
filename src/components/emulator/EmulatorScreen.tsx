import React, { useEffect, useRef } from "react";
import { Emulator, EmulatorStatus } from "../../emulator/types";
import { Pause, Play, AlertCircle, Loader } from "lucide-react";

interface EmulatorScreenProps {
  emulator: Emulator | null;
  status: EmulatorStatus;
  error?: string;
  onScreenClick?: () => void;
}

export const EmulatorScreen: React.FC<EmulatorScreenProps> = ({
  emulator,
  status,
  error,
  onScreenClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !emulator) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      if (status === EmulatorStatus.Running || status === EmulatorStatus.Paused) {
        const video = emulator.getVideoOutput();

        if (canvas.width !== video.width) canvas.width = video.width;
        if (canvas.height !== video.height) canvas.height = video.height;

        try {
          const imgData = ctx.createImageData(video.width, video.height);
          imgData.data.set(video.buffer);
          ctx.putImageData(imgData, 0, 0);
        } catch (e) {
          // ignore rendering frame glitches
        }
      }

      if (status === EmulatorStatus.Running) {
        animFrameIdRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animFrameIdRef.current !== null) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [emulator, status]);

  return (
    <div
      ref={containerRef}
      className="screen-container"
      onClick={onScreenClick}
    >
      <canvas ref={canvasRef} className="screen-canvas" />

      {/* Overlay Statuses */}
      {status === EmulatorStatus.Paused && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          <Pause size={48} color="var(--accent-secondary)" style={{ marginBottom: "12px" }} />
          <span style={{ fontSize: "1.2rem", fontWeight: 700, letterSpacing: "1px" }}>ÉMULATION EN PAUSE</span>
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Cliquez sur l'écran pour reprendre
          </span>
        </div>
      )}

      {status === EmulatorStatus.Loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          <Loader size={48} className="spin" color="var(--accent-primary)" style={{ marginBottom: "12px" }} />
          <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>Chargement de la ROM...</span>
        </div>
      )}

      {status === EmulatorStatus.Error && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(30, 10, 10, 0.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#ff4d4f",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <AlertCircle size={48} style={{ marginBottom: "12px" }} />
          <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>Erreur d'Émulation</span>
          <p style={{ fontSize: "0.9rem", color: "#ffa39e", marginTop: "8px" }}>{error}</p>
        </div>
      )}
    </div>
  );
};
