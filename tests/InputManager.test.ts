import { describe, it, expect, beforeEach, vi } from "vitest";
import { InputManager } from "../src/emulator/InputManager";
import { ControlBinding } from "../src/emulator/types";

describe("InputManager", () => {
  let inputManager: InputManager;
  const sampleBindings: ControlBinding[] = [
    { id: "up", name: "Haut", defaultKey: "ArrowUp" },
    { id: "fire", name: "Tir", defaultKey: "Space" },
  ];

  beforeEach(() => {
    inputManager = new InputManager();
    inputManager.setBindings(sampleBindings);
  });

  it("should set key bindings and initialize state to false", () => {
    const activeState = inputManager.getActiveState();
    expect(activeState["up"]).toBe(false);
    expect(activeState["fire"]).toBe(false);
  });

  it("should trigger callback when key is pressed", () => {
    const callback = vi.fn();
    inputManager.startListening(callback);

    const event = new KeyboardEvent("keydown", { code: "ArrowUp" });
    window.dispatchEvent(event);

    expect(callback).toHaveBeenCalledWith({
      buttons: expect.objectContaining({ up: true, fire: false }),
    });

    inputManager.stopListening();
  });
});
