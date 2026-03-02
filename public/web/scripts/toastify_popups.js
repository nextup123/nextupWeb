// Toast configuration for each topic
const boolTopicConfigs = {
    '/planning_successful': {
        true: {
            message: 'Planned Successfully', duration: 3000, icon: 'fa-solid fa-handshake', bgColor: 'toast-done'
        },
        false: {
            message: 'Planning Failed', duration: 3000, icon: 'fa-solid fa-times-circle', bgColor: 'toast-error'
        }
    },
    '/delete_last_path_confirmation': {
        true: {
            message: 'Last Path Deleted Success', duration: 3000, icon: 'fa-solid fa-trash-can', bgColor: 'toast-done'
        }
    },
    '/path_save_successfully': {
        true: {
            message: 'Path Saved Successfully', duration: 3000, icon: 'fa-solid fa-handshake', bgColor: 'toast-done'
        }
    },
    '/point_save_successfully': {
        true: {
            message: 'Point Saved Successfully', duration: 3000, icon: 'fa-solid fa-handshake', bgColor: 'toast-done'
        }
    },
    '/path_file_empty': {
        true: {
            message: 'Path Yaml Found  Empty', duration: 3000, icon: 'fa-solid fa-hourglass', bgColor: 'toast-done'
        }
    },
    '/point_file_empty': {
        true: {
            message: 'Point Yaml Found  Empty', duration: 3000, icon: 'fa-solid fa-hourglass', bgColor: 'toast-done'
        }
    },
    '/delete_last_point_confirmation': {
        true: {
            message: 'Last Point Deleted Successfully', duration: 3000, icon: 'fa-solid fa-trash-can', bgColor: 'toast-done'
        }
    },
    '/delete_all_path_confirmation': {
        true: {
            message: 'All Path Deleted Successfully', duration: 3000, icon: 'fa-solid fa-trash-can', bgColor: 'toast-done'
        }
    },
    '/delete_all_point_confirmation': {
        true: {
            message: 'All Point Deleted Successfully', duration: 3000, icon: 'fa-solid fa-trash-can', bgColor: 'toast-done'
        }
    },
    '/yaml_points_check': {
        true: {
            message: 'Need One More Point', duration: 3000, icon: 'fa-solid fa-folder-open', bgColor: 'toast-done'
        }
    },
    '/execute_last_success': {
        true: {
            message: 'Execute Last Successful', duration: 3000, icon: 'fa-solid fa-recycle', bgColor: 'toast-done'
        }
    },
};



// Toast configuration for String topics (message-based)
const stringTopicConfigs = {
    '/testfiles': {
        'ready': { message: 'Robot is ready', duration: 3000, icon: 'fa-solid fa-check', bgColor: 'toast-done' },
        'Battery low': { message: 'Battery Low!', duration: 5000, icon: 'fa-solid fa-battery-quarter', bgColor: 'toast-error' },
        'Obstacle detected': { message: 'Obstacle Detected', duration: 4000, icon: 'fa-solid fa-exclamation-triangle', bgColor: 'toast-warning' }
    },
    // '/error_message': {
    //     'Critical failure': { message: 'Critical Failure!', duration: 6000, icon: 'fa-solid fa-skull-crossbones', bgColor: 'toast-error' },
    //     'System overheating': { message: 'System Overheating', duration: 5000, icon: 'fa-solid fa-temperature-high', bgColor: 'toast-warning' }
    // }
};

// Track active toasts to prevent duplicates
const activeToasts = new Set();

// Subscribe to ROS topics
Object.keys(boolTopicConfigs).forEach(topicName => {
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'std_msgs/Bool'
    });

    topic.subscribe((message) => {
        const state = message.data ? 'true' : 'false';
        const config = boolTopicConfigs[topicName][state];

        if (!activeToasts.has(`${topicName}-${state}`)) {
            showToast(config.message, config.duration, config.icon, config.bgColor, `${topicName}-${state}`);
        }
    });
});

// Subscribe to String topics
Object.keys(stringTopicConfigs).forEach(topicName => {
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'std_msgs/String'
    });

    topic.subscribe((message) => {
        const topicConfig = stringTopicConfigs[topicName];
        const messageText = message.data;

        // Get the config for the exact message
        const config = topicConfig?.[messageText];

        if (config) {
            const toastId = `${topicName}-${messageText}`;
            if (!activeToasts.has(toastId)) {
                showToast(config.message, config.duration, config.icon, config.bgColor, toastId);
            }
        } else {
            console.warn(`No toast config found for message: "${messageText}" in topic: "${topicName}"`);
        }
    });
});

