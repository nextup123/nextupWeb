// ===================== HOMING ONLY (5 Hz FIXED RATE) =====================

// Parent LED (all joints homed)
const robotLedHoming = document.getElementById('robot-led-homing');

// Individual joint LEDs
const homingLeds = Array.from({ length: 6 }, (_, i) =>
    document.getElementById(`joint${i + 1}-led-homing`)
);

// ROS topic: /joint_states
const jointStatesTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/joint_states',
    messageType: 'sensor_msgs/msg/JointState'
});

// Store latest joint_states message
let latestJointStateMsg = null;

// ROS subscriber (NO processing here)
jointStatesTopic.subscribe((message) => {
    latestJointStateMsg = message;
});

// ===================== 5 Hz PROCESS LOOP =====================
setInterval(() => {

    if (!latestJointStateMsg) return;

    // Map joint positions by name
    const jointPositions = {};
    latestJointStateMsg.name.forEach((name, index) => {
        jointPositions[name] = latestJointStateMsg.position[index];
    });

    const homingStatus = [];

    for (let i = 1; i <= 6; i++) {
        const jointName = `joint${i}`;
        const position = jointPositions[jointName] ?? 0.0;

        // ✅ Homed if position == 0.000 (3 decimal precision)
        const isHomed = Math.abs(position).toFixed(3) === '0.000';
        homingStatus.push(isHomed);

        const led = homingLeds[i - 1];
        if (led) {
            led.classList.toggle('joint-indicator-true', isHomed);
            led.classList.toggle('joint-indicator-false', !isHomed);
        }
    }

    // Robot-level homing LED
    const allJointsHomed = homingStatus.every(Boolean);
    robotLedHoming.classList.toggle('led-homing-true', allJointsHomed);
    robotLedHoming.classList.toggle('led-homing-false', !allJointsHomed);

    // Optional global state
    window.robotStatus = window.robotStatus || {};
    window.robotStatus.homing = {
        jointStatus: homingStatus,
        allHomed: allJointsHomed
    };

}, 200); // ✅ 5 Hz (200 ms)