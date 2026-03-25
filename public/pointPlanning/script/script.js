const API_BASE = 'http://localhost:3000/point-planning';

// ROS connection
const ros = new ROSLIB.Ros({
    url: 'ws://localhost:9090'
});

ros.on('connection', () => {
    console.log('Connected to ROS bridge');
    showStatus('Connected to ROS bridge', 'success', 1500);
});

ros.on('error', (error) => {
    console.error('ROS connection error:', error);
    showStatus('Failed to connect to ROS bridge', 'error', 2000);
});

ros.on('close', () => {
    console.log('ROS connection closed');
    showStatus('ROS connection closed', 'error', 2000);
});

let points = [];
let editingPointName = null;
let oldPointName = null;
let lastSequence = '1';
let pendingPoint = null;
let confirmCallback = null;
let backupFilesList = [];
let isPressed = false;
let intervalId = null;
let latestJointStateValues = [0, 0, 0, 0, 0, 0]; // Store latest joint values
let latestCartesianValues = [0, 0, 0, 0, 0, 0]; // Store latest cartesian values

// DOM elements
const pointName = document.getElementById('pointName');
const dateTime = document.getElementById('dateTime');
const sequence = document.getElementById('sequence');
const nature = document.getElementById('nature');
const updateBtn = document.getElementById('updateBtn'); // Updated ID to match DOM
const pointList = document.getElementById('pointList');
const sequenceCount = document.getElementById('sequenceCount');
const undoBtn = document.getElementById('undoBtn');
const pointFileName = document.getElementById('point-file-name');
const originPointFileName = document.getElementById('origin-point-file-name');
const pointModal = document.getElementById('pointModal');
const nameChangeModal = document.getElementById('nameChangeModal');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const motionTypeModal = document.getElementById('motionTypeModal');

const historyEntries = document.getElementById('historyEntries');
const fileName = document.getElementById('fileName');
const backupFilesInput = document.getElementById('backupFilesInput');
const backupFilesDropdown = document.getElementById('backupFilesDropdown');
const fileNameErrorModal = document.getElementById('fileNameErrorModal');
const addPointBtn = document.getElementById('addPointBtn');
const pointFileNameInputField = document.getElementById('fileName')

// ---------- UI Smoothing ----------
const UI_UPDATE_RATE_MS = 50; // 20 Hz
let lastJointUI = [0, 0, 0, 0, 0, 0];
let lastCartUI = [0, 0, 0, 0, 0, 0];

function lerp(a, b, t = 0.25) {
    return a + (b - a) * t;
}


// ROS topics
const jointValues = new ROSLIB.Topic({
    ros: ros,
    name: '/joint_values',
    messageType: 'std_msgs/Float64MultiArray'
});

const cartesianValues = new ROSLIB.Topic({
    ros: ros,
    name: '/cartesian_values',
    messageType: 'std_msgs/Float64MultiArray'
});

const uiCommandTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/ui_commands',
    messageType: 'std_msgs/String'
});

const startServoClient = new ROSLIB.Service({
    ros: ros,
    name: '/servo_node/start_servo',
    serviceType: 'std_srvs/srv/Trigger'
});

const disableDeleteTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/disable_delete_point',
    messageType: 'std_msgs/Bool'
});

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

function pubRosString(topicName, messageData) {
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'std_msgs/String'
    });
    const message = new ROSLIB.Message({
        data: messageData
    });
    topic.publish(message);
    console.log(`Published to ${topicName}: ${messageData}`);
}

let updatePointPublishState = false;

