import { useEffect, useRef } from "react";

/**
 * Mapping des boutons standard d'une manette (Standard Gamepad layout)
 * https://w3c.github.io/gamepad/#remapping
 *
 *  0 = A (bas)        → Confirmer / Entrée
 *  1 = B (droite)     → Retour / Échap
 *  2 = X (gauche)
 *  3 = Y (haut)
 *  4 = L1             → Tab précédent
 *  5 = R1             → Tab suivant
 *  8 = Select / Back
 *  9 = Start          → Entrée
 * 12 = D-pad Haut
 * 13 = D-pad Bas
 * 14 = D-pad Gauche
 * 15 = D-pad Droite
 *
 * Axes:
 *  axis[0] = stick gauche X (-1 gauche, +1 droite)
 *  axis[1] = stick gauche Y (-1 haut, +1 bas)
 */

const BUTTON_MAP: Record<number, string> = {
  0: "Enter",        // A → Confirmer
  1: "Escape",       // B → Retour
  4: "PageUp",       // L1 → Tab précédent
  5: "PageDown",     // R1 → Tab suivant
  9: "Enter",        // Start → Confirmer
  12: "ArrowUp",     // D-pad Haut
  13: "ArrowDown",   // D-pad Bas
  14: "ArrowLeft",   // D-pad Gauche
  15: "ArrowRight",  // D-pad Droite
};

const AXIS_THRESHOLD = 0.5;
const REPEAT_DELAY_MS = 220;

interface AxisState {
  x: string | null;
  y: string | null;
}

/**
 * Hook global qui convertit les entrées manette en événements clavier synthétiques.
 * Ainsi, TOUS les gestionnaires `keydown` existants (carrousel, settings, etc.)
 * réagissent automatiquement à la manette sans aucune modification.
 */
export function useGamepadNavigation(): void {
  const rafRef = useRef<number>(0);
  const prevButtonsRef = useRef<Record<number, boolean>>({});
  const repeatTimerRef = useRef<Record<number, number>>({});
  const prevAxisRef = useRef<AxisState>({ x: null, y: null });
  const axisRepeatRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const dispatchKey = (key: string) => {
      const event = new KeyboardEvent("keydown", {
        key,
        code: key,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(event);
    };

    const poll = () => {
      // Pause gamepad UI navigation when:
      // - Inside an emulator game page (/play/...)
      // - Inside controller settings page (/settings)
      // - Body dataset.disableGamepadNav is set (e.g. remapping modal active)
      if (
        window.location.pathname.startsWith("/play") ||
        window.location.pathname.startsWith("/settings") ||
        document.body.dataset.disableGamepadNav === "true"
      ) {
        rafRef.current = requestAnimationFrame(poll);
        return;
      }

      const gamepads = navigator.getGamepads?.() || [];

      for (const gp of gamepads) {
        if (!gp) continue;

        const now = performance.now();

        // --- Buttons ---
        for (const [btnIdx, keyName] of Object.entries(BUTTON_MAP)) {
          const idx = Number(btnIdx);
          const btn = gp.buttons[idx];
          if (!btn) continue;

          const pressed = btn.pressed || btn.value > 0.5;
          const wasPressed = prevButtonsRef.current[idx] || false;

          if (pressed && !wasPressed) {
            // Initial press
            dispatchKey(keyName);
            repeatTimerRef.current[idx] = now;
          } else if (pressed && wasPressed) {
            // Repeat after delay
            const elapsed = now - (repeatTimerRef.current[idx] || 0);
            if (elapsed > REPEAT_DELAY_MS) {
              dispatchKey(keyName);
              repeatTimerRef.current[idx] = now;
            }
          }

          prevButtonsRef.current[idx] = pressed;
        }

        // --- Axes (Stick gauche) ---
        const axisX = gp.axes[0] || 0;
        const axisY = gp.axes[1] || 0;

        let xKey: string | null = null;
        let yKey: string | null = null;

        if (axisX < -AXIS_THRESHOLD) xKey = "ArrowLeft";
        else if (axisX > AXIS_THRESHOLD) xKey = "ArrowRight";

        if (axisY < -AXIS_THRESHOLD) yKey = "ArrowUp";
        else if (axisY > AXIS_THRESHOLD) yKey = "ArrowDown";

        // X axis
        if (xKey && xKey !== prevAxisRef.current.x) {
          dispatchKey(xKey);
          axisRepeatRef.current["x"] = now;
        } else if (xKey && xKey === prevAxisRef.current.x) {
          const elapsed = now - (axisRepeatRef.current["x"] || 0);
          if (elapsed > REPEAT_DELAY_MS) {
            dispatchKey(xKey);
            axisRepeatRef.current["x"] = now;
          }
        }

        // Y axis
        if (yKey && yKey !== prevAxisRef.current.y) {
          dispatchKey(yKey);
          axisRepeatRef.current["y"] = now;
        } else if (yKey && yKey === prevAxisRef.current.y) {
          const elapsed = now - (axisRepeatRef.current["y"] || 0);
          if (elapsed > REPEAT_DELAY_MS) {
            dispatchKey(yKey);
            axisRepeatRef.current["y"] = now;
          }
        }

        prevAxisRef.current = { x: xKey, y: yKey };

        // Only process first connected gamepad
        break;
      }

      rafRef.current = requestAnimationFrame(poll);
    };

    rafRef.current = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
