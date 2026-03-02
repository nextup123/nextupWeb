let autoGenPublisher = new ROSLIB.Topic({
  ros: ros,
  name: '/auto_plan_sequence',
  messageType: 'std_msgs/String'
});

function autoGenOpenPopup() {
  document.getElementById("auto-gen-popup").style.display = "flex";
  document.getElementById("auto-gen-popup-message").textContent = "";
}

function autoGenClosePopup() {
  document.getElementById("auto-gen-popup").style.display = "none";
}

function autoGenPublishDefault() {
  let msg = new ROSLIB.Message({ data: "default" });
  autoGenPublisher.publish(msg);
  setTimeout(() => {
    reloadPaths();
    reloadPoints()
  }, 2000);
  autoGenShowSuccess("Default auto-generate published!");
}

function autoGenPublishSequence() {
  const rawInput = document.getElementById("auto-gen-sequence-input").value.trim();

  // Validate: only numbers and commas allowed
  if (!/^[0-9,]+$/.test(rawInput)) {
    autoGenShowError("Only numbers and commas are allowed!");
    return;
  }

  // Split by commas → then split each group into individual digits
  const groups = rawInput.split(",").map(group => group.split("").join(","));

  // Join groups with "&"
  const formatted = groups.join("&");

  // Publish ROS message
  let msg = new ROSLIB.Message({ data: formatted });
  autoGenPublisher.publish(msg);

  // Reload paths after 2s
  setTimeout(() => {
    reloadPaths();
  }, 2000);

  autoGenShowSuccess(`Sequence [${formatted}] published!`);
}


function autoGenShowSuccess(text) {
  const message = document.getElementById("auto-gen-popup-message");
  message.style.color = "#34c759";
  message.textContent = text;
  setTimeout(autoGenClosePopup, 700);
}

function autoGenShowError(text) {
  const message = document.getElementById("auto-gen-popup-message");
  message.style.color = "#ff3b30";
  message.textContent = text;
}


// DOM elements for Paths YAML modal
const pathsYAMLOutput = document.getElementById('pathsYAMLOutput');
const pathsYAMLModal = document.getElementById('pathsYAMLModal');
let pathsYAMLFontSize = 11; // Default font size in pixels
let pathsYAMLContent = '';
let pathsData = []; // Cache for full paths data

// Open Paths YAML modal (default to full YAML)
function openPathsYAMLModal() {
    reloadPathsYAML();
    pathsYAMLOutput.textContent = pathsYAMLContent || 'No YAML available';
    pathsYAMLModal.style.display = 'flex';
}

// Close Paths YAML modal
function closePathsYAMLModal() {
    pathsYAMLModal.style.display = 'none';
}

// Change font size
function changePathsYAMLFontSize(delta) {
    pathsYAMLFontSize += delta;
    if (pathsYAMLFontSize < 7) pathsYAMLFontSize = 7; // Minimum font size
    if (pathsYAMLFontSize > 24) pathsYAMLFontSize = 24; // Maximum font size
    pathsYAMLOutput.style.fontSize = pathsYAMLFontSize + 'px';
}

// Copy Paths YAML to clipboard
function copyPathsYAML() {
    navigator.clipboard.writeText(pathsYAMLOutput.textContent)
        .then(() => showStatus('Paths YAML copied to clipboard', 'success', 2000))
        .catch(() => showStatus('Failed to copy Paths YAML', 'error', 3000));
}

// Reload Paths YAML content
async function reloadPathsYAML() {
    try {
        const res = await fetch(`${API_BASE}/getPathsYAML`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        pathsData = data.paths || []; // Cache full paths data
        // Default to full YAML view
        pathsYAMLContent = jsyaml.dump({ paths: pathsData });
        pathsYAMLOutput.textContent = pathsYAMLContent || 'No YAML available';
        showStatus('Paths YAML reloaded', 'success', 1500);
    } catch (err) {
        pathsData = [];
        pathsYAMLOutput.textContent = 'Failed to load Paths YAML';
        showStatus(`Failed to reload Paths YAML: ${err.message}`, 'error', 2000);
        console.error(err);
    }
}

// Show full YAML view
function showFullPathsYAML() {
    pathsYAMLContent = jsyaml.dump({ paths: pathsData });
    pathsYAMLOutput.textContent = pathsYAMLContent || 'No YAML available';
    showStatus('Switched to Full YAML view', 'success', 1500);
}

// Show names-only YAML view
function showNamesOnlyYAML() {
    const names = pathsData.map(p => p.name);
    pathsYAMLContent = jsyaml.dump({ paths: names });
    pathsYAMLOutput.textContent = pathsYAMLContent || 'No YAML available';
    showStatus('Switched to Names Only view', 'success', 1500);
}