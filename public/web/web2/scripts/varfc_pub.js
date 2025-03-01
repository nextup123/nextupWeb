
// Create a ROS topic object
var varfcPublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/varfc_spm',
    messageType: 'std_msgs/Float64MultiArray'
});

var testTrajectory = new ROSLIB.Topic({
    ros: ros,
    name: 'test_trajectory',
    messageType: 'std_msgs/Bool'
});

// Function to publish the data
function publishVarfcSPM() {
    const maxVelocity = parseFloat(document.getElementById('max_velocity').value) || 0.0;
    const acceleration = parseFloat(document.getElementById('acceleration_').value) || 0.0;
    const reverseWT = parseFloat(document.getElementById('reverseWT').value) || 0.0;
    const forwardWT = parseFloat(document.getElementById('forwardWT').value) || 0.0;
    const numOfCycle = parseFloat(document.getElementById('numOfCycle').value) || 0.0;

    const data = [maxVelocity, acceleration, reverseWT, forwardWT, numOfCycle];

    var message = new ROSLIB.Message({
        data: data
    });

    varfcPublisher.publish(message);
    console.log("Published:", data);
}

// Attach event listeners to all input fields to publish on change
document.getElementById('max_velocity').addEventListener('input', publishVarfcSPM);
document.getElementById('acceleration_').addEventListener('input', publishVarfcSPM);
document.getElementById('reverseWT').addEventListener('input', publishVarfcSPM);
document.getElementById('forwardWT').addEventListener('input', publishVarfcSPM);
document.getElementById('numOfCycle').addEventListener('input', publishVarfcSPM);

function publishTestTrajectory(testTrajectoryState) {
    var message = new ROSLIB.Message({
        data: testTrajectoryState
    });
    testTrajectory.publish(message);
    console.log("Test Trajectory published:", testTrajectoryState);
}

document.querySelector('.btnRun').addEventListener('click', () => publishTestTrajectory(true));
document.querySelector('.btnStop').addEventListener('click', () => publishTestTrajectory(false));