// Define the ROS topic
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

// Button event handlers
document.querySelectorAll('.btna').forEach(button => {
    button.addEventListener('mousedown', () => {
        let unit = button.closest('.rowa').querySelector('.unit1').textContent.toLowerCase().replace(' ', '_');
        let type = button.textContent.toLowerCase() === 'ec' ? 'ec' : 'punch';
        publishMessage(`${type}_${unit}_on`);
    });

    button.addEventListener('mouseup', () => {
        let unit = button.closest('.rowa').querySelector('.unit1').textContent.toLowerCase().replace(' ', '_');
        let type = button.textContent.toLowerCase() === 'ec' ? 'ec' : 'punch';
        publishMessage(`${type}_${unit}_off`);
    });

    button.addEventListener('mouseleave', () => {
        let unit = button.closest('.rowa').querySelector('.unit1').textContent.toLowerCase().replace(' ', '_');
        let type = button.textContent.toLowerCase() === 'ec' ? 'ec' : 'punch';
        publishMessage(`${type}_${unit}_off`);
    });
});
