// joint_status.js
document.addEventListener('DOMContentLoaded', () => {
  // ✅ Reuse global ros connection (from script.js)
  if (typeof ros === 'undefined' || !ros) {
    console.error('❌ ROS connection not found. Make sure script.js initializes it first.');
    return;
  }

  const jointIndicators = Array.from({ length: 6 }, (_, i) =>
    document.getElementById(`joint${i + 1}`)
  );
  const overallIndicator = document.getElementById('joint-overall-indicator');

  // Expected joint order for UI
  const jointOrder = ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'];

  // 🧠 Subscribe to /nextup_driver_status
  window.addEventListener("message", (event) => {
    const msg = event.data;

    if (msg.type !== "JOINT_STATUS") return;

    handleJointStatus(msg.payload);
  });

  function handleJointStatus(msg) {
    if (!msg.name || !msg.op_status) return;

    const jointOrder = ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'];

    const jointOps = jointOrder.map(jointName => {
      const index = msg.name.indexOf(jointName);
      return index !== -1 ? Boolean(msg.op_status[index]) : false;
    });

    let allActive = true;

    jointOps.forEach((active, i) => {
      const el = document.getElementById(`joint${i + 1}`);
      if (!el) return;

      el.classList.toggle('green', active);
      el.classList.toggle('red', !active);

      if (!active) allActive = false;
    });

    window.allJointsOp = allActive;

    const overallIndicator = document.getElementById('joint-overall-indicator');
    if (overallIndicator) {
      overallIndicator.classList.toggle('green', allActive);
      overallIndicator.classList.toggle('red', !allActive);
      overallIndicator.title = allActive
        ? 'All joints OPERATION_ENABLED'
        : 'One or more joints not operational';
    }
  }
  // console.log('✅ Joint status listener active (waiting for /nextup_driver_status)');
});
