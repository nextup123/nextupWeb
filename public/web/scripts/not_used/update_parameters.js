
// Service client setup
const updateParamClient = new ROSLIB.Service({
    ros: ros,
    name: '/update_param',
    serviceType: 'nextup_joint_interfaces/srv/UpdateParam'
});

function updateParameter(parameterName, newValue) {
    if (!parameterName || !newValue) {
        return;
    }
    console.log('agya');
    
    // Ensure the parameters are converted to strings
    const parameterNameStr = String(parameterName);
    const newValueStr = String(newValue);

    const request = new ROSLIB.ServiceRequest({
        parameter_name: parameterNameStr,
        new_value: newValueStr
    });

    updateParamClient.callService(request, function(response) {
        console.log('Service response:', response);
    });
}


function updateVASPM() {
    const maxVelocity = parseFloat(document.getElementById('max_velocity').value) || 0.0;
    const acceleration = parseFloat(document.getElementById('acceleration_').value) || 0.0;

    const dropdown = document.getElementById('spmSelect');
    const selectedValue = dropdown.value;

    if (!selectedValue) {
        console.log("No option selected in the dropdown.");
        return;
    }

    let velocityParameterName;
    let accelerationParameterName;
    switch (selectedValue) {
        case 'joint_rs_1':
            velocityParameterName = 'max_velocity_spm_1';
            accelerationParameterName = 'acceleration_spm_1';
            break;
        case 'joint_rc_1':
            velocityParameterName = 'max_velocity_spm_1';
            accelerationParameterName = 'acceleration_spm_1';
            break;
        case 'joint_rs_2':
            velocityParameterName = 'max_velocity_spm_2';
            accelerationParameterName = 'acceleration_spm_2';
            break;
        case 'joint_rc_2':
            velocityParameterName = 'max_velocity_spm_2';
            accelerationParameterName = 'acceleration_spm_2';
            break;
        default:
            console.log("Unexpected dropdown value. No parameter updated.");
            return;
    }

    updateParameter(velocityParameterName, maxVelocity);
    console.log(`Updating ${velocityParameterName} to max velocity: ${maxVelocity}`);
    updateParameter(accelerationParameterName, acceleration);
    console.log(`Updating ${accelerationParameterName} to acceleration: ${acceleration}`);
}

// Trigger with a button click instead of `input` events
// document.getElementById('updateButtontest').addEventListener('click', updateVASPM);
document.getElementById('max_velocity').addEventListener('input', updateVASPM);
document.getElementById('acceleration_').addEventListener('input', updateVASPM);



// Define the /update_yaml topic
const updateYamlTopic = new ROSLIB.Topic({
    ros: ros,
    name: "/update_yaml",
    messageType: "std_msgs/String"
});

// Button elements
const setParamsSpm1Button = document.getElementById('setParamsSpm1');
const setParamsSpm2Button = document.getElementById('setParamsSpm2');

// Add click event listener for "Set Params SPM 1" button
setParamsSpm1Button.addEventListener('click', function () {
    const message = new ROSLIB.Message({
        data: "update_yaml_spm_1"
    });
    updateYamlTopic.publish(message);
    console.log("Published: update_yaml_spm_1");
});

// Add click event listener for "Set Params SPM 2" button
setParamsSpm2Button.addEventListener('click', function () {
    const message = new ROSLIB.Message({
        data: "update_yaml_spm_2"
    });
    updateYamlTopic.publish(message);
    console.log("Published: update_yaml_spm_2");
});
