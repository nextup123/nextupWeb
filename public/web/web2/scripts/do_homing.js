console.log("do_homing.js..init.. yo");
// ROS topic setup
var homingStatusPublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/do_homing_spm',
    messageType: 'std_msgs/String'
});

// Function to publish the homing status
function publishHomingStatus(status) {
    if (!homingStatusPublisher) {
        console.error('Homing status publisher is not initialized.');
        return;
    }

    var message = new ROSLIB.Message({ data: status });
    homingStatusPublisher.publish(message);
    console.log("Published:", status);
}

// Function to handle homing actions
function handleHomingAction(status) {
    publishHomingStatus(status);
}
