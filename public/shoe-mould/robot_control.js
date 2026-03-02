// robot_control.js - Integrated with Shoe Mould Control System

// Global ROS connection (shared with other scripts if needed)
let ros = null;
let currentSpeedScale = 1.0;

// Override state
let overrideState = {
    enabled: false,
    joints: false,
    fault: false,
    auto: false
};

// Initialize ROS connection
function initRosConnection() {
    // Check if ROS is already connected (from another script)
    if (typeof window.ros !== 'undefined' && window.ros) {
        ros = window.ros;
        console.log('✅ Using existing ROS connection');
        onRosConnected();
        return;
    }

    // Create new ROS connection
    ros = new ROSLIB.Ros({
        url: 'ws://localhost:9090' // Adjust to your ROS bridge URL
    });

    window.ros = ros; // Make globally available

    ros.on('connection', () => {
        console.log('✅ Connected to ROS');
        updateRosStatus('Connected', true);
        onRosConnected();
    });

    ros.on('error', (error) => {
        console.error('❌ ROS connection error:', error);
        updateRosStatus('Error', false);
    });

    ros.on('close', () => {
        console.log('🔌 ROS connection closed');
        updateRosStatus('Disconnected', false);
        // Attempt reconnection
        setTimeout(initRosConnection, 3000);
    });
}

function updateRosStatus(status, isConnected) {
    const statusEl = document.getElementById('rosStatus');
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = 'status-value ' + (isConnected ? 'connected' : 'disconnected');
    }
}

function onRosConnected() {
    setupRobotControl();
    setupProcessControl();
    setupSubscribers();
}

// ==============================
// Robot Control Functions
// ==============================

function setupRobotControl() {
    const startBtn = document.getElementById('start-btn');
    const exitBtn = document.getElementById('exit-btn');
    const runonceBtn = document.getElementById('runonce-btn');

    if (!startBtn || !exitBtn || !runonceBtn) {
        console.error('❌ Robot control buttons not found');
        return;
    }

    // Initially disable start buttons
    setTimeout(() => {
        setStartButtonsEnabled(false);
    }, 100);

    startBtn.addEventListener('click', () => handleStartClick());
    exitBtn.addEventListener('click', () => handleExitClick());
    runonceBtn.addEventListener('click', () => handleRunOnceClick());
}

function setStartButtonsEnabled(enabled) {
    const startBtn = document.getElementById('start-btn');
    const runonceBtn = document.getElementById('runonce-btn');
    
    [startBtn, runonceBtn].forEach(btn => {
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle('btn-disabled', !enabled);
    });
}

function canRobotStart() {
    // Check override conditions
    if (overrideState.enabled) {
        return { allowed: true, issues: [] };
    }

    const issues = [];
    
    // Add your actual checks here
    // Example: Check if joints are operational, no faults, etc.
    
    return { allowed: issues.length === 0, issues };
}

function showStartBlockedModal(issues) {
    const message = issues.length > 0 
        ? 'Cannot start:\n• ' + issues.join('\n• ')
        : 'Start conditions not met';
    showToast(message, true);
}

function handleStartClick() {
    const { allowed, issues } = canRobotStart();
    if (!allowed) {
        showStartBlockedModal(issues);
        return;
    }

    console.log('▶️ START clicked');
    publishString('/change_mode', '8');
    publishSpeed(currentSpeedScale);
    
    setTimeout(() => {
        publishBool('/control_start_bt', true);
    }, 750);
}

function handleExitClick() {
    console.log('🛑 EXIT clicked');
    publishBool('/control_reset_bt', true);
}

function handleRunOnceClick() {
    const { allowed, issues } = canRobotStart();
    if (!allowed) {
        showStartBlockedModal(issues);
        return;
    }

    console.log('🔁 RUN ONCE clicked');
    publishString('/change_mode', '8');
    publishSpeed(currentSpeedScale);

    setTimeout(() => {
        publishBool('/control_start_bt', true);
        setTimeout(() => {
            publishBool('/control_reset_bt', true);
        }, 3000);
    }, 750);
}

