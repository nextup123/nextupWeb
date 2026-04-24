
let ros = new ROSLIB.Ros({
    url: 'ws://localhost:9090' // Update if using different rosbridge URL
});

ros.on('connection', () => console.log('🟢 Connected to ROS bridge'));
ros.on('error', err => console.error('🔴 ROS error:', err));
ros.on('close', () => console.warn('🟠 ROS connection closed'));

let currentSpeedScale = 0.1;   // 👈 always reflects what robot is using

let allJointsOp = false;