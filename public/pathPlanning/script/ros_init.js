// ROS connection variables
let ros = new ROSLIB.Ros();
let motionStatusListener = null;
let motionCommandPublisher = null;
let logsPublisher = null;
let isConnected = false;
let activeStatusListener = null;
let startCommandPublisher = null;

// DOM elements
const motionToggle = document.getElementById('motionToggle');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const rosStatus = document.getElementById('rosStatus');
const rosStatusText = document.getElementById('rosStatusText');

// Initialize ROS connection
function initROS() {
    // Try to connect to ROS Bridge
    try {
        ros.connect('ws://localhost:9090');

        ros.on('connection', () => {
            console.log('Connected to Server');
            isConnected = true;
            updateROSConnectionStatus(true);
            setupROSTopics();
        });

        ros.on('error', (error) => {
            console.error('Error connecting to ROS Bridge:', error);
            isConnected = false;
            updateROSConnectionStatus(false);
        });

        ros.on('close', () => {
            console.log('Connection to ROS Bridge closed');
            isConnected = false;
            updateROSConnectionStatus(false);
        });
    } catch (error) {
        console.error('Failed to initialize ROS connection:', error);
        isConnected = false;
        updateROSConnectionStatus(false);
    }
}

// Update ROS connection status indicator
function updateROSConnectionStatus(connected) {
    if (connected) {
        rosStatus.className = 'ros-status ros-connected';
        rosStatusText.textContent = 'Connected to Server';
    } else {
        rosStatus.className = 'ros-status ros-disconnected';
        rosStatusText.textContent = 'Disconnected from ROS Bridge';
        // Reset toggle and status if disconnected
        motionToggle.checked = false;
        updateMotionStatus('stopped');
    }
}

// Set up ROS topics
function setupROSTopics() {
    // Create subscriber for motion status
    motionStatusListener = new ROSLIB.Topic({
        ros: ros,
        name: '/control_process_motion_bt_status',
        messageType: 'std_msgs/String'
    });

    motionStatusListener.subscribe(function (message) {
        const status = message.data.toLowerCase();
        updateMotionStatus(status);
    });

    // Create publisher for motion commands
    motionCommandPublisher = new ROSLIB.Topic({
        ros: ros,
        name: '/control_process_motion_bt',
        messageType: 'std_msgs/String'
    });

    logsPublisher = new ROSLIB.Topic({
        ros: ros,
        name: '/logs_topic',
        messageType: 'std_msgs/String'
    });

    activeStatusListener = new ROSLIB.Topic({
        ros: ros,
        name: '/motion_start_bt_active',
        messageType: 'std_msgs/Bool'
    });

    activeStatusListener.subscribe(function (message) {
        updateButtonStatus(message.data);
    });

    // Create publisher for start commands
    startCommandPublisher = new ROSLIB.Topic({
        ros: ros,
        name: '/motion_start_bt',
        messageType: 'std_msgs/Bool'
    });

    autoGeneratePathsPublisher = new ROSLIB.Topic({
        ros: ros,
        name: '/auto_generate_xml',
        messageType: 'std_msgs/Bool'
    });
}

// Update motion status based on received message
function updateMotionStatus(status) {
    if (status.includes('running')) {
        statusDot.className = 'status-dot status-running';
        statusText.textContent = 'Running';
        motionToggle.checked = true;
    } else {
        statusDot.className = 'status-dot status-stopped';
        statusText.textContent = 'Stopped';
        motionToggle.checked = false;
    }
}
function autoGeneratePaths() {
    const msg = new ROSLIB.Message({
        data: true
    });
    autoGeneratePathsPublisher.publish(msg);

    setTimeout(() => {
        reloadPaths()
    }, 500);
}

function startMotionBtFun() {
    const msg = new ROSLIB.Message({
        data: true
    });
    startCommandPublisher.publish(msg);

}

// Update motion status based on received message
function updateMotionStatus(status) {
    if (status.includes('running')) {
        statusDot.className = 'status-dot status-running';
        statusText.textContent = 'Running';
        motionToggle.checked = true;
    } else {
        statusDot.className = 'status-dot status-stopped';
        statusText.textContent = 'Stopped';
        motionToggle.checked = false;
    }
}

// Handle toggle button change
motionToggle.addEventListener('change', function () {

    if (motionCommandPublisher) {
        const msg = new ROSLIB.Message({
            data: motionToggle.checked ? 'start' : 'stop'
        });

        motionCommandPublisher.publish(msg);
        console.log('Published command:', msg.data);
    }
});

function updateButtonStatus(isActive) {
    if (isActive) {
        statusDot.className = 'status-dot status-active';
        statusText.textContent = 'Active';
        startPlanningBtn.disabled = false;
    } else {
        statusDot.className = 'status-dot status-inactive';
        statusText.textContent = 'Inactive';
        startPlanningBtn.disabled = true;
    }
}


var motionSuccessListener = new ROSLIB.Topic({
    ros: ros,
    name: '/motion_planning_bt_success',
    messageType: 'std_msgs/Bool'
});


motionSuccessListener.subscribe(function (message) {
    if (message.data === true) {
        console.log('received motion_planning_bt_success : true');
        reloadPaths()
        reloadPoints()
        setTimeout(() => {
            checkPathStatus()
        }, 500);
    }
});




// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    initROS();
});