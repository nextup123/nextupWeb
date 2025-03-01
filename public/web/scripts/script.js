// var ros = new ROSLIB.Ros({
//     url: 'ws://localhost:9090'  // Make sure your WebSocket server is running on the right port
// });

// Establish a connection to the ROS 2 WebSocket server
const ros = new ROSLIB.Ros({
    url: 'ws://localhost:9090' // Replace with your ROS bridge WebSocket URL if different
});

// Log connection status
ros.on('connection', () => {
    console.log('Connected to ROS 2 WebSocket server');
});
ros.on('error', (error) => {
    console.error('Error connecting to ROS 2 WebSocket server:', error);
});
ros.on('close', () => {
    console.log('Connection to ROS 2 WebSocket server closed');
});

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

var uiCommandTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/ui_commands',
    messageType: 'std_msgs/String'
});

var cobotPlayPause = new ROSLIB.Topic({
    ros: ros,
    name: '/cobot_play_pause',
    messageType: 'std_msgs/Bool'
});

// Subscribe to /nextup_joint_states topic
// const cobot_joint_state = new ROSLIB.Topic({
//     ros: ros,
//     name: '/nextup_joint_states',
//     messageType: 'nextup_joint_interfaces/msg/NextupJointState'
// });

var intervalId;
let isPressed = false;

function ros2Publish(data) {
    var message = new ROSLIB.Message({
        data: data
    });
    uiCommandTopic.publish(message);
    console.log("Published: " + data);
}

function ros2PublishCobotState(data) {
    var message = new ROSLIB.Message({
        data: data
    });
    cobotPlayPause.publish(message);
    console.log("Cobot Stop: " + data);
}

// var prev_mode = 8;
// cobot_joint_state.subscribe((message) => {
//     const mode = message.modeofoperation[0];

//     // Update the checkbox based on the value
//     const checkbox = document.getElementById('switch_mode_1');

//     if(mode !== prev_mode){
//         if (mode === 9) {
//             checkbox.checked = true;
//             console.log("Velocity control mode");
//         } else {
//             checkbox.checked = false;
//             console.log("Position control mode");
//         }
//         prev_mode = mode;
//     }
// });


['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'cx', 'cy', 'cz', 'cr', 'cp', 'cw'].forEach(joint => {

    document.getElementById(joint + '_plus').addEventListener('pointerdown', function () {
        isPressed = true;
        ros2Publish(`+${joint}`);
        intervalId = setInterval(() => ros2Publish(`+${joint}`), 10);
    });

    document.getElementById(joint + '_plus').addEventListener('pointerup', function () {
        if (isPressed) {
            clearInterval(intervalId);
            ros2Publish(`0${joint}`);
            isPressed = false;
        }
    });

    document.getElementById(joint + '_plus').addEventListener('mouseleave', function () {
        if (isPressed) {
            clearInterval(intervalId);
            ros2Publish(`0${joint}`);
            isPressed = false;
        }
    });

    document.getElementById(joint + '_minus').addEventListener('pointerdown', function () {
        isPressed = true;
        ros2Publish(`-${joint}`);
        intervalId = setInterval(() => ros2Publish(`-${joint}`), 10);
    });

    document.getElementById(joint + '_minus').addEventListener('pointerup', function () {
        if (isPressed) {
            clearInterval(intervalId);
            ros2Publish(`0${joint}`);
            isPressed = false;
        }
    });

    document.getElementById(joint + '_minus').addEventListener('mouseleave', function () {
        if (isPressed) {
            clearInterval(intervalId);
            ros2Publish(`0${joint}`);
            isPressed = false;
        }
    });
});

function showAlert(message, type = "success") {
    const alertBox = document.getElementById("customAlert");
    alertBox.textContent = message;
    alertBox.className = `custom-alert ${type} show`;

    setTimeout(() => {
        alertBox.classList.remove("show");
    }, 3000); // Auto-hide after 3 seconds
}

function publishRosString(topicName, messageData) {
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'std_msgs/String'
    });
    const message = new ROSLIB.Message({
        data: messageData
    });
    topic.publish(message);
    console.log(`Published to ${topicName}: ${messageData}`);
}

window.onload = function () {
    ros2Publish("start");
};

function publishBoolMessage(topicName, boolValue) {
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'std_msgs/Bool'
    });

    const message = new ROSLIB.Message({
        data: boolValue
    });

    topic.publish(message);
    console.log(`Bool message "${boolValue}" published on topic "${topicName}"`);
}


