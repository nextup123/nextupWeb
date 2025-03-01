// Get references to the elements
const editMultipathsButton = document.getElementById('editMultipaths');
const multipathPopup = document.getElementById('multipathPopup');
const closePopup = document.querySelector('.close-popup');
const pointFileDropdown = document.getElementById('pointFileDropdown');
const pathFileDropdown = document.getElementById('pathFileDropdown');
const deletePointFileButton = document.getElementById('deletePointFile');
const deletePathFileButton = document.getElementById('deletePathFile');
const savePointFileButton = document.getElementById('savePointFile');
const savePathFileButton = document.getElementById('savePathFile');

// ROS connection and topic listeners
let pointFileListener;
let pathFileListener;

// Function to show the popup and subscribe to topics
editMultipathsButton.addEventListener('click', () => {
    multipathPopup.style.display = 'flex';

    // Subscribe to /point_files topic
    pointFileListener = new ROSLIB.Topic({
        ros: ros,
        name: '/point_files',
        messageType: 'std_msgs/String'
    });

    pointFileListener.subscribe((message) => {
        const files = message.data.split(' ');
        updateDropdown(pointFileDropdown, files);
    });

    // Subscribe to /path_files topic
    pathFileListener = new ROSLIB.Topic({
        ros: ros,
        name: '/path_files',
        messageType: 'std_msgs/String'
    });

    pathFileListener.subscribe((message) => {
        const files = message.data.split(' ');
        updateDropdown(pathFileDropdown, files);
    });
});

// function publishRosString(topicName, messageData) {
//     const topic = new ROSLIB.Topic({
//         ros: ros,
//         name: topicName,
//         messageType: 'std_msgs/String'
//     });
//     const message = new ROSLIB.Message({
//         data: messageData
//     });
//     topic.publish(message);
//     console.log(`Published to ${topicName}: ${messageData}`);
// }

// Function to hide the popup and unsubscribe from topics
closePopup.addEventListener('click', () => {
    multipathPopup.style.display = 'none';

    // Unsubscribe from topics
    if (pointFileListener) {
        pointFileListener.unsubscribe();
    }
    if (pathFileListener) {
        pathFileListener.unsubscribe();
    }
});

// Function to update dropdown options
function updateDropdown(dropdown, files) {
    const selectedValue = dropdown.value; // Store current selection

    dropdown.innerHTML = ''; // Clear existing options

    files.forEach(file => {
        const option = document.createElement('option');
        option.value = file;
        option.textContent = file;
        dropdown.appendChild(option);
    });

    // Restore previous selection if it exists
    if (files.includes(selectedValue)) {
        dropdown.value = selectedValue;
    }
}

// Function to publish the selected dropdown value
function publishSelectedDropdownValue(dropdown, topic) {
    const selectedValue = dropdown.value;
    if (selectedValue) {
        publishRosString(topic, selectedValue);
    }
}

// Attach event listeners for dropdown selection changes
pointFileDropdown.addEventListener('change', () => publishSelectedDropdownValue(pointFileDropdown, '/point_file_name'));
pathFileDropdown.addEventListener('change', () => publishSelectedDropdownValue(pathFileDropdown, '/path_file_name'));


// Attach event listeners to Save buttons
document.getElementById('savePointFile').addEventListener('click', () => openSavePopup('/multipointsfiles'));
document.getElementById('savePathFile').addEventListener('click', () => openSavePopup('/multipathsfiles'));


const savePopup = document.getElementById('savePopup');
const fileNameInput = document.getElementById('fileNameInput');
const confirmSaveButton = document.getElementById('confirmSaveButton');
const closeSavePopup = document.querySelector('.close-save-popup');

let saveType = "";

// Open Save Popup and set the ROS2 topic
function openSavePopup(topic) {
    saveTopic = topic;
    fileNameInput.value = ''; // Clear previous input
    savePopup.style.display = 'flex';
}

// Close popup when clicking outside content
savePopup.addEventListener('click', (event) => {
    if (event.target === savePopup) {
        savePopup.style.display = 'none';
    }
});

// Close Save Popup on button click
closeSavePopup.addEventListener('click', () => {
    savePopup.style.display = 'none';
});

confirmSaveButton.addEventListener('click', () => {
    const fileName = fileNameInput.value.trim();

    // Regex to allow only alphanumeric characters and underscores
    const validFileNamePattern = /^[a-zA-Z0-9_]+$/;

    if (!fileName) {
        showAlert("Please enter a valid file name.", 'warning');
    } else if (!validFileNamePattern.test(fileName)) {
        showAlert("File name can only contain letters, numbers, and underscores (_).", 'warning');
    } else {
        publishRosString(saveTopic, fileName);
        savePopup.style.display = 'none';
    }
});


// Attach event listeners to Delete buttons
document.getElementById('deletePointFile').addEventListener('click', () => deleteSelectedOption(pointFileDropdown, '/delete_point_files'));
document.getElementById('deletePathFile').addEventListener('click', () => deleteSelectedOption(pathFileDropdown, '/delete_path_files'));

function deleteSelectedOption(dropdown, topic) {
    const selectedOption = dropdown.value;
    if (!selectedOption) return;

    publishRosString(topic, selectedOption);

    // console.log(`Deleted ${selectedOption} from ${topic}`);

    // Simulate removal from UI
    const newFiles = Array.from(dropdown.options).map(opt => opt.value).filter(file => file !== selectedOption);
    // updateDropdown(dropdown, newFiles);
}

document.getElementById('updatePaths').addEventListener('click', () => publishBoolMessage('/update_path', true));



// Get references to UI elements
const editPointButton = document.getElementById('editPoint');
const editPointPopup = document.getElementById('editPointPopup');
const closeEditPopup = document.querySelector('.close-edit-popup');
const prevPointDropdown = document.getElementById('prevPointDropdown');
const newPointDropdown = document.getElementById('newPointDropdown');
const selectedFileLabel = document.getElementById('selectedFileLabel');
const savePointChangesButton = document.getElementById('savePointChanges');

// Function to show Edit Point Popup
editPointButton.addEventListener('click', () => {
    editPointPopup.style.display = 'flex';

    // Set selected file from pointFileDropdown
    selectedFileLabel.textContent = pointFileDropdown.value || 'None';
});

// Close Edit Point Popup
closeEditPopup.addEventListener('click', () => {
    editPointPopup.style.display = 'none';
});

// Subscribe to /current_point_names topic to get dropdown values
const pointNamesListener = new ROSLIB.Topic({
    ros: ros,
    name: '/current_point_names',
    messageType: 'std_msgs/String'
});

pointNamesListener.subscribe((message) => {
    const pointNames = message.data.split(' ');
    updateDropdown(prevPointDropdown, pointNames);
    updateDropdown(newPointDropdown, pointNames);
});

// Function to publish edit point data
savePointChangesButton.addEventListener('click', () => {
    const previousName = prevPointDropdown.value;
    const newName = newPointDropdown.value;
    const selectedFile = pointFileDropdown.value;

    if (!previousName || !newName || !selectedFile) {
        showAlert("Please select all required fields.", 'error');
        return;
    }

    // const editPointData = JSON.stringify({
    //     previous_name: previousName,
    //     new_name: newName,
    //     selected_file: selectedFile
    // });

    const editPointData = `previous_name: ${previousName}, new_name: ${newName}, selected_file: ${selectedFile}`;

    publishRosString('/edit_point', editPointData);
});
