// Define the ROS topic for mode change
var changeModeTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/change_mode_spm',
    messageType: 'std_msgs/Bool'
});

function toggleMode() {
    const toggle = document.getElementById("modeToggle");
    const modeLabel = document.getElementById("modeLabel");
    toggle.classList.toggle("toggle-on");

    // Publish to the ROS topic based on mode change
    var message = new ROSLIB.Message({
        data: toggle.classList.contains("toggle-on") // True for Mode 9, False for Mode 8
    });

    // Publish the message (only once for each toggle)
    changeModeTopic.publish(message);

    // Update the mode label and log
    if (toggle.classList.contains("toggle-on")) {
        console.log("Published mode 9");
        modeLabel.textContent = "Mode 9";  
    } else {
        console.log("Published mode 8");
        modeLabel.textContent = "Mode 8";  
    }
}