// Subscribe to /disable_delete_point topic
disableDeleteTopic.subscribe(function (message) {
    console.log('Received disable_delete_point:', message.data);
    const deleteAllButton = document.querySelector('.btn-reload-points.btn-danger');
    const deleteButtons = document.querySelectorAll('.btn-icon.btn-delete');
    const isDisabled = message.data;

    // Enable/disable Delete All button
    deleteAllButton.disabled = isDisabled;
    deleteAllButton.style.opacity = isDisabled ? '0.5' : '1';
    deleteAllButton.style.cursor = isDisabled ? 'not-allowed' : 'pointer';

    addPointBtn.disabled = isDisabled;
    addPointBtn.style.opacity = isDisabled ? '0.5' : '1';
    addPointBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';

    deleteButtons.forEach(button => {
        button.disabled = isDisabled;
        button.style.opacity = isDisabled ? '0.5' : '1';
        button.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
    });

    updatePointPublishState = isDisabled;

    showStatus(isDisabled ? 'Delete buttons disabled' : 'Delete buttons enabled', 'info', 1500);
});




function disableDeleteButtons() {
    const deleteButtons = document.querySelectorAll('.btn-icon.btn-delete');

    let isDisabled = true;
    deleteButtons.forEach(button => {
        button.disabled = isDisabled;
        button.style.opacity = isDisabled ? '0.5' : '1';
        button.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
    });
    console.log(`disabling delete buttons`);

}


// ROS topics (updated joint_states topic)
const jointStateValues = new ROSLIB.Topic({
    ros: ros,
    name: '/joint_states',
    messageType: 'sensor_msgs/JointState'
});

// Subscribe to joint and cartesian values (updated joint_states subscription)
jointStateValues.subscribe(function (message) {
    // console.log('Received joint states:', message);
    // Map position values to joint1, joint2, ..., joint6 order
    const jointOrder = ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'];
    latestJointStateValues = jointOrder.map(jointName => {
        const index = message.name.indexOf(jointName);
        return index !== -1 ? Number(message.position[index] || 0) : 0;
    });
    // // console.log('Mapped joint values:', latestJointStateValues);
    // document.getElementById('j1val').textContent = latestJointStateValues[0].toFixed(2) + '°';
    // document.getElementById('j2val').textContent = latestJointStateValues[1].toFixed(2) + '°';
    // document.getElementById('j3val').textContent = latestJointStateValues[2].toFixed(2) + '°';
    // document.getElementById('j4val').textContent = latestJointStateValues[3].toFixed(2) + '°';
    // document.getElementById('j5val').textContent = latestJointStateValues[4].toFixed(2) + '°';
    // document.getElementById('j6val').textContent = latestJointStateValues[5].toFixed(2) + '°';
});


// Subscribe to joint and cartesian values
jointValues.subscribe(function (message) {
    // console.log('Received joint values:', message.data);
    document.getElementById('j1val').textContent = message.data[0].toFixed(2) + '°';
    document.getElementById('j2val').textContent = message.data[1].toFixed(2) + '°';
    document.getElementById('j3val').textContent = message.data[2].toFixed(2) + '°';
    document.getElementById('j4val').textContent = message.data[3].toFixed(2) + '°';
    document.getElementById('j5val').textContent = message.data[4].toFixed(2) + '°';
    document.getElementById('j6val').textContent = message.data[5].toFixed(2) + '°';
});

cartesianValues.subscribe(function (message) {
    // console.log('Received cartesian values:', message.data);
    latestCartesianValues = message.data; // Store latest cartesian values
    document.getElementById('xval').textContent = message.data[0].toFixed(2) + ' cm';
    document.getElementById('yval').textContent = message.data[1].toFixed(2) + ' cm';
    document.getElementById('zval').textContent = message.data[2].toFixed(2) + ' cm';
    document.getElementById('rval').textContent = message.data[3].toFixed(2) + '°';
    document.getElementById('pval').textContent = message.data[4].toFixed(2) + '°';
    document.getElementById('wval').textContent = message.data[5].toFixed(2) + '°';
});

// Publish ROS commands
function ros2Publish(data) {
    const message = new ROSLIB.Message({ data: data });
    uiCommandTopic.publish(message);
    console.log('Published:', data);
}

let activeJog = null;
let jogInterval = null;

function stopJog(joint) {
    if (!activeJog) return;

    clearInterval(jogInterval);
    jogInterval = null;

    ros2Publish(`0${activeJog}`);
    console.log(`Stopped ${activeJog}`);

    activeJog = null;
}

