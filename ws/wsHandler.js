// ws/wsHandlers.js

function createWSHandler({ ros }) {
  return function handleMessage(msg, ws) {

    switch (msg.type) {

      case "MOVE_FORWARD":
        ros.publishMove(msg.payload);
        break;

      case "START_SERVO":
        ros.startServo();
        break;

      default:
        console.warn("Unknown WS message:", msg);
    }
  };
}

module.exports = { createWSHandler };