// Toast function
function showToast(message, duration, icon, toastBgColor, toastId) {
    const toastContainer = document.getElementById("toastContainer");

    // Create toast element
    const toast = document.createElement("div");
    toast.classList.add("toast");
    if (toastBgColor) toast.classList.add(toastBgColor);
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
            <button class="toast-close-button" onclick="this.parentElement.remove(); activeToasts.delete('${toastId}');" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

    // Append toast to container
    toastContainer.appendChild(toast);
    activeToasts.add(toastId);

    // Auto-remove toast after duration
    setTimeout(() => {
        toast.remove();
        activeToasts.delete(toastId);
    }, duration);
}

ros.onopen = function () {
    console.log('Connected to ROS2 WebSocket');

    // Subscribe to '/files'
    ros.send(JSON.stringify({
        op: 'subscribe',
        topic: '/files',
        type: 'std_msgs/String'
    }));

    // Subscribe to 'update_path_number'
    ros.send(JSON.stringify({
        op: 'subscribe',
        topic: 'update_path_number',
        type: 'std_msgs/String'
    }));
};



ros.on('connection', () => {
    console.log('Connected to ROS2 WebSocket');

    // Subscribe to '/files'
    const filesTopic = new ROSLIB.Topic({
        ros: ros,
        name: '/files',
        messageType: 'std_msgs/String'
    });

    filesTopic.subscribe((message) => {
        handleFilesMessage(message.data);
    });

    // Subscribe to '/update_path_number'
    const pathNumberTopic = new ROSLIB.Topic({
        ros: ros,
        name: '/update_path_number',
        messageType: 'std_msgs/String'
    });

    pathNumberTopic.subscribe((message) => {
        handlePathNumberMessage(message.data);
    });
});



// Message mapping with downloaded icons
const popup_multiplanData = {
    'fdps': { text: 'File Not Deleted', type: 'error', icon: './svgs/solid/hard-drive.svg' },
    'dps': { text: 'File Deleted', type: 'error', icon: './svgs/solid/trash-can.svg' },

    'point_fail': { text: 'Point File Not Saved', type: 'error', icon: './svgs/solid/trash-can.svg' },
    'point_success': { text: 'Point File Saved Successfully', type: 'success', icon: './svgs/solid/hard-drive.svg' },

    'path_fail': { text: 'Path File Not Saved', type: 'error', icon: './svgs/solid/trash-can.svg' },
    'path_success': { text: 'Path File Saved Successfully', type: 'success', icon: './svgs/solid/hard-drive.svg' },

    'point_copy_success': { text: 'Point File Loaded Successfully', type: 'success', icon: './svgs/solid/hard-drive.svg' },
    'point_copy_fail': { text: 'Point File Loaded Failed', type: 'error', icon: './svgs/solid/trash-can.svg' },

    'path_copy_success': { text: 'Path File Loaded Successfully', type: 'success', icon: './svgs/solid/hard-drive.svg' },
    'path_copy_fail': { text: 'Path File Loaded Failed', type: 'error', icon: './svgs/solid/trash-can.svg' }
};

// Function to handle messages from '/files' topic
function handleFilesMessage(data) {
    if (popup_multiplanData[data]) {
        const { text, type, icon } = popup_multiplanData[data];
        showpopup_multiplan(text, type, icon);
    }
}

// Function to handle messages from '/update_path_number' topic
function handlePathNumberMessage(data) {
    const pathNumber = data.match(/\d+/);
    if (pathNumber) {
        showpopup_multiplan(`Path ${pathNumber[0]} Updated Successfully`, 'warning', './svgs/solid/download.svg');
    }
}

// Function to show popups
function showpopup_multiplan(message, type, iconPath) {
    const popup_multiplan = document.getElementById('popup_multiplan');
    // const popup_multiplanIcon = document.getElementById('popup_multiplan-icon');
    const popup_multiplanMessage = document.getElementById('popup_multiplan-message');

    // Set message and icon
    popup_multiplanMessage.innerText = message;
    // popup_multiplanIcon.src = iconPath;

    // Ensure icon is visible if it has a valid src
    // popup_multiplanIcon.style.display = iconPath ? 'block' : 'none';

    // Apply popup styling
    popup_multiplan.className = `popup_multiplan ${type}`;
    popup_multiplan.style.display = 'flex';

    setTimeout(() => {
        popup_multiplan.style.display = 'none';
        popup_multiplanMessage.innerText = ''; // Clear message
        // popup_multiplanIcon.src = ''; // Clear icon
        // popup_multiplanIcon.style.display = 'none'; // Hide icon again
    }, 5000);
}
