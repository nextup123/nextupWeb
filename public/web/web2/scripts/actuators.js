// Create a ROS topic
var digitalOutputSPMController = new ROSLIB.Topic({
    ros: ros,
    name: '/digital_output_spm_controller',
    messageType: 'std_msgs/String'
});

// Function to publish messages
function publishMessage(message) {
    var msg = new ROSLIB.Message({ data: message });
    digitalOutputSPMController.publish(msg);
    console.log("Published:", message);
}

// Add event listeners for buttons
document.getElementById("ec_unit_1").addEventListener("mousedown", () => {
    publishMessage("ec_unit_1_on");
});
document.getElementById("ec_unit_1").addEventListener("mouseup", () => {
    publishMessage("ec_unit_1_off");
});

document.getElementById("punch_unit_1").addEventListener("mousedown", () => {
    publishMessage("punch_unit_1_on");
});
document.getElementById("punch_unit_1").addEventListener("mouseup", () => {
    publishMessage("punch_unit_1_off");
});

document.getElementById("ec_unit_2").addEventListener("mousedown", () => {
    publishMessage("ec_unit_2_on");
});
document.getElementById("ec_unit_2").addEventListener("mouseup", () => {
    publishMessage("ec_unit_2_off");
});

document.getElementById("punch_unit_2").addEventListener("mousedown", () => {
    publishMessage("punch_unit_2_on");
});
document.getElementById("punch_unit_2").addEventListener("mouseup", () => {
    publishMessage("punch_unit_2_off");
});



const testElectromagnetTopic = new ROSLIB.Topic({
    ros: ros,
    name: "/test_electromagnet",
    messageType: "std_msgs/Bool"
});

// Input elements
const electromagnetCheckbox = document.getElementById('electromagnet');

// Handle checkbox change and publish to /test_electromagnet
electromagnetCheckbox.addEventListener('change', function () {
    const isChecked = electromagnetCheckbox.checked;

    const message = new ROSLIB.Message({
        data: isChecked
    });

    testElectromagnetTopic.publish(message);

    console.log(`Electromagnet state published: ${isChecked}`);
});
