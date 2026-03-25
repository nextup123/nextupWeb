

// Create a popup element (add this to your HTML or create dynamically)
const popup = document.createElement('div');
popup.id = 'statusPopup';
popup.style.display = 'none';
popup.style.position = 'fixed';
popup.style.top = '50%';
popup.style.left = '50%';
popup.style.transform = 'translate(-50%, -50%)';
popup.style.backgroundColor = '#2d2d2d';
popup.style.padding = '20px';
popup.style.borderRadius = '8px';
popup.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
popup.style.zIndex = '1000';
popup.style.color = 'white';
popup.style.fontFamily = "'Roboto Mono', monospace";
popup.style.textAlign = 'center';

const popupMessage = document.createElement('p');
popupMessage.id = 'popupMessage';
popupMessage.style.marginBottom = '20px';

const popupOkButton = document.createElement('button');
popupOkButton.textContent = 'OK';
popupOkButton.style.padding = '8px 16px';
popupOkButton.style.backgroundColor = '#4CAF50';
popupOkButton.style.color = 'white';
popupOkButton.style.border = 'none';
popupOkButton.style.borderRadius = '4px';
popupOkButton.style.cursor = 'pointer';

popupOkButton.addEventListener('click', () => {
    popup.style.display = 'none';
});

popup.appendChild(popupMessage);
popup.appendChild(popupOkButton);
document.body.appendChild(popup);

function showPopup(message) {
    popupMessage.textContent = message;
    popup.style.display = 'block';
}


function pubRosBool(topicName, boolValue) {
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


// ================= EMERGENCY PUBLISHER =================
const emergencyPub = new ROSLIB.Topic({
    ros: ros,
    name: '/nextup_emergency_trigger_controller/commands',
    messageType: 'nextup_joint_interfaces/msg/NextupEmergencyTrigger'
});


const ACTION_COOLDOWN_MS = 2000;

function applyCooldown(button, cooldownMs = ACTION_COOLDOWN_MS) {
    button.disabled = true;
    button.style.opacity = '0.4';
    button.style.cursor = 'not-allowed';

    setTimeout(() => {
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
    }, cooldownMs);
}


// Get button elements
const homeButton = document.getElementById('homeButton');
const resetButton = document.getElementById('resetButton');

homeButton.addEventListener('click', () => {
    const status = window.robotStatus;

    if (!status.operational.allOperational) {
        showPopup("Cannot HOME: Not all joints are operational");
        return;
    }
    if (status.emergency.anyEmergency) {
        showPopup("Cannot HOME: Emergency condition detected");
        return;
    }
    if (status.running.anyRunning) {
        showPopup("Cannot HOME: Some joints are still running");
        return;
    }

    publishRosString('/change_mode', '8');
    setTimeout(() => {
        publishRosString('/ui_commands', 'home');
    }, 1000);


    // ⏳ apply cooldown
    applyCooldown(homeButton);
});


resetButton.addEventListener('click', () => {
    const status = window.robotStatus;

    if (status.emergency.anyEmergency) {
        showPopup("Cannot RESET: Emergency condition detected");
        return;
    }

    const msg = new ROSLIB.Message({
        emergencytrigger: true
    });
    emergencyPub.publish(msg);

    setTimeout(() => {
        pubRosBool('/reset_fault', true);

    }, 1000);

    // ⏳ apply cooldown
    applyCooldown(resetButton);
});


// ================= BUTTON HANDLER =================
document.getElementById('emergency-button').addEventListener('click', () => {

    const msg = new ROSLIB.Message({
        emergencytrigger: true
    });
    emergencyPub.publish(msg);
    console.log('🚨 Emergency trigger published: TRUE');
});

// Visual feedback for button states
function updateButtonStates() {
    const status = window.robotStatus;

    // Home button enabled only when all conditions are met
    const homeEnabled = status.operational.allOperational &&
        !status.emergency.anyEmergency &&
        !status.running.anyRunning;

    homeButton.disabled = !homeEnabled;
    homeButton.style.opacity = homeEnabled ? '1' : '0.6';

    // Reset button enabled when no emergency
    const resetEnabled = !status.emergency.anyEmergency;
    resetButton.disabled = !resetEnabled;
    resetButton.style.opacity = resetEnabled ? '1' : '0.6';
}

// Update button states whenever status changes
// You can call this from your ROS subscription callbacks after updating robotStatus
// For example, in your operational status callback:
// window.robotStatus.operational.allOperational = allJointsOperational;
// updateButtonStates();












