
// Define the topic
const electromagnetDataTopic = new ROSLIB.Topic({
    ros: ros,
    name: "/electromagnet_data",
    messageType: "std_msgs/Float64MultiArray"
});

// Slider elements
const slider1 = document.getElementById('slider1');
const slider2 = document.getElementById('slider2');
const slider1MinLabel = document.getElementById('slider1-min');
const slider1MaxLabel = document.getElementById('slider1-max');
const slider2MinLabel = document.getElementById('slider2-min');
const slider2MaxLabel = document.getElementById('slider2-max');
const slider1ValueDisplay = document.getElementById('slider1-value');
const slider2ValueDisplay = document.getElementById('slider2-value');

// Update sliders when topic is updated
initialFinalPoseSpm.subscribe(function (message) {
    let minLimit = message.data[0];
    let maxLimit = message.data[1];

    // Normalize min and max to ensure min <= max
    if (minLimit > maxLimit) {
        [minLimit, maxLimit] = [maxLimit, minLimit];
    }

    slider1.min = slider2.min = minLimit;
    slider1.max = slider2.max = maxLimit;

    slider1MinLabel.textContent = slider2MinLabel.textContent = minLimit;
    slider1MaxLabel.textContent = slider2MaxLabel.textContent = maxLimit;

    // Ensure current slider values remain within the new range
    if (slider1.value < minLimit) slider1.value = minLimit;
    if (slider1.value > maxLimit) slider1.value = maxLimit;
    if (slider2.value < minLimit) slider2.value = minLimit;
    if (slider2.value > maxLimit) slider2.value = maxLimit;

    updateSliderDisplay(1);
    updateSliderDisplay(2);

    console.log(`Updated slider limits: Min = ${minLimit}, Max = ${maxLimit}`);
});

// Function to update slider display values
function updateSliderDisplay(sliderNumber) {
    const slider = sliderNumber === 1 ? slider1 : slider2;
    const display = sliderNumber === 1 ? slider1ValueDisplay : slider2ValueDisplay;
    display.textContent = slider.value;
}

// Function to log and publish slider position on mouse release
function logSliderPosition(sliderNumber) {
    const slider1Value = parseFloat(slider1.value);
    const slider2Value = parseFloat(slider2.value);

    const message = new ROSLIB.Message({
        data: [slider1Value, slider2Value]
    });

    electromagnetDataTopic.publish(message);

    const selectedValue = getSelectedOption();

    if (!selectedValue) {
        console.log("No option selected in the dropdown.");
        return;
    }

    let electroPickupPosParameterName;
    let electroDropPosParameterName;
    switch (selectedValue) {
        case 'joint_rs_1':
            electroPickupPosParameterName = 'electro_pickup_pos_spm_1';
            electroDropPosParameterName = 'electro_drop_pos_spm_1';
            break;
        case 'joint_rc_1':
            electroPickupPosParameterName = 'electro_pickup_pos_spm_1';
            electroDropPosParameterName = 'electro_drop_pos_spm_1';
            break;
        case 'joint_rs_2':
            electroPickupPosParameterName = 'electro_pickup_pos_spm_2';
            electroDropPosParameterName = 'electro_drop_pos_spm_2';
            break;
        case 'joint_rc_2':
            electroPickupPosParameterName = 'electro_pickup_pos_spm_2';
            electroDropPosParameterName = 'electro_drop_pos_spm_2';
            break;
        default:
            console.log("Unexpected dropdown value. No parameter updated.");
            return;
    }
    updateParameter(electroPickupPosParameterName, slider1Value);
    console.log(`Updating ${electroPickupPosParameterName} to : ${slider1Value}`);
    updateParameter(electroDropPosParameterName, slider2Value);
    console.log(`Updating ${electroDropPosParameterName} to : ${slider2Value}`);

    console.log(`Published slider values: [${slider1Value}, ${slider2Value}]`);
}

// Attach event listeners to the sliders
slider1.addEventListener('mouseup', () => logSliderPosition(1));
slider2.addEventListener('mouseup', () => logSliderPosition(2));
