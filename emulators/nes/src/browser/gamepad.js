export default class GamepadController {
  constructor(options) {
    this.onButtonDown = options.onButtonDown;
    this.onButtonUp = options.onButtonUp;
    this.gamepadState = [];
    this.buttonCallback = null;
  }

  disableIfGamepadEnabled = (callback) => {
    var self = this;
    return (playerId, buttonId) => {
      if (!self.gamepadConfig) {
        return callback(playerId, buttonId);
      }

      var playerGamepadId = self.gamepadConfig.playerGamepadId;
      if (!playerGamepadId || !playerGamepadId[playerId - 1]) {
        // allow callback only if player is not associated to any gamepad
        return callback(playerId, buttonId);
      }
    };
  };

  _getPlayerNumberFromGamepad = (gamepad, allGamepads) => {
    if (!this.gamepadConfig || !this.gamepadConfig.playerGamepadId) {
      return null;
    }

    const p1Id = this.gamepadConfig.playerGamepadId[0];
    const p2Id = this.gamepadConfig.playerGamepadId[1];

    const isMatch = (targetId, gp) => {
      if (!targetId || targetId === "keyboard") return false;

      // 1. Exact index + id match (ex: "idx:1|Xbox 360 Controller")
      if (
        targetId === `idx:${gp.index}|${gp.id}` ||
        targetId === `idx:${gp.index}`
      ) {
        return true;
      }

      // 2. Index + model ID string parsing
      if (targetId.startsWith("idx:")) {
        const parts = targetId.split("|");
        const targetIndex = parseInt(parts[0].replace("idx:", ""), 10);
        const targetModel = parts[1];

        if (gp.index === targetIndex) return true;

        // Fallback if the saved index is unplugged/rearranged but model matches
        if (
          targetModel &&
          gp.id === targetModel &&
          allGamepads &&
          !allGamepads.some((g) => g && g.index === targetIndex)
        ) {
          return true;
        }
        return false;
      }

      // 3. Simple model id match (legacy fallback)
      if (targetId === gp.id) {
        return true;
      }

      return false;
    };

    if (isMatch(p1Id, gamepad)) {
      return 1;
    }

    if (isMatch(p2Id, gamepad)) {
      return 2;
    }

    return null;
  };

  poll = () => {
    const rawGamepads = navigator.getGamepads
      ? navigator.getGamepads()
      : navigator.webkitGetGamepads
        ? navigator.webkitGetGamepads()
        : [];

    const gamepads = [];
    for (let i = 0; i < rawGamepads.length; i++) {
      if (rawGamepads[i] && rawGamepads[i].connected) {
        gamepads.push(rawGamepads[i]);
      }
    }

    const usedPlayers = [];

    for (let gamepadIndex = 0; gamepadIndex < gamepads.length; gamepadIndex++) {
      const gamepad = gamepads[gamepadIndex];
      const previousGamepad =
        this.gamepadState[gamepad.index] || this.gamepadState[gamepadIndex];

      if (!gamepad) {
        continue;
      }

      if (!previousGamepad) {
        this.gamepadState[gamepad.index] = gamepad;
        continue;
      }

      const buttons = gamepad.buttons;
      const previousButtons = previousGamepad.buttons;

      if (this.buttonCallback) {
        for (let code = 0; code < gamepad.axes.length; code++) {
          const axis = gamepad.axes[code];
          const previousAxis = previousGamepad.axes[code];

          if (axis === -1 && previousAxis !== -1) {
            this.buttonCallback({
              gamepadId: gamepad.id,
              type: "axis",
              code: code,
              value: axis,
            });
          }

          if (axis === 1 && previousAxis !== 1) {
            this.buttonCallback({
              gamepadId: gamepad.id,
              type: "axis",
              code: code,
              value: axis,
            });
          }
        }

        for (let code = 0; code < buttons.length; code++) {
          const button = buttons[code];
          const previousButton = previousButtons[code];
          if (button.pressed && !previousButton.pressed) {
            this.buttonCallback({
              gamepadId: gamepad.id,
              type: "button",
              code: code,
            });
          }
        }
      } else if (this.gamepadConfig) {
        const playerNumber = this._getPlayerNumberFromGamepad(
          gamepad,
          gamepads,
        );

        if (playerNumber !== null && usedPlayers.indexOf(playerNumber) === -1) {
          usedPlayers.push(playerNumber);

          const configKey = this.gamepadConfig.configs[gamepad.id]
            ? gamepad.id
            : Object.keys(this.gamepadConfig.configs).find((k) =>
                k.includes(gamepad.id),
              );

          if (configKey && this.gamepadConfig.configs[configKey]) {
            const configButtons = this.gamepadConfig.configs[configKey].buttons;

            for (let i = 0; i < configButtons.length; i++) {
              const configButton = configButtons[i];
              if (configButton.type === "button") {
                const code = configButton.code;
                const button = buttons[code];
                const previousButton = previousButtons[code];

                if (button && previousButton) {
                  if (button.pressed && !previousButton.pressed) {
                    this.onButtonDown(playerNumber, configButton.buttonId);
                  } else if (!button.pressed && previousButton.pressed) {
                    this.onButtonUp(playerNumber, configButton.buttonId);
                  }
                }
              } else if (configButton.type === "axis") {
                const code = configButton.code;
                const axis = gamepad.axes[code];
                const previousAxis = previousGamepad.axes[code];

                if (axis !== undefined && previousAxis !== undefined) {
                  if (
                    axis === configButton.value &&
                    previousAxis !== configButton.value
                  ) {
                    this.onButtonDown(playerNumber, configButton.buttonId);
                  }

                  if (
                    axis !== configButton.value &&
                    previousAxis === configButton.value
                  ) {
                    this.onButtonUp(playerNumber, configButton.buttonId);
                  }
                }
              }
            }
          }
        }
      }

      this.gamepadState[gamepad.index] = {
        buttons: buttons.map((b) => {
          return { pressed: b.pressed };
        }),
        axes: gamepad.axes.slice(0),
      };
    }
  };

  promptButton = (f) => {
    if (!f) {
      this.buttonCallback = f;
    } else {
      this.buttonCallback = (buttonInfo) => {
        this.buttonCallback = null;
        f(buttonInfo);
      };
    }
  };

  loadGamepadConfig = () => {
    var gamepadConfig;
    try {
      gamepadConfig = localStorage.getItem("gamepadConfig");
      if (gamepadConfig) {
        gamepadConfig = JSON.parse(gamepadConfig);
      }
    } catch (e) {
      console.warn("Failed to get gamepadConfig from localStorage.", e);
    }

    this.gamepadConfig = gamepadConfig;
  };

  setGamepadConfig = (gamepadConfig) => {
    try {
      localStorage.setItem("gamepadConfig", JSON.stringify(gamepadConfig));
      this.gamepadConfig = gamepadConfig;
    } catch (e) {
      console.warn("Failed to set gamepadConfig in localStorage.", e);
    }
  };

  startPolling = () => {
    if (!(navigator.getGamepads || navigator.webkitGetGamepads)) {
      return { stop: () => {} };
    }

    let stopped = false;
    const loop = () => {
      if (stopped) return;

      this.poll();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    return {
      stop: () => {
        stopped = true;
      },
    };
  };
}
