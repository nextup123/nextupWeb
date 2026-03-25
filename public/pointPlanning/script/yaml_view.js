// DOM elements for YAML modal
const yamlOutput = document.getElementById('yamlOutput');
const yamlModal = document.getElementById('yamlModal');
let currentFontSize = 11; // Default font size in pixels
let yamlContent = '';
// Open YAML modal
function openYAMLModal() {
    reloadYAML();
    yamlOutput.textContent = yamlContent || 'No YAML available';
    yamlModal.style.display = 'flex';
}

// Close YAML modal
function closeYAMLModal() {
    yamlModal.style.display = 'none';
}

// Change font size
function changeFontSize(delta) {
    currentFontSize += delta;
    if (currentFontSize < 7) currentFontSize = 7; // Minimum font size
    if (currentFontSize > 24) currentFontSize = 24; // Maximum font size
    yamlOutput.style.fontSize = currentFontSize + 'px';
}

// Copy YAML to clipboard
function copyYAML() {
    navigator.clipboard.writeText(yamlOutput.textContent)
        .then(() => showStatus('YAML copied to clipboard', 'success', 2000))
        .catch(() => showStatus('Failed to copy YAML', 'error', 3000));
}

// Reload YAML content
async function reloadYAML() {
    try {
        const res = await fetch(`${API_BASE}/getPoints`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const points = await res.json();
        // Convert points array to YAML format
        yamlContent = jsyaml.dump({ points: points });
        yamlOutput.textContent = yamlContent || 'No YAML available';
        showStatus('YAML reloaded', 'success', 1500);
    } catch (err) {
        yamlOutput.textContent = 'Failed to load YAML';
        showStatus(`Failed to reload YAML: ${err.message}`, 'error', 2000);
        console.error(err);
    }
}


const modeOpPublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/change_mode',
    messageType: 'std_msgs/String'
});

const jointStateSub = new ROSLIB.Topic({
    ros: ros,
    name: '/nextup_joint_states',
    messageType: 'nextup_joint_interfaces/msg/NextupJointState'
});

const modeToggle = document.getElementById("mode-op-toggle");

let uiUpdateFromROS = false;   // 🔐 prevents republish loop
let modeOperationStatus = null; // 8 or 9

const USER_MODE_CHANGE_LOCK_MS = 1000;
let userModeLock = false;


modeToggle.addEventListener("change", function () {
  if (uiUpdateFromROS) return;     // ⛔ ROS-driven change
  if (userModeLock) return;        // ⛔ rapid user click

  userModeLock = true;
  modeToggle.disabled = true;      // 🔒 lock UI

  const mode = this.checked ? "9" : "8";
  console.log("📤 Publishing mode change:", mode);

  modeOpPublisher.publish(
    new ROSLIB.Message({ data: mode })
  );

  // 🔓 unlock after delay
  setTimeout(() => {
    userModeLock = false;
    modeToggle.disabled = false;
    console.log("🔓 Mode toggle re-enabled");
  }, USER_MODE_CHANGE_LOCK_MS);
});


const UPDATE_INTERVAL_MS = 500;   // 2 Hz
let lastUpdateTime = 0;

jointStateSub.subscribe((msg) => {
    const now = Date.now();

    // ⛔ Throttle to 2 Hz
    if (now - lastUpdateTime < UPDATE_INTERVAL_MS) return;
    lastUpdateTime = now;

    if (!msg.modeofoperation || msg.modeofoperation.length === 0) return;

    const modes = msg.modeofoperation;

    const firstMode = modes[0];
    const allSame = modes.every(m => m === firstMode);

    if (!allSame || (firstMode !== 8 && firstMode !== 9)) {
        console.warn("⚠️ Mixed or invalid modes detected:", modes);
        return;
    }

    if (modeOperationStatus === firstMode) return;

    modeOperationStatus = firstMode;
    console.log("📥 Live mode-operation-status:", modeOperationStatus);

    uiUpdateFromROS = true;
    modeToggle.checked = (modeOperationStatus === 9);
    uiUpdateFromROS = false;
});
