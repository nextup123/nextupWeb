//ROS connection setup
const ros = new ROSLIB.Ros({
    url: 'ws://localhost:9090'
});

ros.on('connection', () => console.log('Connected CONTROLLER with ROS'));


ros.on('error', (error) => {
    console.error('Error connecting to ROS bridge server:', error);
});

ros.on('close', () => {
    console.log('Disconnected from ROS bridge server.');
});


// const rotatable = document.getElementById('rotatable');
// let angle = 0;

// function rotateElement() {
//     angle -= 90;
//     rotatable.style.transform = `rotate(${angle}deg)`;
//     console.log(`Rotated to ${angle} degrees.`);
// }

// const trajectorySubscriber = new ROSLIB.Topic({
//     ros: ros,
//     name: '/spm_rf_controller/joint_trajectory',
//     messageType: 'trajectory_msgs/JointTrajectory'
// });

// trajectorySubscriber.subscribe((message) => {
//     console.log('Received message on /spm_rf_controller/joint_trajectory:', message);
//     rotateElement();
// });

//cobot_operation topic
const cobotOperationSubscriber = new ROSLIB.Topic({
    ros: ros,
    name: '/operation_counter',
    messageType: 'std_msgs/Int32'
});

cobotOperationSubscriber.subscribe((message) => {
    console.log('Received message on /cobot_operation:', message.data);

    const counterElement = document.getElementById('operation-counter');
    counterElement.textContent = message.data.toString().padStart(3, '0'); // Format as 3 digits
});

function disableButton(serial) {
    const start = document.getElementById('startButton');
    const playPause = document.getElementById('playPauseButton');
    const exit = document.getElementById('exitButton');
    const home = document.getElementById('homeButton');
    if (serial[3] === '1') {
        home.disabled = false;
        home.style.backgroundColor = '#3e88b9';
        home.style.cursor = 'pointer';
    }
    else {
        home.disabled = true;
        home.style.backgroundColor = 'gray';
        home.style.cursor = 'not-allowed';
    }

    if (serial[2] === '1') {
        exit.disabled = false;
        exit.style.backgroundColor = '#b33d1f';
        exit.style.cursor = 'pointer';
    }
    else {
        exit.disabled = true;
        exit.style.backgroundColor = 'gray';
        exit.style.cursor = 'not-allowed';
    }
    if (serial[1] === '1') {
        playPause.disabled = false;
        playPause.style.backgroundColor = 'darkorange';
        playPause.style.cursor = 'pointer';
    }
    else {
        playPause.disabled = true;
        playPause.style.backgroundColor = 'gray';
        playPause.style.cursor = 'not-allowed';
    }
    if (serial[0] === '1') {
        start.disabled = false;
        start.style.backgroundColor = '#439433';
        start.style.cursor = 'pointer';
    }
    else {
        start.disabled = true;
        start.style.backgroundColor = 'gray';
        start.style.cursor = 'not-allowed';
    }
}

function togglePause() {
    const button = document.getElementById('playPauseButton');
    if (button.classList.contains('play')) {
        // publishBoolMessage('/cobot_play_pause',true); 
        button.classList.remove('play');
        button.classList.add('pause');
        button.textContent = "PAUSE";
    }
}

function togglePlay() {
    const button = document.getElementById('playPauseButton');
    if (button.classList.contains('pause')) {
        // publishBoolMessage('/cobot_play_pause',true); 
        button.classList.remove('pause');
        button.classList.add('play');
        button.textContent = "PLAY";
    }
}

function publishStringMessage(topicName, messageData) {
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'std_msgs/String'
    });

    const message = new ROSLIB.Message({
        data: messageData
    });

    topic.publish(message);
    console.log(`Message "${messageData}" published on topic "${topicName}"`);
}

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



const opStatusTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/operational_status', // Your topic name
    messageType: 'nextup_joint_interfaces/msg/OperationalStatus' // Custom message type
});

let robotStatus = false;

opStatusTopic.subscribe((message) => {
    document.getElementById('joint1-led-op').className = message.joint1_op
        ? 'indicator indicator-true'
        : 'indicator indicator-false';

    document.getElementById('joint2-led-op').className = message.joint2_op
        ? 'indicator indicator-true'
        : 'indicator indicator-false';

    document.getElementById('joint3-led-op').className = message.joint3_op
        ? 'indicator indicator-true'
        : 'indicator indicator-false';

    document.getElementById('joint4-led-op').className = message.joint4_op
        ? 'indicator indicator-true'
        : 'indicator indicator-false';

    document.getElementById('joint5-led-op').className = message.joint5_op
        ? 'indicator indicator-true'
        : 'indicator indicator-false';

    document.getElementById('joint6-led-op').className = message.joint6_op
        ? 'indicator indicator-true'
        : 'indicator indicator-false';

    if (message.joint1_op && message.joint2_op && message.joint3_op && message.joint4_op && message.joint5_op && message.joint6_op) {
        robotStatus = false;

    } else {
        robotStatus = true;
    }

    document.getElementById('robot-error-status-indicator').className = robotStatus
    ? 'indicator indicator-false'
    : 'indicator indicator-true';
});