// ==============================
// Process Control
// ==============================

function setupProcessControl() {
    const toggle = document.getElementById('processToggle');
    if (!toggle) return;

    toggle.addEventListener('click', () => {
        const isRunning = toggle.classList.contains('active');
        const newState = isRunning ? 'stop' : 'start';
        
        // Optimistic UI update
        toggle.classList.toggle('active');
        document.getElementById('processStatusIndicator').classList.toggle('running');
        
        publishString('/control_process_control_bt', newState);
    });
}

function setupSubscribers() {
    if (!ros) return;

    // Subscribe to start button active state
    const startBtSub = new ROSLIB.Topic({
        ros: ros,
        name: '/control_start_bt_active',
        messageType: 'std_msgs/Bool'
    });
    
    startBtSub.subscribe((msg) => {
        setStartButtonsEnabled(msg.data);
    });

    // Subscribe to process status
    const processStatusSub = new ROSLIB.Topic({
        ros: ros,
        name: '/control_process_control_bt_status',
        messageType: 'std_msgs/String'
    });
    
    processStatusSub.subscribe((msg) => {
        const isRunning = msg.data && msg.data.toLowerCase().includes('running');
        const toggle = document.getElementById('processToggle');
        const indicator = document.getElementById('processStatusIndicator');
        
        if (toggle) toggle.classList.toggle('active', isRunning);
        if (indicator) indicator.classList.toggle('running', isRunning);
    });

    // Subscribe to robot mode
    const modeSub = new ROSLIB.Topic({
        ros: ros,
        name: '/robot_mode',
        messageType: 'std_msgs/String'
    });
    
    modeSub.subscribe((msg) => {
        const modeEl = document.getElementById('robotMode');
        if (modeEl) modeEl.textContent = msg.data || '--';
    });
}

// ==============================
// Publisher Helpers
// ==============================

function publishBool(topicName, value) {
    if (!ros) return;
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'std_msgs/Bool'
    });
    topic.publish(new ROSLIB.Message({ data: value }));
}

function publishString(topicName, value) {
    if (!ros) return;
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: topicName,
        messageType: 'std_msgs/String'
    });
    topic.publish(new ROSLIB.Message({ data: value }));
}

function publishSpeed(speed) {
    if (!ros) return;
    const topic = new ROSLIB.Topic({
        ros: ros,
        name: '/speed_override',
        messageType: 'std_msgs/Float64'
    });
    topic.publish(new ROSLIB.Message({ data: speed }));
}

// ==============================
// Override Modal Functions
// ==============================

function openOverrideModal() {
    const modal = document.getElementById('override-modal');
    if (modal) {
        // Load current state
        document.getElementById('override-enable').checked = overrideState.enabled;
        document.getElementById('override-joints').checked = overrideState.joints;
        document.getElementById('override-fault').checked = overrideState.fault;
        document.getElementById('override-auto').checked = overrideState.auto;
        
        modal.classList.add('show');
    }
}

function closeOverrideModal() {
    const modal = document.getElementById('override-modal');
    if (modal) modal.classList.remove('show');
}

function applyOverrides() {
    overrideState = {
        enabled: document.getElementById('override-enable').checked,
        joints: document.getElementById('override-joints').checked,
        fault: document.getElementById('override-fault').checked,
        auto: document.getElementById('override-auto').checked
    };
    
    console.log('Override settings applied:', overrideState);
    showToast('Override settings applied', false);
    closeOverrideModal();
}

// ==============================
// Initialize
// ==============================

document.addEventListener('DOMContentLoaded', () => {
    // Setup settings button
    const settingsBtn = document.getElementById('btnSettings');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openOverrideModal);
    }
    
    // Initialize ROS connection
    initRosConnection();
});