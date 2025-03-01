console.log("homming..init..");



// Create a ROS topic object
var homingStatusPublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/do_homing_spm',
    messageType: 'std_msgs/String'
});

// Function to publish a message to the topic
function publishHomingStatus(status) {
    var message = new ROSLIB.Message({
        data: status
    });
    homingStatusPublisher.publish(message);
    console.log("Published:", status);
}

// Add event listeners for the buttons
document.querySelector('.btnb.btnc').addEventListener('click', () => publishHomingStatus("SPM1"));
document.querySelector('.btnb.btn2').addEventListener('click', () => publishHomingStatus("BOTH"));
document.querySelector('.btnb.btn3').addEventListener('click', () => publishHomingStatus("SPM2"));

