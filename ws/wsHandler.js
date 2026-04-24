
// backend - wsHandler.js
function createWSHandler({ ros, wsServer }) {
  return async function handleMessage(msg, ws) {

    if (!msg || typeof msg.type !== "string") {
      console.warn("Invalid WS message:", msg);
      return;
    }

    try {
      switch (msg.type) {

        // ── Motion / Servo ─────────────────────────────────────────
        case "MOVE_FORWARD":
          ros?.publishMove?.(msg.payload);
          break;

        case "START_SERVO": {
          const result = await ros.startServo();
          wsServer.sendTo(ws, {
            type: "SERVO_RESPONSE",
            payload: result,
          });
          break;
        }

        // ── UI COMMANDS ────────────────────────────────────────────
        case "UI_COMMANDS": {
          const { command, value } = msg.payload || {};

          if (!command) {
            console.warn("UI_COMMANDS missing command");
            break;
          }

          const handlers = {
            home: () => ros.publishUiCommand("home"),

            change_mode: () =>
              ros.publishStringTopic("/change_mode", String(value)),

            control_start_bt: () =>
              ros.publishBoolTopic("/control_start_bt", Boolean(value)),

            control_reset_bt: () =>
              ros.publishBoolTopic("/control_reset_bt", Boolean(value)),

            process_control: () =>
              ros.publishProcessControl(String(value)),

            set_speed: () =>
              ros.publishSpeedScale(parseFloat(value)),

            select_cnc: () =>
              ros.publishCNCSelection(String(value)),
          };

          if (handlers[command]) {
            handlers[command]();
          } else {
            // fallback
            ros?.publishUiCommand?.(command);
          }

          break;
        }

        case "CHANGE_MODE": {
          const { mode } = msg.payload || {};

          if (!mode || !["auto", "jog"].includes(mode)) {
            console.warn("Invalid mode:", mode);
            break;
          }

          ros?.publishChangeMode(mode);   // ✅ clean call
          break;
        }

        // ── Motion pipeline ────────────────────────────────────────
        case "MOTION_COMMAND":
          ros?.publishMotionCommand?.(msg.payload?.command);
          break;

        case "START_MOTION":
          ros?.publishMotionStart?.(true);
          break;

        case "AUTO_GENERATE_XML":
          ros?.publishAutoGenerateXML?.(msg.payload?.data);
          break;

        case "AUTO_GENERATE_SEQUENCE":
          ros?.publishAutoGenerateSequence?.(msg.payload?.data);
          break;

        case "LOG_MESSAGE":
          ros?.publishLogMessage?.(msg.payload?.data);
          break;

        // ── DIGITAL OUTPUT ─────────────────────────────────────────
        case "TOGGLE_DO": {
          const { driver, doId, state } = msg.payload || {};

          if (
            typeof driver !== "number" ||
            typeof doId !== "number" ||
            typeof state !== "boolean"
          ) {
            console.warn("Invalid DO payload:", msg.payload);
            wsServer.sendTo(ws, {
              type: "ERROR",
              payload: "Invalid DO payload",
            });
            break;
          }

          ros?.publishDO?.(driver, doId, state);
          break;
        }

        // ── SAFETY ─────────────────────────────────────────────────
        case "EMERGENCY_TRIGGER":
          ros?.triggerEmergency?.();
          break;

        case "RESET_FAULT":
          ros?.resetFault?.();
          break;

        case "MONITORING_START": {
          const result = await ros.callMonitoringStart();
          wsServer.sendTo(ws, {
            type: "MONITORING_RESPONSE",
            payload: { action: "start", success: result?.success || false }
          });
          break;
        }

        case "MONITORING_STOP": {
          const result = await ros.callMonitoringStop();
          wsServer.sendTo(ws, {
            type: "MONITORING_RESPONSE",
            payload: { action: "stop", success: result?.success || false }
          });
          break;
        }
        // ── HEARTBEAT ──────────────────────────────────────────────
        case "PING":
          wsServer.sendTo(ws, {
            type: "PONG",
            payload: "alive",
            timestamp: Date.now(),
          });
          break;

        default:
          console.warn("Unknown WS message:", msg.type);
      }

    } catch (err) {
      console.error("WS handler error:", err);

      wsServer.sendTo(ws, {
        type: "ERROR",
        payload: err.message || "Internal server error",
      });
    }
  };
}

export { createWSHandler };

