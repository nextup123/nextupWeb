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
  const driverStatusTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/nextup_driver_status',
    messageType: 'nextup_joint_interfaces/msg/NextupDriverStatus'
  });

  driverStatusTopic.subscribe((msg) => {
    if (!msg.name || !msg.op_status) return;

    // Map op_status[] into fixed joint order
    const jointOps = jointOrder.map(jointName => {
      const index = msg.name.indexOf(jointName);
      return index !== -1 ? Boolean(msg.op_status[index]) : false;
    });

    // Update individual joint indicators
    let allActive = true;

    jointOps.forEach((active, i) => {
      const el = jointIndicators[i];
      if (!el) return;

      el.classList.toggle('green', active);
      el.classList.toggle('red', !active);

      if (!active) allActive = false;
    });

    // ✅ UPDATE GLOBAL VARIABLE
    allJointsOp = allActive;

    // Update overall indicator
    overallIndicator.classList.toggle('green', allActive);
    overallIndicator.classList.toggle('red', !allActive);
    overallIndicator.title = allActive
      ? 'All joints OPERATION_ENABLED'
      : 'One or more joints not operational';

    // console.log('allJointsOp =', allJointsOp);
  });

  // console.log('✅ Joint status listener active (waiting for /nextup_driver_status)');
});
