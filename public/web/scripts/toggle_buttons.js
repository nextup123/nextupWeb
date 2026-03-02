// const e = require("cors");

// Subscribe to /nextup_joint_states topic
// const cobot_joint_state = new ROSLIB.Topic({
//     ros: ros,
//     name: '/nextup_joint_states',
//     messageType: 'nextup_joint_interfaces/NextupJointState'
// });

const toggle_play_pause = document.getElementById('toggle-robot');
const toggleCircle = toggle_play_pause.nextElementSibling.querySelector('.toggle-circle');
toggle_play_pause.checked = true;
toggleCircle.textContent = "Play";


const inputBitsTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/digital_input_bits',
    messageType: 'std_msgs/Int32MultiArray'
});

const cobot_joint_state = new ROSLIB.Topic({
    ros: ros,
    name: '/nextup_joint_states',
    messageType: 'nextup_joint_interfaces/NextupJointState'
});

var prev_mode = 8;
cobot_joint_state.subscribe((message) => {
    if (!message.modeofoperation || message.modeofoperation.length === 0) {
        console.warn("Received message without modeofoperation data");
        return;
    }

    const mode = Math.round(message.modeofoperation[0]);  
    const checkbox = document.getElementById('toggle-mode');
    const toggleConfig = toggles.find(t => t.id === 'toggle-mode');
    const toggleCircle = checkbox.nextElementSibling.querySelector('.toggle-circle');

    if (mode !== prev_mode) {
        checkbox.checked = (mode === 9);
        toggleCircle.textContent = checkbox.checked ? toggleConfig.onText : toggleConfig.offText;
        console.log(`Mode changed: ${toggleCircle.textContent}`);
        prev_mode = mode;
    }
});

const cobot_play_pause = new ROSLIB.Topic({
    ros: ros,
    name: '/cobot_play_pause',
    messageType: 'std_msgs/Bool'
});

cobot_play_pause.subscribe((message) => {
    const checkbox = document.getElementById('toggle-robot');
    const toggleConfig = toggles.find(t => t.id === 'toggle-robot');
    const toggleCircle = checkbox.nextElementSibling.querySelector('.toggle-circle');

    const isPlaying = !message.data;

    checkbox.checked = isPlaying;
    toggleCircle.textContent = isPlaying ? toggleConfig.onText : toggleConfig.offText;

    console.log(`Robot mode updated: ${toggleCircle.textContent}`);
});


var cncDoorOpen = true;
var cncDoorClose = false;

inputBitsTopic.subscribe((message) => {
    if (cncDoorOpen === message.data[6] && cncDoorClose === message.data[7]) return;

    cncDoorOpen = message.data[5];
    cncDoorClose = message.data[7];

    if (!cncDoorClose) {
        // console.log("door unchecked");

        document.getElementById("toggle-cnc").checked = true;
        document.getElementById('toggle-circle-cnc-door').textContent = "Open";

    } else if (!cncDoorOpen) {
        // console.log("door checked");

        document.getElementById("toggle-cnc").checked = false;
        document.getElementById('toggle-circle-cnc-door').textContent = "Close";

    }

});

function sendPulse(rosTriggerTopic, idx) {
    if (idx == 1) {
        const msg = new ROSLIB.Message({
            do1: [true]
        });
        rosTriggerTopic.publish(msg);

        setTimeout(() => {
            msg.do1 = [false];
            rosTriggerTopic.publish(msg);
        }, 250);
    }
    else if (idx == 2) {
        const msg = new ROSLIB.Message({
            do2: [true]
        });
        rosTriggerTopic.publish(msg);

        setTimeout(() => {
            msg.do2 = [false];
            rosTriggerTopic.publish(msg);
        }, 250);
    }
    else if (idx == 3) {
        const msg = new ROSLIB.Message({
            do3: [true]
        });

        rosTriggerTopic.publish(msg);

        setTimeout(() => {
            msg.do3 = [false];
            rosTriggerTopic.publish(msg);
        }, 250);
    }
}

gateCNCTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/nextup_digital_output_controller_3/commands',
    messageType: 'nextup_joint_interfaces/NextupDigitalOutputs'
})

pneumaticCVTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/nextup_digital_output_controller_5/commands',
    messageType: 'nextup_joint_interfaces/NextupDigitalOutputs'
})

// document.getElementById("toggle-cnc").addEventListener('change', function () {
//     sendPulse(gateCNCTopic, 1);
// });



// Define ROS publishers
const publishers = {};

const toggles = [
    { id: 'toggle-gripper1', onText: 'Open', offText: 'Close', topic: 'ui_commands', onRosPub: 'gt0', offRosPub: 'gt1', msgType: 'std_msgs/String' },
    { id: 'toggle-gripper2', onText: 'Open', offText: 'Close', topic: 'ui_commands', onRosPub: 'gt2', offRosPub: 'gt3', msgType: 'std_msgs/String' },
    { id: 'toggle-robot', onText: 'Play', offText: 'Pause', topic: 'cobot_play_pause', onRosPub: false, offRosPub: true, msgType: 'std_msgs/Bool' },
    { id: 'toggle-mode', onText: 'Jog', offText: 'Auto', topic: 'ui_commands', onRosPub: 'st9', offRosPub: 'st8', msgType: 'std_msgs/String' },
    // { id: 'toggle-cnc', onText: 'Close', offText: 'Open'},
    // { id: 'toggle-cv', onText: 'Down', offText: 'Up', topic: '/nextup_digital_output_controller_5/commands', idx: 1, onRosPub: true, offRosPub: false, msgType: 'nextup_joint_interfaces/NextupDigitalOutputs' }
];

// Initialize publishers
toggles.forEach(toggle => {
    publishers[toggle.id] = new ROSLIB.Topic({
        ros: ros,
        name: toggle.topic,
        messageType: toggle.msgType
    });
});

// Add event listeners for all toggles
toggles.forEach(toggle => {
    document.getElementById(toggle.id).addEventListener('change', function () {
        const toggleCircle = this.nextElementSibling.querySelector('.toggle-circle');
        let message;

        if (this.checked) {
            toggleCircle.textContent = toggle.onText;
            console.log(`${toggle.id} is now ${toggle.onText}`);

            // Create ROS message
            if (toggle.msgType === 'std_msgs/Bool') {
                message = new ROSLIB.Message({ data: toggle.onRosPub });
            } else if (toggle.msgType === 'std_msgs/String') {
                message = new ROSLIB.Message({ data: toggle.onRosPub });
            }
            else if (toggle.msgType === 'nextup_joint_interfaces/NextupDigitalOutputs') {
                if (toggle.idx == 1) message = new ROSLIB.Message({ do1: [toggle.onRosPub] });
                else if (toggle.idx == 2) message = new ROSLIB.Message({ do2: [toggle.onRosPub] });
                else if (toggle.idx == 3) message = new ROSLIB.Message({ do3: [toggle.onRosPub] });
            }

        } else {
            toggleCircle.textContent = toggle.offText;
            console.log(`${toggle.id} is now ${toggle.offText}`);

            // Create ROS message
            if (toggle.msgType === 'std_msgs/Bool') {
                message = new ROSLIB.Message({ data: toggle.offRosPub });
            } else if (toggle.msgType === 'std_msgs/String') {
                message = new ROSLIB.Message({ data: toggle.offRosPub });
            } else if (toggle.msgType === 'nextup_joint_interfaces/NextupDigitalOutputs') {
                if (toggle.idx == 1) message = new ROSLIB.Message({ do1: [toggle.offRosPub] });
                else if (toggle.idx == 2) message = new ROSLIB.Message({ do2: [toggle.offRosPub] });
                else if (toggle.idx == 3) message = new ROSLIB.Message({ do3: [toggle.offRosPub] });
            }

        }

        // Publish the message
        publishers[toggle.id].publish(message);
        console.log(`Published to ${toggle.topic}:`, message);
    });
});