['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'cx', 'cy', 'cz', 'cr', 'cp', 'cw'].forEach(joint => {
    const plus = document.getElementById(`${joint}_plus`);
    const minus = document.getElementById(`${joint}_minus`);

    function startJog(direction, e) {
        // ❌ Ignore right click
        if (e.button !== 0) return;

        // ❌ Already jogging
        if (activeJog) stopJog();

        activeJog = joint;
        ros2Publish(`${direction}${joint}`);

        jogInterval = setInterval(() => {
            ros2Publish(`${direction}${joint}`);
        }, 30); // safer than 10ms
    }

    plus.addEventListener('pointerdown', e => startJog('+', e));
    minus.addEventListener('pointerdown', e => startJog('-', e));

    // STOP conditions
    ['pointerup', 'pointercancel', 'mouseleave'].forEach(evt => {
        plus.addEventListener(evt, () => stopJog(joint));
        minus.addEventListener(evt, () => stopJog(joint));
    });
});

window.addEventListener('blur', stopJog);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopJog();
});
window.addEventListener('contextmenu', e => {
    e.preventDefault();
    stopJog();
});


function callStartServo() {
    const button = document.getElementById('startServoButton');
    const request = new ROSLIB.ServiceRequest({});

    // Reset state
    button.classList.remove('success', 'error');

    startServoClient.callService(request, function (result) {
        console.log('Start servo response:', result);

        if (result.success) {
            button.classList.add('success');
        } else {
            button.classList.add('error');
        }

        button.style.background = result.success
            ? 'linear-gradient(135deg, var(--success) 0%, #0a6b4a 100%)'
            : 'linear-gradient(135deg, var(--danger) 0%, #c1121f 100%)';

        showStatus(
            result.success ? 'Servo started' : 'Failed to start servo',
            result.success ? 'success' : 'error',
            2000
        );

        setTimeout(() => {
            button.classList.remove('success', 'error');
            button.style.background =
                'linear-gradient(135deg, #34c759 0%, #28b44f 100%)';
        }, 2000);
    });
}


// Toast notification
function showStatus(message, type = "success", timeout = 3000) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
    toast.innerHTML = `
        <i class="fas fa-${icon} toast-icon"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 10);

    if (timeout > 0) {
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('toast-out');
                setTimeout(() => {
                    if (toast.parentElement) toast.remove();
                }, 300);
            }
        }, timeout);
    }
}

// Generate date_time in DDMMM_HHMM format
function getCurrentDateTime() {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = now.toLocaleString('en-US', { month: 'short' }).toLowerCase();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${day}${month}_${hours}${minutes}`;
}

