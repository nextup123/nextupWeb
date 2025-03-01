var initialFinalPoseSpm = new ROSLIB.Topic({
    ros: ros,
    name: '/initial_final_pose_spm',
    messageType: 'std_msgs/Float64MultiArray'
});
var initialPosition;
var finalPosition;
// Function to update the display with the current position and velocity
initialFinalPoseSpm.subscribe(function(message) {
    initialPosition = message.data[0];
    finalPosition = message.data[1];

    document.getElementById('positionForInitialValue').innerHTML = "" + initialPosition.toFixed(2);
    document.getElementById('positionForFinalValue').innerHTML = "" + finalPosition.toFixed(2);
});

// Publish default values when the page loads
window.onload = function() {
    publishVelocityAndAcceleration();
};
