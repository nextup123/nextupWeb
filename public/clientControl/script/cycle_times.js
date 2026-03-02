// cycle_times.js
document.addEventListener('DOMContentLoaded', async () => {
  const lastCycleEl = document.getElementById('last-cycle-time');
  const avg5El = document.getElementById('avg-5');
  const avg15El = document.getElementById('avg-15');

  let ros, cycleTopic;
  let lastTimestamp = null;

  // Circular buffers for last 5 and 15 cycle times
  const recent5 = [];
  const recent15 = [];
  let sum5 = 0;
  let sum15 = 0;

  // Utility to maintain rolling average efficiently
  function pushToBuffer(buffer, newValue, maxSize, currentSum) {
    if (buffer.length >= maxSize) {
      currentSum -= buffer.shift(); // remove oldest
    }
    buffer.push(newValue);
    currentSum += newValue;
    return currentSum;
  }

  // ROS setup
  function connectROS() {
    ros = new ROSLIB.Ros({
      url: 'ws://localhost:9090'
    });

    ros.on('connection', () => console.log('🟢 Connected to ROS bridge for cycle times'));
    ros.on('error', err => console.error('🔴 ROS error:', err));
    ros.on('close', () => console.warn('🟠 ROS connection closed (cycle_times)'));

    cycleTopic = new ROSLIB.Topic({
      ros,
      name: '/cycle_count',
      messageType: 'std_msgs/msg/Int32'
    });

    cycleTopic.subscribe(() => handleCycleTime());
  }

  // Core timing logic
  function handleCycleTime() {
    const now = Date.now();

    if (lastTimestamp !== null) {
      const deltaSec = (now - lastTimestamp) / 1000;

      // Ignore unrealistic or stale cycle (>300s)
      if (deltaSec < 300) {
        // Update last cycle
        lastCycleEl.textContent = deltaSec.toFixed(3);

        // Push into rolling averages
        sum5 = pushToBuffer(recent5, deltaSec, 5, sum5);
        sum15 = pushToBuffer(recent15, deltaSec, 15, sum15);

        const avg5 = sum5 / recent5.length;
        const avg15 = sum15 / recent15.length;

        avg5El.textContent = avg5.toFixed(3);
        avg15El.textContent = avg15.toFixed(3);
      } else {
        console.warn(`⏱️ Ignored stale cycle (${deltaSec.toFixed(2)}s)`);
      }
    }

    lastTimestamp = now;
  }

  connectROS();
});