// Load points from server
async function loadPoints() {
    try {
        const res = await fetch(`${API_BASE}/getPoints`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        points = await res.json();
        updatePointList();
        showStatus(`Reloaded ${points.length} points`, 'success', 1500);
    } catch (err) {
        showStatus(`Failed to reload points: ${err.message}`, 'error', 2000);
        console.error(err);
    }
}

// Load backup file names
async function loadBackupFiles() {
    try {
        const res = await fetch(`${API_BASE}/getPointsBackupFileNames`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        backupFilesList = data.backupFiles;
        console.log('Backup files fetched:', backupFilesList);
        updateBackupFilesDropdown('');
        showStatus(`Loaded ${backupFilesList.length} backup file names`, 'success', 1500);
    } catch (err) {
        showStatus(`Failed to load backup files: ${err.message}`, 'error', 2000);
        console.error(err);
    }
}

// Update backup files dropdown
function updateBackupFilesDropdown(filter) {
    console.log('Updating dropdown with filter:', filter);
    console.log('Available files:', backupFilesList);
    backupFilesDropdown.innerHTML = '<div class="dropdown-item" data-value="">Select a backup file</div>';
    const filteredFiles = backupFilesList.filter(file =>
        file.split('__')[0].toLowerCase().includes(filter.toLowerCase())
    );
    console.log('Filtered files:', filteredFiles);
    filteredFiles.forEach(file => {
        const prefix = file.split('__')[0];
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.dataset.value = file;
        div.textContent = prefix;
        backupFilesDropdown.appendChild(div);
    });
    console.log('Dropdown children:', backupFilesDropdown.children.length);
    setupDropdownItems();
}

// Setup dropdown item event listeners
function setupDropdownItems() {
    const items = backupFilesDropdown.querySelectorAll('.dropdown-item');
    console.log('Dropdown items setup:', items.length);
    items.forEach((item, index) => {
        item.addEventListener('click', () => {
            backupFilesInput.value = item.textContent;
            backupFilesInput.dataset.value = item.dataset.value;
            backupFilesDropdown.style.display = 'none';
            showStatus(`Selected ${item.textContent}`, 'success', 1500);
            console.log('Selected item:', item.textContent, 'Value:', item.dataset.value);
        });
    });
}

// Toggle dropdown visibility
function toggleDropdown() {
    backupFilesDropdown.style.display =
        backupFilesDropdown.style.display === 'block' ? 'none' : 'block';
    console.log('Dropdown toggled, display:', backupFilesDropdown.style.display);
}

// Handle dropdown search
backupFilesInput.addEventListener('input', () => {
    updateBackupFilesDropdown(backupFilesInput.value);
    backupFilesDropdown.style.display = 'block';
});

// Show dropdown on focus
backupFilesInput.addEventListener('focus', () => {
    updateBackupFilesDropdown(backupFilesInput.value);
    backupFilesDropdown.style.display = 'block';
});

// Hide dropdown on click outside
document.addEventListener('click', (e) => {
    if (!backupFilesInput.contains(e.target) && !backupFilesDropdown.contains(e.target)) {
        backupFilesDropdown.style.display = 'none';
        console.log('Dropdown hidden (click outside)');
    }
});

// Keyboard navigation for dropdown
backupFilesInput.addEventListener('keydown', (e) => {
    const items = backupFilesDropdown.querySelectorAll('.dropdown-item');
    if (!items.length) return;
    let selectedIndex = Array.from(items).findIndex(item => item.classList.contains('selected'));

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % items.length;
        items.forEach(item => item.classList.remove('selected'));
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
        console.log('ArrowDown, selected index:', selectedIndex);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + items.length) % items.length;
        items.forEach(item => item.classList.remove('selected'));
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
        console.log('ArrowUp, selected index:', selectedIndex);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0) {
            backupFilesInput.value = items[selectedIndex].textContent;
            backupFilesInput.dataset.value = items[selectedIndex].dataset.value;
            backupFilesDropdown.style.display = 'none';
            showStatus(`Selected ${items[selectedIndex].textContent}`, 'success', 1500);
            console.log('Enter pressed, selected:', items[selectedIndex].textContent);
        }
    }
});

