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

let lastUpdateTime = null;

cobotOperationSubscriber.subscribe((message) => {
    console.log('Received message on /cobot_operation:', message.data);

    const counterElement = document.getElementById('operation-counter');
    counterElement.textContent = message.data.toString().padStart(3, '0'); // Format as 3 digits

    const currentTime = Date.now();
    const cycleTimeElement = document.getElementById('cycle-time');

    if (lastUpdateTime !== null) {
        const cycleTime = ((currentTime - lastUpdateTime) / 1000).toFixed(3); // Convert to seconds, 2 decimal places
        cycleTimeElement.textContent = `${cycleTime} secs`;
    } else {
        cycleTimeElement.textContent = 'Waiting for first cycle...';
    }

    lastUpdateTime = currentTime;
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



// // MODE topic publisher
// const modePub = new ROSLIB.Topic({
//     ros: ros,
//     name: '/testing_mode',
//     messageType: 'std_msgs/msg/Bool'
// });

// CNC topic publisher
const cncPub = new ROSLIB.Topic({
    ros: ros,
    name: '/select_cnc',
    messageType: 'std_msgs/msg/String'
});

// function selectMode(mode) {
//     // Visual feedback
//     ['testing', 'production'].forEach(id => {
//         document.getElementById(id).classList.remove('selected');
//     });
//     document.getElementById(mode).classList.add('selected');

//     // Publish
//     const value = (mode === 'testing');
//     modePub.publish(new ROSLIB.Message({ data: value }));
// }

function selectCNC(cnc) {
    // Visual feedback
    ['cnc1', 'cnc2', 'both'].forEach(id => {
        document.getElementById(id).classList.remove('selected');

    });
    document.getElementById(cnc).classList.add('selected');

    // Publish
    cncPub.publish(new ROSLIB.Message({ data: cnc }));
}


const cnc_select_subscriber = new ROSLIB.Topic({
    ros: ros,
    name: '/select_cnc',
    messageType: 'std_msgs/String'
});

cnc_select_subscriber.subscribe(function (message) {
    console.log('Received message: ' + message.data);

    // Reset all boxes
    document.getElementById("cnc1").classList.remove("highlight-cnc");
    document.getElementById("cnc2").classList.remove("highlight-cnc");
    document.getElementById("both").classList.remove("highlight-cnc");

    // Highlight-cnc based on message
    if (message.data == "received:cnc1") {
        document.getElementById("cnc1").classList.add("highlight-cnc");
    }
    if (message.data == "received:cnc2") {
        document.getElementById("cnc2").classList.add("highlight-cnc");
    }
    if (message.data == "received:both") {
        document.getElementById("both").classList.add("highlight-cnc");
    }
});


// Create a publisher (you might want to declare this globally)
const speedScalePublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/dynamic_speed_scale',
    messageType: 'std_msgs/Float64'
});

function selectMode(mode) {
    // Visual feedback reset
    ['testing', 'production'].forEach(id => {
        document.getElementById(id).classList.remove('mode-selected', 'success', 'fail');
    });

    // Determine the value to publish
    const speedScale = (mode === 'production') ? 0.0 : 0.2;

    // Create and publish the message
    const message = new ROSLIB.Message({
        data: speedScale
    });

    speedScalePublisher.publish(message);

    // Visual feedback
    const element = document.getElementById(mode);
    element.classList.add('success', 'mode-selected');

    // Remove feedback after 2 seconds (keeping selected)
    setTimeout(() => {
        element.classList.remove('success', 'fail');
    }, 2000);
}

const startActiveSubscriber = new ROSLIB.Topic({
    ros: ros,
    name: '/start_bt_active',
    messageType: 'std_msgs/Bool'
});

const startButton = document.getElementById('startButton');
const startOnceButton = document.getElementById('runOnceButton');


startActiveSubscriber.subscribe((message) => {
    if (message.data) {
        startButton.disabled = false;
        startOnceButton.disabled = false;

        startButton.classList.remove('button-disabled');
        startOnceButton.classList.remove('button-disabled');

        startButton.classList.add('button-enabled');
        startOnceButton.classList.add('button-enabled');

        console.log('START button enabled');
    } else {
        startButton.disabled = true;
        startOnceButton.disabled = true;

        startButton.classList.remove('button-enabled');
        startOnceButton.classList.remove('button-disabled');

        startButton.classList.add('button-disabled');
        startOnceButton.classList.add('button-disabled');

        console.log('START button disabled');
    }
});


setTimeout(() => {
    selectCNC("both");
    document.getElementById('production').classList.add('mode-selected', 'success');

}, 1000);