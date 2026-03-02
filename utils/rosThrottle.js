// utils/throttle.js
function throttleHz(hz, callback) {
  const intervalMs = 1000 / hz;
  let lastTime = 0;

  return (msg) => {
    const now = Date.now();
    if (now - lastTime < intervalMs) {
      return; // DROP message
    }
    lastTime = now;
    callback(msg);
  };
}

module.exports = throttleHz;