// Update point list UI
function updatePointList() {
    sequenceCount.textContent = points.length;
    pointList.innerHTML = points.length === 0 ? `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No points added yet</p>
            <small>Start by adding a point using the editor</small>
        </div>
    ` : '';

    points.forEach((point, index) => {
        const div = document.createElement('div');
        div.className = 'point-item';
        div.draggable = true;
        div.dataset.name = point.name;
        div.innerHTML = `
            <div class="point-index-container">
                <span class="drag-handle"></span>
                <span class="point-index">${index + 1}</span>
            </div>
            <div class="point-content">
                <div class="point-details">
                    <span class="badge badge-primary point-name" onclick="showPointDetails('${point.name}')">${point.name}</span>
                    <span class="badge badge-secondary">Seq: ${point.sequence}</span>
                </div>
            </div>
            <div class="point-actions">
                <button class="btn-icon btn-move"
                    onclick="openMotionTypeModal('${point.name}')">
                    <i class="fa-solid fa-location-arrow"></i>
                </button>


                <button class="btn-icon btn-edit" onclick="editPoint('${point.name}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="showConfirmModal('Delete point ${point.name}?', () => deletePoint('${point.name}'))">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        pointList.appendChild(div);
    });
    initPointDragAndDrop();
}
// Define topic publisher
const moveitLastPoseTopic = new ROSLIB.Topic({
    ros: ros,
    name: "/ui_commands",
    messageType: "std_msgs/String"
});
const cartesianMotionTopic = new ROSLIB.Topic({
    ros: ros,
    name: "/cartesian_motion",
    messageType: "std_msgs/Bool"
});

const jointMotionTopic = new ROSLIB.Topic({
    ros: ros,
    name: "/joint_motion",
    messageType: "std_msgs/Bool"
});


// Function to publish
function moveToPoint(point_name) {
    const msg = new ROSLIB.Message({
        data: point_name   // String data
    });
    moveitLastPoseTopic.publish(msg);
    console.log("Published point name:", point_name);
}

// Initialize drag-and-drop for points
function initPointDragAndDrop() {
    const items = pointList.querySelectorAll('.point-item');
    items.forEach(item => {
        item.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', item.dataset.name);
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('drop', e => {
            e.preventDefault();
            const draggedName = e.dataTransfer.getData('text/plain');
            const targetItem = e.target.closest('.point-item');
            if (!targetItem || draggedName === targetItem.dataset.name) return;

            const items = Array.from(pointList.querySelectorAll('.point-item'));
            const draggedItem = pointList.querySelector(`.point-item[data-name="${draggedName}"]`);
            const targetIndex = items.indexOf(targetItem);
            const draggedIndex = items.indexOf(draggedItem);

            if (draggedIndex < targetIndex) {
                targetItem.after(draggedItem);
            } else {
                targetItem.before(draggedItem);
            }

            const newOrder = Array.from(pointList.querySelectorAll('.point-item')).map(item => item.dataset.name);
            reorderPoints(newOrder);
        });
    });

}

// Reorder points
async function reorderPoints(pointNames) {
    await callAPI('reorderPoints', { pointNames }, loadPoints);
}

// Format number for display
function formatNumber(num) {
    return Number(num).toFixed(5);
}

// Show point details in modal
function showPointDetails(name) {
    const point = points.find(p => p.name === name);
    if (!point) return;
    document.getElementById('modalName').textContent = `Name: ${point.name}`;
    document.getElementById('modalDateTime').textContent = `Date Time: ${point.date_time}`;
    document.getElementById('modalSequence').textContent = `Sequence: ${point.sequence}`;
    document.getElementById('modalNature').textContent = `Nature: ${point.nature}`;
    document.getElementById('modalJoints').textContent = `Joints: (${formatNumber(point.joints_values.joint1)}, ${formatNumber(point.joints_values.joint2)}, ${formatNumber(point.joints_values.joint3)}, ${formatNumber(point.joints_values.joint4)}, ${formatNumber(point.joints_values.joint5)}, ${formatNumber(point.joints_values.joint6)})`;
    document.getElementById('modalCoordinates').textContent = `Coordinates: (${formatNumber(point.coordinate.x)}, ${formatNumber(point.coordinate.y)}, ${formatNumber(point.coordinate.z)}, ${formatNumber(point.coordinate.r)}, ${formatNumber(point.coordinate.p)}, ${formatNumber(point.coordinate.w)})`;

    const historyContainer = document.getElementById('historyEntries');
    historyContainer.innerHTML = '';
    if (!point.history) {
        historyContainer.innerHTML = '<p class="history-entry">No history available</p>';
    } else {
        const serialEntry = document.createElement('p');
        serialEntry.className = 'history-entry';
        serialEntry.textContent = `Latest: ${point.history.Serial}`;
        historyContainer.appendChild(serialEntry);

        const historyKeys = Object.keys(point.history).filter(k => k !== 'Serial' && !isNaN(k)).map(Number).sort((a, b) => a - b);
        historyKeys.forEach(key => {
            const entry = document.createElement('p');
            entry.className = 'history-entry';
            entry.textContent = `${key}: ${point.history[key]}`;
            historyContainer.appendChild(entry);
        });
    }

    pointModal.style.display = 'flex';
}

// Close point details modal
function closePointModal() {
    pointModal.style.display = 'none';
}

// Close name change error modal
function closeNameChangeModal() {
    nameChangeModal.style.display = 'none';
    pendingPoint = null;
}

// Close file name error modal
function closeFileNameErrorModal() {
    fileNameErrorModal.style.display = 'none';
}

// Show confirmation modal
function showConfirmModal(message, callback) {
    confirmMessage.textContent = message;
    confirmCallback = callback;
    confirmModal.style.display = 'flex';
}

// Close confirmation modal
function closeConfirmModal() {
    confirmModal.style.display = 'none';
    confirmCallback = null;
}

// Confirm action
function confirmAction() {
    if (confirmCallback) confirmCallback();
    closeConfirmModal();
}


let selectedPointForMotion = null;

// Open motion selection modal
function openMotionTypeModal(pointName) {
    selectedPointForMotion = pointName;
    motionTypeModal.style.display = 'flex';
}

// Close modal
function closeMotionTypeModal() {
    motionTypeModal.style.display = 'none';
    selectedPointForMotion = null;
}

function selectMotionType(type) {

    if (!selectedPointForMotion) return;

    // ✅ Capture point name BEFORE modal close
    const pointName = selectedPointForMotion;

    // Publish motion type
    if (type === 'cartesian') {
        cartesianMotionTopic.publish(new ROSLIB.Message({ data: true }));
        jointMotionTopic.publish(new ROSLIB.Message({ data: false }));
        console.log("Cartesian motion selected");
    } else {
        cartesianMotionTopic.publish(new ROSLIB.Message({ data: false }));
        jointMotionTopic.publish(new ROSLIB.Message({ data: true }));
        console.log("Joint motion selected");
    }

    closeMotionTypeModal(); // safe now

    // Delay then move
    setTimeout(() => {
        moveToPoint(`get_last_pose@${pointName}`);
    }, 500);
}



// Get point data from form
function getPointFromForm() {
    return {
        name: pointName.value.trim(),
        date_time: getCurrentDateTime(),
        sequence: Number(sequence.value),
        nature: nature.value.trim(),
        joints_values: {
            joint1: Number(latestJointStateValues[0] || 0),
            joint2: Number(latestJointStateValues[1] || 0),
            joint3: Number(latestJointStateValues[2] || 0),
            joint4: Number(latestJointStateValues[3] || 0),
            joint5: Number(latestJointStateValues[4] || 0),
            joint6: Number(latestJointStateValues[5] || 0)
        },
        coordinate: {
            x: Number(latestCartesianValues[0] || 0),
            y: Number(latestCartesianValues[1] || 0),
            z: Number(latestCartesianValues[2] || 0),
            r: Number(latestCartesianValues[3] || 0),
            p: Number(latestCartesianValues[4] || 0),
            w: Number(latestCartesianValues[5] || 0)
        }
    };
}

// Validate point data
function validatePoint(point) {
    if (!point.name || !/^[a-zA-Z0-9-]+$/.test(point.name)) {
        showStatus('Point name must contain only letters, numbers, and dashes', 'error', 3000);
        return false;
    }
    if (!point.nature || point.nature.length > 30) {
        showStatus('Nature is required and must be 30 characters or less', 'error', 3000);
        return false;
    }
    if (isNaN(point.sequence) || point.sequence < 1 || point.sequence > 10) {
        showStatus('Sequence must be between 1 and 10', 'error', 3000);
        return false;
    }
    // Check if joint and cartesian values are valid
    if (!latestJointStateValues.every(val => !isNaN(val)) || !latestCartesianValues.every(val => !isNaN(val))) {
        showStatus('Invalid joint or cartesian values received', 'error', 3000);
        return false;
    }
    return true;
}

setInterval(() => {
    console.log(latestJointStateValues);
    
}, 1000);

// Add a new point
async function addPoint() {
    const point = getPointFromForm();
    if (!validatePoint(point)) return;
    await callAPI('addPoint', point, () => {
        clearForm();
        loadPoints();
    });
}

// Add point from name change modal
async function addPointFromNameChange() {
    if (!pendingPoint) return;
    if (!validatePoint(pendingPoint)) {
        closeNameChangeModal();
        return;
    }
    await callAPI('addPoint', pendingPoint, () => {
        clearForm();
        loadPoints();
        closeNameChangeModal();
    });
}

// Edit a point
function editPoint(name) {
    const point = points.find(p => p.name === name);
    if (!point) return;
    editingPointName = name;
    oldPointName = name;
    pointName.value = point.name;
    pointName.readOnly = true;
    pointName.classList.add('input-readonly');
    dateTime.value = point.date_time;
    sequence.value = point.sequence;
    nature.value = point.nature;
    lastSequence = point.sequence;

    const updateButton = document.getElementById('updateBtn');
    console.log('updateBtn enabled');
    updateButton.disabled = false;
    updateButton.style.opacity = '1';
    updateButton.style.cursor = 'pointer';

    showStatus(`Editing ${name}`, 'success', 2000);
}

// Delete a point
async function deletePoint(name) {
    await callAPI('deletePoint', { name }, loadPoints);
}

// Delete all points
async function deleteAll() {
    await callAPI('deleteAll', {}, loadPoints);
}

// Perform undo
async function performUndo() {
    undoBtn.disabled = true;
    await callAPI('undo', {}, () => {
        loadPoints();
        checkUndo();
    });
}

// Check if undo is available
async function checkUndo() {
    try {
        const res = await fetch(`${API_BASE}/canUndo`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        undoBtn.disabled = !data.canUndo;
    } catch (err) {
        undoBtn.disabled = true;
        showStatus(`Failed to check undo: ${err.message}`, 'error', 2000);
    }
}

// Save file
function saveFile() {
    const name = fileName.value.trim();
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
        showStatus('File name must contain only letters, numbers, and underscores', 'error', 3000);
        return;
    }
    console.log(`File saved with ${name}`);
    pubRosString('save_point_file_to_backup', name);
    showStatus(`File saved with ${name}`, 'success', 2000);
}

// Load file
function loadFile() {
    const fullName = backupFilesInput.dataset.value;
    if (!fullName) {
        showStatus('Please select a backup file to load', 'error', 3000);
        return;
    }
    console.log(`${fullName} file loaded`);
    pubRosString('load_backup_point_file', fullName);

    setTimeout(() => {
        reloadPoints();
        updatePointFileName();
        setTimeout(() => {
            pubRosBool('disable_delete_point', true);
        }, 500);
        showStatus(`${backupFilesInput.value} file loaded`, 'success', 2000);
    }, 500);
}

// Create new file
function createNewFile() {
    const name = fileName.value.trim();
    if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
        fileNameErrorModal.style.display = 'flex';
        return;
    }
    console.log(`New blank file created with name: ${name}`);
    pubRosString('new_file_name_to_backup', name);

    setTimeout(() => {
        reloadPoints();
        updatePointFileName();
        setTimeout(() => {
            pubRosBool('disable_delete_point', false);
        }, 500);
        showStatus(`New blank file created with name: ${name}`, 'success', 2000);
        pointFileNameInputField.value = ''
    }, 500);
}

// Delete file
function deleteFile() {
    const fullName = backupFilesInput.dataset.value;
    if (!fullName) {
        showStatus('Please select a backup file to delete', 'error', 3000);
        return;
    }
    console.log(`${fullName} file deleted`);
    pubRosString('delete_backup_point_file', fullName);

    setTimeout(() => {
        reloadPoints();
        updatePointFileName();
        setTimeout(() => {
            pubRosBool('disable_delete_point', true);
        }, 500);
        showStatus(`${backupFilesInput.value} file deleted`, 'success', 2000);
        clearBackupFileForm();
    }, 500);
}

// Clear backup file form
function clearBackupFileForm() {
    backupFilesInput.value = '';
    loadBackupFiles();
    showStatus('Backup File Form refreshed', 'success', 1500);
}

// API call function
async function callAPI(endpoint, body, callback) {
    showStatus('Processing...', 'info', 1000);
    try {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            showStatus(data.message, 'success', 2000);
            if (callback) callback();
        } else {
            showStatus(data.message, 'error', 3000);
        }
    } catch (err) {
        showStatus(`Connection error: ${err.message}`, 'error', 3000);
    }
}

// Clear form and reset state
function clearForm() {
    pointName.value = '';
    pointName.readOnly = false;
    pointName.classList.remove('input-readonly');
    dateTime.value = 'Auto-generated';
    sequence.value = lastSequence;
    nature.value = '';
    editingPointName = null;
    oldPointName = null;
    updateBtn.disabled = true;
    updateBtn.style.opacity = '0.5';
    updateBtn.style.cursor = 'not-allowed';
    showStatus('Form cleared', 'success', 1500);
}

// Update point file name
async function updatePointFileName() {
    try {
        const res = await fetch(`${API_BASE}/getPointFileName`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        const fileName = data.points_file_name || 'No file name';
        pointFileName.textContent = fileName;
        originPointFileName.textContent = fileName;

        // Show status if no file name
        if (fileName === 'No file name' || fileName === 'null') {
            showStatus('Create or load a file to start', 'info', 3000);
        }
    } catch (err) {
        showStatus(`Failed to update file name: ${err.message}`, 'error', 2000);
    }
}

// Reload points
async function reloadPoints() {
    await loadPoints();
}

// Persist sequence selection
sequence.addEventListener('change', () => {
    lastSequence = sequence.value;
});

// Initialize
async function init() {
    sequence.value = lastSequence;
    await loadPoints();
    await updatePointFileName();
    await checkUndo();
    await loadBackupFiles();
}

async function updatePoint() {
    if (!editingPointName) {
        showStatus('No point selected for editing', 'error', 3000);
        return;
    }
    const point = getPointFromForm();
    if (!validatePoint(point)) return;
    if (point.name !== oldPointName) {
        pendingPoint = point;
        nameChangeModal.style.display = 'flex';
        return;
    }
    const body = { oldName: oldPointName, ...point };
    await callAPI('updatePoint', body, () => {
        clearForm();
        loadPoints();
    });
    if (updatePointPublishState) {
        pubRosString('/edited_point_name', point.name);
        console.log(`publish ho gya ${point.name}`);
        
        setTimeout(() => {
            reloadPoints();
            updatePointFileName();
            showStatus(`${point.name} published`, 'info', 2000);
        }, 500);
    }
    else
    {
        console.log(`publish hona tha  ${point.name} , par updatePointPublishState condition m et ni ho  paayi`);

    }

    if (updatePointPublishState) {
        setTimeout(() => {
            disableDeleteButtons();
        }, 700);
    }
}

document.addEventListener('DOMContentLoaded', init);



// Ensure initial state
document.addEventListener('DOMContentLoaded', () => {
    const deleteAllButton = document.querySelector('.btn-reload-points.btn-danger');
    const deleteButtons = document.querySelectorAll('.btn-icon.btn-delete');
    const updateButton = document.getElementById('updateBtn');

    deleteAllButton.disabled = true;
    deleteAllButton.style.opacity = '0.5';
    deleteAllButton.style.cursor = 'not-allowed';

    // Initialize update button as disabled
    updateButton.disabled = true;
    updateButton.style.opacity = '0.5';
    updateButton.style.cursor = 'not-allowed';
    updatePointPublishState = false;

    addPointBtn.disabled = true;
    addPointBtn.style.opacity = '0.5';
    addPointBtn.style.cursor = 'not-allowed';


    setTimeout(() => {
        disableDeleteButtons();
    }, 1000);

    pubRosBool('disable_delete_point', true);

});
