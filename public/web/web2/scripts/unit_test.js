var ros = new ROSLIB.Ros({
    url: 'ws://localhost:9090'  // Adjust if using a different port
});
var jointNameTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/joint_name_spm',
    messageType: 'std_msgs/String'
});

var forwardTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/forward_direction',
    messageType: 'std_msgs/Bool'
});

var reverseTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/reverse_direction',
    messageType: 'std_msgs/Bool'
});

function publishButtonState(direction, state) {

    var msg = new ROSLIB.Message({
        data: state
    });

    if (direction === 'forward') {
        forwardTopic.publish(msg);
        console.log("Published " + direction + " : " + state);
        
    } else if (direction === 'reverse') {
        reverseTopic.publish(msg);
        console.log("Published " + direction + " : " + state);
    }
}

// Function to publish selected joint name
function publishJointName() {
   
    var selectedJoint = getSelectedOption();

    if (selectedJoint !== "Choose a joint...") {
        var jointNameMsg = new ROSLIB.Message({
            data: selectedJoint
        });
        jointNameTopic.publish(jointNameMsg);
        console.log('Published Joint Name:', selectedJoint);
    }
}

// Validate velocity and acceleration before publishing button state
function validateAndPublishButtonState(direction, state) {
    var velocity = parseFloat(document.getElementById('velocity').value) || 0.0;
    var acceleration = parseFloat(document.getElementById('acceleration').value) || 0.0;

    // Check if velocity or acceleration are empty or 0
    if (velocity === 0.0) {
        alert('Velocity cannot be 0 or empty.');
        return;
    }

    if (acceleration === 0.0) {
        alert('Acceleration cannot be 0 or empty.');
        return;
    }

    publishButtonState(direction, state);  // Publish the button state if values are valid
}

var velAccTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/velocity_acceleration',
    messageType: 'std_msgs/Float64MultiArray'
});

function publishVelocityAndAcceleration() {
    var velocityInput = document.getElementById('velocity');
    var velocity = parseFloat(velocityInput.value) || 0.0;
    var acceleration = parseFloat(document.getElementById('acceleration').value) || 0.0;
    var CATime = velocity / acceleration;

    // Ensure velocity does not exceed 2000
    if (velocity > 2000) {
        velocity = 2000;
        velocityInput.value = 2000;  // Set the input field back to 2000 if exceeded
    }

    var msg = new ROSLIB.Message({
        data: [velocity, acceleration]
    });

    document.getElementById('CATime').innerHTML = `Calculated Accel Time : ${CATime}`;
    velAccTopic.publish(msg);
    console.log("Published \n" + "Velocity : " + velocity + "\n" + "Acceleration : " + acceleration);
    
}

// Subscribing to /current_position_velocity topic to display position and velocity
var currentPositionVelocityTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/current_position_velocity_spm',
    messageType: 'std_msgs/Float64MultiArray'
});

// Function to update the display with the current position and velocity
currentPositionVelocityTopic.subscribe(function(message) {
    var currentPosition = message.data[0];
    var currentVelocity = message.data[1];

    document.getElementById('currentPosition').innerHTML = "Current Position: " + currentPosition.toFixed(2);
    document.getElementById('currentVelocity').innerHTML = "Current Velocity: " + currentVelocity.toFixed(2);
});

// Publish default values when the page loads
window.onload = function() {
    publishVelocityAndAcceleration();
};
