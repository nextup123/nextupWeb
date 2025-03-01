
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
