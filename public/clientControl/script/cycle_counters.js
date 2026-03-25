// cycle_counters.js
// document.addEventListener('DOMContentLoaded', async () => {
const currentEl = document.getElementById('current-operation');
const lastSessionEl = document.getElementById('last-session');
const totalEl = document.getElementById('total-operation');
const resetBtn = document.getElementById('reset-total');

let cycleTopic;
let currentCount = 0;
let lastCount = 0;
let lastSession = 0;
let totalOperations = 0;

// --- Load saved data from backend ---
async function loadSettings() {
    try {
        const res = await fetch('/settings');
        const data = await res.json();
        lastSession = data.last_session_operations || 0;
        totalOperations = data.total_operations || 0;
        updateUI();
        console.log('Loaded previous cycle data:', data);
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

// --- Save updated cycle data ---
async function saveSettings() {
    try {
        const res = await fetch('/settings');
        const data = await res.json();
        data.total_operations = totalOperations;
        data.last_session_operations = lastSession;
        await fetch('/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (err) {
        console.error('Error saving cycle data:', err);
    }
}



cycleTopic = new ROSLIB.Topic({
    ros,
    name: '/cycle_count',
    messageType: 'std_msgs/msg/Int32'
});

cycleTopic.subscribe(msg => handleCycle(msg.data));
// }

// --- Core Logic ---
function handleCycle(newCount) {
    currentCount = newCount;

    // Case 1: Normal increment
    if (currentCount > lastCount) {
        const diff = currentCount - lastCount;
        totalOperations += diff; // increment total
        lastCount = currentCount;
    }

    // Case 2: Restart (new session)
    else if (currentCount < lastCount) {
        // Save last session count
        lastSession = lastCount;
        console.log(`🔄 New session detected. Last session: ${lastSession}`);

        // Reset tracking for new session
        lastCount = currentCount;
    }

    updateUI();
    saveSettings();
}

// --- Update UI values ---
function updateUI() {
    currentEl.textContent = currentCount;
    lastSessionEl.textContent = lastSession;
    totalEl.textContent = totalOperations;
}

// --- Reset total button ---
resetBtn.addEventListener('click', async () => {
    try {
        const res = await fetch('/cycle/reset');
        const data = await res.json();
        totalOperations = 0;
        updateUI();
        console.log('✅ Total operations reset:', data);
    } catch (err) {
        console.error('Failed to reset total:', err);
    }
});

// --- Initialize ---
loadSettings();
// });
