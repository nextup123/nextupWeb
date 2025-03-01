document.addEventListener('DOMContentLoaded', function () {
    // Define the ROS publisher
    const pathPublisher = new ROSLIB.Topic({
        ros: ros,
        name: '/point_data',
        messageType: 'std_msgs/String',
    });


    // Helper function to generate a unique ID
    function generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
   }

    // Get references to elements
    const savePointButton = document.getElementById('savePointButton');
    const popup = document.getElementById('popup1');
    const nameField = document.getElementById('name_point');
    const submitButton = document.getElementById('submit');
    const cancelButton = document.getElementById('cancel');

    // Show the Save Point popup and auto-focus on the input field
    savePointButton.addEventListener('click', function () {
        popup.style.display = 'block'; // Show popup
        nameField.value = ''; // Clear the input field
        nameField.focus(); // Focus the input field
    });

    // Handle Submit Button in Save Point Popup
    submitButton.addEventListener('click', async function (event) {
        event.preventDefault(); // Prevent form submission

        const name = nameField.value.trim();

        // Validate the input (alphanumeric only)
        if (!name.match(/^[A-Za-z0-9_]+$/)) {
            showAlert('Please enter a valid alphanumeric name.', 'warning');
            return;
        }

        // Generate a UUID for the ID field
        const uuid = generateUniqueId();

        // Create the YAML data
        const yamlData = `- name: ${name}\n  id: ${uuid}\n  type: point`;

        try {
            // Send the data to the backend
            const response = await fetch('http://localhost:3001/save-point', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ yamlData }),
            });

            if (response.ok) {
                // Publish the name to the /path_data topic
                const pathMessage = new ROSLIB.Message({
                    data: name,
                });
                pathPublisher.publish(pathMessage);
                console.log(`Published "${name}" to /point_data topic.`);
            } else {
                showAlert('Failed to save point.', 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('An error occurred while saving the point.', 'error');
        }

        // Clear the input field and close the popup
        nameField.value = '';
        popup.style.display = 'none';
    });

    // Handle Cancel Button in Save Point Popup
    cancelButton.addEventListener('click', function (event) {
        event.preventDefault(); // Prevent form submission

        // Clear the input field and close the popup
        nameField.value = '';
        popup.style.display = 'none';
    });
});





document.addEventListener('DOMContentLoaded', function () {
    // Define the ROS publisher
    const pathPublisher = new ROSLIB.Topic({
        ros: ros,
        name: '/ui_commands',
        messageType: 'std_msgs/String',
    });

    // Get references to elements
    const repeatButton = document.getElementById('repeat-button');
    const repeatPopUp = document.getElementById('repeat-pop-up');
    const repetitionsField = document.getElementById('repetitions'); // Note: ID is 'repetions'
    const repeatSubmitButton = document.getElementById('repeat-submit');
    const repeatCancelButton = document.getElementById('repeat-cancel');

    // Show the popup and auto-focus on the input field
    repeatButton.addEventListener('click', function () {
        repeatPopUp.style.display = 'block'; // Show popup
        repetitionsField.value = ''; // Clear the input field
        repetitionsField.focus(); // Focus the input field
    });

    // Handle Submit Button in popup
    repeatSubmitButton.addEventListener('click', function (event) {
        event.preventDefault(); // Prevent form submission

        const repetitions = repetitionsField.value.trim();

        // Validate the input is a number
        if (!repetitions || isNaN(repetitions)) {
            showAlert('Please enter a valid number.', 'error');
            return;
        }

        // Publish the numeric value to the ROS2 topic
        const pathMessage = new ROSLIB.Message({
            data: "repeat"+repetitions,
        });
        pathPublisher.publish(pathMessage);
        console.log(`Published "${repetitions}" to /ui_commands topic.`);

        // Clear the input field and close the popup
        repetitionsField.value = '';
        repeatPopUp.style.display = 'none';
    });

    // Handle Cancel Button in popup
    repeatCancelButton.addEventListener('click', function (event) {
        event.preventDefault(); // Prevent form submission

        // Clear the input field and close the popup
        repetitionsField.value = '';
        repeatPopUp.style.display = 'none';
    });
});

/*confirmation publishing js -- satyanshu*/

function handleButtonClick(name) {
    showCustomConfirm(`Do you want to publish data for "${name}"?`, (userResponse) => {
        if (userResponse) {
            publishStringMessage("ui_commands", `get_last_pose@${name}`);
        } else {
            console.log(`Publishing cancelled for: ${name}`);
        }
    });
}

function showCustomConfirm(message, callback) {
    const customConfirm = document.getElementById('customConfirm');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmYes = document.getElementById('confirmYes');
    const confirmNo = document.getElementById('confirmNo');

    confirmMessage.textContent = message;
    customConfirm.style.display = 'flex';

    confirmYes.onclick = function() {
        customConfirm.style.display = 'none';
        callback(true);
    };

    confirmNo.onclick = function() {
        customConfirm.style.display = 'none';
        callback(false);
    };
}
/*confirmation publishing js -- satyanshu*/

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
