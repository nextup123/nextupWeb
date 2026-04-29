const API_BASE = "http://localhost:3000/point-planning";
const WS_URL = `ws://${window.location.host}`; // Use same host as your server

let points = [];
let editingPointName = null;
let oldPointName = null;
let lastSequence = "1";
let pendingPoint = null;
let confirmCallback = null;
let backupFilesList = [];

// Store latest values
let latestJointStateValues = [0, 0, 0, 0, 0, 0];
let latestJointValues = [0, 0, 0, 0, 0, 0];
let latestCartesianValues = [0, 0, 0, 0, 0, 0];
let updatePointPublishState = false;

// DOM elements
const pointName = document.getElementById("pointName");
const dateTime = document.getElementById("dateTime");
const sequence = document.getElementById("sequence");
const nature = document.getElementById("nature");
const updateBtn = document.getElementById("updateBtn");
const pointList = document.getElementById("pointList");
const sequenceCount = document.getElementById("sequenceCount");
const undoBtn = document.getElementById("undoBtn");
// const pointFileName = document.getElementById("point-file-name");
const originPointFileName = document.getElementById("origin-point-file-name");
const pointModal = document.getElementById("pointModal");
const nameChangeModal = document.getElementById("nameChangeModal");
const confirmModal = document.getElementById("confirmModal");
const confirmMessage = document.getElementById("confirmMessage");
const motionTypeModal = document.getElementById("motionTypeModal");
const historyEntries = document.getElementById("historyEntries");
const fileName = document.getElementById("fileName");
const backupFilesInput = document.getElementById("backupFilesInput");
const backupFilesDropdown = document.getElementById("backupFilesDropdown");
const fileNameErrorModal = document.getElementById("fileNameErrorModal");
const addPointBtn = document.getElementById("addPointBtn");
const pointFileNameInputField = document.getElementById("fileName");

// WebSocket Connection

window.addEventListener("message", (event) => {
  const msg = event.data;

  if (!msg || !msg.type) return;

  handleWebSocketMessage(msg);
});

// Handle WebSocket messages from backend
function handleWebSocketMessage(msg) {
  switch (msg.type) {
    case "DRIVER_STATUS":
      // Update joint status display
      if (msg.payload && msg.payload.jointStatus) {
        updateJointStatusDisplay(msg.payload.jointStatus);
      }
      if (msg.payload && msg.payload.faultStatus) {
        updateFaultStatusDisplay(msg.payload.faultStatus);
      }
      break;

    case "EMERGENCY_STATUS":
      if (msg.payload && msg.payload.jointStatus) {
        updateEmergencyStatus(msg.payload.jointStatus);
      }
      break;

    case "MOTION_ACTIVE":
    case "DO_STATUS":
    case "CYCLE_TIME":
    case "LOG_MESSAGE_INCOMING":
    case "MOTION_PLANNING_SUCCESS":
    case "CONTROL_ACTIVE":
      // Update motion active state
      // const isActive = msg.payload;
      // console.log("Motion active in pointPlanning:", isActive);

      // You can update UI elements here if needed
      // For example, enable/disable buttons based on motion state
      // const startServoButton = document.getElementById("startServoButton");
      // if (startServoButton) {
      //   startServoButton.disabled = isActive;
      //   startServoButton.style.opacity = isActive ? "0.6" : "1";
      //   startServoButton.style.cursor = isActive ? "not-allowed" : "pointer";
      // }
      break;
    case "ACTIVE_NODES":
      break;

    case "JOINT_VALUES":
      const values = msg.payload.values;
      if (Array.isArray(values)) {
        latestJointValues = values;
        updateJointDisplay(); // ← ADD THIS
      } else if (typeof values === "object") {
        latestJointValues = Object.values(values);
        updateJointDisplay();
      } else {
        console.error("Invalid JOINT_VALUES:", values);
        return;
      }
      break;

    case "CARTESIAN_VALUES":
      const carValues = msg.payload.values;
      if (Array.isArray(carValues)) {
        latestCartesianValues = carValues;
        updateCartesianDisplay(); // ← ADD THIS
      } else if (typeof carValues === "object") {
        latestCartesianValues = Object.values(carValues);
        updateCartesianDisplay();
      } else {
        console.error("Invalid CARTESIAN_VALUES:", carValues);
        return;
      }
      break;
    case "SERVO_RESPONSE":
      handleServoResponse(msg.payload);
      break;
    case "JOINT_STATES":
      // console.log(msg.payload);
      const jointOrder = ['joint1', 'joint2', 'joint3', 'joint4', 'joint5', 'joint6'];

      latestJointStateValues = jointOrder.map(jointName => {
        const index = msg.payload.name.indexOf(jointName);
        return index !== -1 ? Number(msg.payload.position[index] || 0) : 0;
      });
      // console.log(latestJointStateValues);
      break;
    case "MOTION_STATUS":
      // mainWeb handles homing display; pointPlanning can ignore or use raw positions
      break;
    case "PROCESS_STATUS":
      break;
    default:
      console.log("Unknown message type in pointPlanning.js:", msg.type);
  }
}

function updateJointStatusDisplay(jointStatus) {
  // Update UI based on joint status
  jointStatus.forEach((status, index) => {
    const element = document.getElementById(`j${index + 1}_status`);
    if (element) {
      element.textContent = status ? "ON" : "OFF";
      element.style.color = status ? "green" : "red";
    }
  });
}

function updateFaultStatusDisplay(faultStatus) {
  faultStatus.forEach((fault, index) => {
    const element = document.getElementById(`j${index + 1}_fault`);
    if (element) {
      element.textContent = fault ? "FAULT" : "OK";
      element.style.color = fault ? "red" : "green";
    }
  });
}

function updateEmergencyStatus(emergency) {
  const emergencyElement = document.getElementById("emergency_status");
  if (emergencyElement) {
    const hasEmergency = emergency.some((e) => e === true);
    emergencyElement.textContent = hasEmergency ? "EMERGENCY" : "NORMAL";
    emergencyElement.style.color = hasEmergency ? "red" : "green";
  }
}

function updateJointDisplay() {
  document.getElementById("j1val").textContent =
    latestJointValues[0].toFixed(2) + "°";
  document.getElementById("j2val").textContent =
    latestJointValues[1].toFixed(2) + "°";
  document.getElementById("j3val").textContent =
    latestJointValues[2].toFixed(2) + "°";
  document.getElementById("j4val").textContent =
    latestJointValues[3].toFixed(2) + "°";
  document.getElementById("j5val").textContent =
    latestJointValues[4].toFixed(2) + "°";
  document.getElementById("j6val").textContent =
    latestJointValues[5].toFixed(2) + "°";
}

function updateCartesianDisplay() {
  document.getElementById("xval").textContent =
    latestCartesianValues[0].toFixed(2) + " cm";
  document.getElementById("yval").textContent =
    latestCartesianValues[1].toFixed(2) + " cm";
  document.getElementById("zval").textContent =
    latestCartesianValues[2].toFixed(2) + " cm";
  document.getElementById("rval").textContent =
    latestCartesianValues[3].toFixed(2) + "°";
  document.getElementById("pval").textContent =
    latestCartesianValues[4].toFixed(2) + "°";
  document.getElementById("wval").textContent =
    latestCartesianValues[5].toFixed(2) + "°";
}

function handleServoResponse(response) {
  const button = document.getElementById("startServoButton");
  const success = response && response.success;

  button.classList.add(success ? "success" : "error");
  button.style.background = success
    ? "linear-gradient(135deg, var(--success) 0%, #0a6b4a 100%)"
    : "linear-gradient(135deg, var(--danger) 0%, #c1121f 100%)";

  showStatus(
    success ? "Servo started" : "Failed to start servo",
    success ? "success" : "error",
    2000,
  );

  setTimeout(() => {
    button.classList.remove("success", "error");
    button.style.background =
      "linear-gradient(135deg, #34c759 0%, #28b44f 100%)";
  }, 2000);
}

// Toast notification
function showStatus(message, type = "success", timeout = 3000) {
  let toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  let icon =
    type === "success"
      ? "check-circle"
      : type === "error"
        ? "exclamation-circle"
        : "info-circle";
  toast.innerHTML = `
        <i class="fas fa-${icon} toast-icon"></i>
        <div class="toast-content">${message}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = "translateX(0)";
    toast.style.opacity = "1";
  }, 10);

  if (timeout > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add("toast-out");
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
  const day = now.getDate().toString().padStart(2, "0");
  const month = now.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  return `${day}${month}_${hours}${minutes}`;
}

// Load points from server
async function loadPoints() {
  try {
    const res = await fetch(`${API_BASE}/getPoints`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    points = await res.json();
    console.log(points);
    updatePointList();
    showStatus(`Reloaded ${points.length} points`, "success", 1500);
  } catch (err) {
    showStatus(`Failed to reload points: ${err.message}`, "error", 2000);
    console.error(err);
  }
}

// Update backup files dropdown


// Setup dropdown item event listeners
function setupDropdownItems() {
  const items = backupFilesDropdown.querySelectorAll(".dropdown-item");
  items.forEach((item) => {
    item.addEventListener("click", () => {
      backupFilesInput.value = item.textContent;
      backupFilesInput.dataset.value = item.dataset.value;
      backupFilesDropdown.style.display = "none";
      showStatus(`Selected ${item.textContent}`, "success", 1500);
    });
  });
}

// Keyboard navigation for dropdown


// Update point list UI
function updatePointList() {
  sequenceCount.textContent = points.length;
  pointList.innerHTML =
    points.length === 0
      ? `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No points added yet</p>
            <small>Start by adding a point using the editor</small>
        </div>
    `
      : "";

  points.forEach((point, index) => {
    const div = document.createElement("div");
    div.className = `point-item${point.is_tf ? " is-tf" : ""}`;  // ← change this line
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
            ${point.is_tf ? `<span class="badge-tf"><span class="tf-dot"></span>TF</span>` : ""}
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

// Send motion command via WebSocket
function sendMotionCommand(command) {
  window.parent.postMessage(
    {
      type: "UI_COMMANDS",
      payload: { command },
    },
    "*",
  );
}

// Start servo via WebSocket
function callStartServo() {
  window.parent.postMessage(
    {
      type: "START_SERVO",
      payload: {},
    },
    "*",
  );
}

const toggle = document.getElementById("mode-op-toggle");

toggle.addEventListener("change", function () {
  const mode = this.checked ? "jog" : "auto";
  changeMode(mode);
});

function changeMode(mode) {
  window.parent.postMessage(
    {
      type: "CHANGE_MODE",
      payload: { mode }
    },
    "*"
  );
}

// Jogging functionality
let activeJog = null;
let jogInterval = null;

function stopJog(joint) {
  if (!activeJog) return;

  clearInterval(jogInterval);
  jogInterval = null;

  sendMotionCommand(`0${activeJog}`);

  activeJog = null;
}

// Initialize jog buttons
[
  "j1",
  "j2",
  "j3",
  "j4",
  "j5",
  "j6",
  "cx",
  "cy",
  "cz",
  "cr",
  "cp",
  "cw",
].forEach((joint) => {
  const plus = document.getElementById(`${joint}_plus`);
  const minus = document.getElementById(`${joint}_minus`);

  function startJog(direction, e) {
    if (e.button !== 0) return;
    if (activeJog) stopJog();

    activeJog = joint;
    sendMotionCommand(`${direction}${joint}`);

    jogInterval = setInterval(() => {
      sendMotionCommand(`${direction}${joint}`);
    }, 30);
  }

  if (plus) plus.addEventListener("pointerdown", (e) => startJog("+", e));
  if (minus) minus.addEventListener("pointerdown", (e) => startJog("-", e));

  if (plus) {
    ["pointerup", "pointercancel", "mouseleave"].forEach((evt) => {
      plus.addEventListener(evt, () => stopJog(joint));
    });
  }
  if (minus) {
    ["pointerup", "pointercancel", "mouseleave"].forEach((evt) => {
      minus.addEventListener(evt, () => stopJog(joint));
    });
  }
});

window.addEventListener("blur", () => stopJog());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopJog();
});
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  stopJog();
});

// Move to point
async function moveToPoint(point_name) {
  try {
    const res = await fetch(`/ros/moveToPoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pointName: point_name }),
    });
    const data = await res.json();
    if (res.ok) {
      showStatus(`Moving to ${point_name}`, "info", 2000);
    } else {
      showStatus(`Failed to move to point: ${data.message}`, "error", 2000);
    }
  } catch (err) {
    console.error("Failed to move to point:", err);
    showStatus("Connection error moving to point", "error", 2000);
  }
}

// Initialize drag-and-drop for points
function initPointDragAndDrop() {
  const items = pointList.querySelectorAll(".point-item");
  items.forEach((item) => {
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", item.dataset.name);
      item.classList.add("dragging");
    });
    item.addEventListener("dragend", () => {
      item.classList.remove("dragging");
    });
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedName = e.dataTransfer.getData("text/plain");
      const targetItem = e.target.closest(".point-item");
      if (!targetItem || draggedName === targetItem.dataset.name) return;

      const items = Array.from(pointList.querySelectorAll(".point-item"));
      const draggedItem = pointList.querySelector(
        `.point-item[data-name="${draggedName}"]`,
      );
      const targetIndex = items.indexOf(targetItem);
      const draggedIndex = items.indexOf(draggedItem);

      if (draggedIndex < targetIndex) {
        targetItem.after(draggedItem);
      } else {
        targetItem.before(draggedItem);
      }

      const newOrder = Array.from(
        pointList.querySelectorAll(".point-item"),
      ).map((item) => item.dataset.name);
      reorderPoints(newOrder);
    });
  });
}

// Reorder points
async function reorderPoints(pointNames) {
  await callAPI("reorderPoints", { pointNames }, loadPoints);
}

// Format number for display
function formatNumber(num) {
  return Number(num).toFixed(5);
}

// Show point details in modal
function showPointDetails(name) {
  const point = points.find((p) => p.name === name);
  if (!point) return;
  document.getElementById("modalName").textContent = `Name: ${point.name}`;
  document.getElementById("modalDateTime").textContent =
    `Date Time: ${point.date_time}`;
  document.getElementById("modalSequence").textContent =
    `Sequence: ${point.sequence}`;
  document.getElementById("modalNature").textContent =
    `Nature: ${point.nature}`;
  document.getElementById("modalJoints").textContent =
    `Joints: (${formatNumber(point.joints_values.joint1)}, ${formatNumber(point.joints_values.joint2)}, ${formatNumber(point.joints_values.joint3)}, ${formatNumber(point.joints_values.joint4)}, ${formatNumber(point.joints_values.joint5)}, ${formatNumber(point.joints_values.joint6)})`;
  document.getElementById("modalCoordinates").textContent =
    `Coordinates: (${formatNumber(point.coordinate.x)}, ${formatNumber(point.coordinate.y)}, ${formatNumber(point.coordinate.z)}, ${formatNumber(point.coordinate.r)}, ${formatNumber(point.coordinate.p)}, ${formatNumber(point.coordinate.w)})`;

  const historyContainer = document.getElementById("historyEntries");
  historyContainer.innerHTML = "";
  if (!point.history) {
    historyContainer.innerHTML =
      '<p class="history-entry">No history available</p>';
  } else {
    const serialEntry = document.createElement("p");
    serialEntry.className = "history-entry";
    serialEntry.textContent = `Latest: ${point.history.Serial}`;
    historyContainer.appendChild(serialEntry);

    const historyKeys = Object.keys(point.history)
      .filter((k) => k !== "Serial" && !isNaN(k))
      .map(Number)
      .sort((a, b) => a - b);
    historyKeys.forEach((key) => {
      const entry = document.createElement("p");
      entry.className = "history-entry";
      entry.textContent = `${key}: ${point.history[key]}`;
      historyContainer.appendChild(entry);
    });
  }

  pointModal.style.display = "flex";
}

// Close point details modal
function closePointModal() {
  pointModal.style.display = "none";
}

// Close name change error modal
function closeNameChangeModal() {
  nameChangeModal.style.display = "none";
  pendingPoint = null;
}

// Close file name error modal
function closeFileNameErrorModal() {
  fileNameErrorModal.style.display = "none";
}

// Show confirmation modal
function showConfirmModal(message, callback) {
  confirmMessage.textContent = message;
  confirmCallback = callback;
  confirmModal.style.display = "flex";
}

// Close confirmation modal
function closeConfirmModal() {
  confirmModal.style.display = "none";
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
  motionTypeModal.style.display = "flex";
}

// Close modal
function closeMotionTypeModal() {
  motionTypeModal.style.display = "none";
  selectedPointForMotion = null;
}

async function selectMotionType(type) {
  if (!selectedPointForMotion) return;

  const pointName = selectedPointForMotion;

  try {
    // Send motion type selection via REST
    await fetch(`/ros/setMotionType`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motionType: type }),
    });

    closeMotionTypeModal();

    // Delay then move
    setTimeout(() => {
      moveToPoint(`get_last_pose@${pointName}`);
    }, 500);
  } catch (err) {
    console.error("Failed to set motion type:", err);
    showStatus("Failed to set motion type", "error", 2000);
  }
}

// Get point data from form
function getPointFromForm() {
  return {
    name: document.getElementById("is_tf").checked?`${pointName.value.trim()}-tf`:pointName.value.trim(),
    date_time: getCurrentDateTime(),
    sequence: Number(sequence.value),
    nature: nature.value.trim(),
    is_tf: document.getElementById("is_tf").checked,   // ← ADD THIS
    joints_values: {
      joint1: Number(latestJointStateValues[0] || 0),
      joint2: Number(latestJointStateValues[1] || 0),
      joint3: Number(latestJointStateValues[2] || 0),
      joint4: Number(latestJointStateValues[3] || 0),
      joint5: Number(latestJointStateValues[4] || 0),
      joint6: Number(latestJointStateValues[5] || 0),
    },
    coordinate: {
      x: Number(latestCartesianValues[0] || 0),
      y: Number(latestCartesianValues[1] || 0),
      z: Number(latestCartesianValues[2] || 0),
      r: Number(latestCartesianValues[3] || 0),
      p: Number(latestCartesianValues[4] || 0),
      w: Number(latestCartesianValues[5] || 0),
    },
  };
}

// Validate point data
function validatePoint(point) {
  console.log("============:",point.name);
  if (!point.name || !/^[a-zA-Z0-9-_]+$/.test(point.name)) {
    showStatus(
      "Point name must contain only letters, numbers, and dashes",
      "error",
      3000,
    );
    return false;
  }
  if (!point.nature || point.nature.length > 30) {
    showStatus(
      "Nature is required and must be 30 characters or less",
      "error",
      3000,
    );
    return false;
  }
  if (isNaN(point.sequence) || point.sequence < 1 || point.sequence > 10) {
    showStatus("Sequence must be between 1 and 10", "error", 3000);
    return false;
  }
  if (
    !Array.isArray(latestJointStateValues) ||
    !Array.isArray(latestCartesianValues) ||
    !latestJointStateValues.every((val) => !isNaN(val)) ||
    !latestCartesianValues.every((val) => !isNaN(val))
  ) {
    showStatus("Invalid joint or cartesian values received", "error", 3000);
    return false;
  }
  return true;
}

// Add a new point
async function addPoint() {
  const point = getPointFromForm();

  if (!validatePoint(point)) return;
  await callAPI("addPoint", point, () => {
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
  await callAPI("addPoint", pendingPoint, () => {
    clearForm();
    loadPoints();
    closeNameChangeModal();
  });
}

// Edit a point
function editPoint(name) {
  const point = points.find((p) => p.name === name);
  if (!point) return;
  editingPointName = name;
  oldPointName = name;
  pointName.value = point.name;
  pointName.readOnly = true;
  pointName.classList.add("input-readonly");
  dateTime.value = point.date_time;
  sequence.value = point.sequence;
  nature.value = point.nature;
  document.getElementById("is_tf").checked = point.is_tf ?? false;  // ← ADD THIS

  lastSequence = point.sequence;

  const updateButton = document.getElementById("updateBtn");
  updateButton.disabled = false;
  updateButton.style.opacity = "1";
  updateButton.style.cursor = "pointer";

  showStatus(`Editing ${name}`, "success", 2000);
}

// Delete a point
async function deletePoint(name) {
  await callAPI("deletePoint", { name }, loadPoints);
}

// Delete all points
async function deleteAll() {
  await callAPI("deleteAll", {}, loadPoints);
}

// Perform undo
async function performUndo() {
  undoBtn.disabled = true;
  await callAPI("undo", {}, () => {
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
    showStatus(`Failed to check undo: ${err.message}`, "error", 2000);
  }
}

// Save file
async function saveFile() {
  const name = fileName.value.trim();
  if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
    showStatus(
      "File name must contain only letters, numbers, and underscores",
      "error",
      3000,
    );
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/savePointFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: name }),
    });
    const data = await res.json();
    if (res.ok) {
      showStatus(`File saved with ${name}`, "success", 2000);
    } else {
      showStatus(data.message, "error", 2000);
    }
  } catch (err) {
    showStatus("Failed to save file", "error", 2000);
  }
}

// Load file
async function loadFile() {
  const fullName = backupFilesInput.dataset.value;
  if (!fullName) {
    showStatus("Please select a backup file to load", "error", 3000);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/loadBackupFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: fullName }),
    });
    const data = await res.json();
    if (res.ok) {
      setTimeout(() => {
        reloadPoints();
        // updatePointFileName();
        setTimeout(() => {
          disableDeletePoints(true);
        }, 500);
        showStatus(`${backupFilesInput.value} file loaded`, "success", 2000);
      }, 500);
    } else {
      showStatus(data.message, "error", 2000);
    }
  } catch (err) {
    showStatus("Failed to load file", "error", 2000);
  }
}

// Create new file
async function createNewFile() {
  const name = fileName.value.trim();
  if (!name || !/^[a-zA-Z0-9_]+$/.test(name)) {
    fileNameErrorModal.style.display = "flex";
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/createNewFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: name }),
    });
    const data = await res.json();
    if (res.ok) {
      setTimeout(() => {
        reloadPoints();
        // updatePointFileName();
        setTimeout(() => {
          disableDeletePoints(false);
        }, 500);
        showStatus(
          `New blank file created with name: ${name}`,
          "success",
          2000,
        );
        pointFileNameInputField.value = "";
      }, 500);
    } else {
      showStatus(data.message, "error", 2000);
    }
  } catch (err) {
    showStatus("Failed to create file", "error", 2000);
  }
}

// Delete file
async function deleteFile() {
  const fullName = backupFilesInput.dataset.value;
  if (!fullName) {
    showStatus("Please select a backup file to delete", "error", 3000);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/deleteBackupFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: fullName }),
    });
    const data = await res.json();
    if (res.ok) {
      setTimeout(() => {
        reloadPoints();
        // updatePointFileName();
        setTimeout(() => {
          disableDeletePoints(true);
        }, 500);
        showStatus(`${backupFilesInput.value} file deleted`, "success", 2000);
        clearBackupFileForm();
      }, 500);
    } else {
      showStatus(data.message, "error", 2000);
    }
  } catch (err) {
    showStatus("Failed to delete file", "error", 2000);
  }
}

// Disable/enable delete points
function disableDeletePoints(disabled) {
  updatePointPublishState = disabled;
  const deleteButtons = document.querySelectorAll(".btn-icon.btn-delete");
  deleteButtons.forEach((button) => {
    button.disabled = disabled;
    button.style.opacity = disabled ? "0.5" : "1";
    button.style.cursor = disabled ? "not-allowed" : "pointer";
  });
  showStatus(
    disabled ? "Delete buttons disabled" : "Delete buttons enabled",
    "info",
    1500,
  );
}

// Clear backup file form
function clearBackupFileForm() {
  backupFilesInput.value = "";
  showStatus("Backup File Form refreshed", "success", 1500);
}

// API call function
async function callAPI(endpoint, body, callback) {
  showStatus("Processing...", "info", 1000);
  try {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      showStatus(data.message, "success", 2000);
      if (callback) callback();
    } else {
      showStatus(data.message, "error", 3000);
    }
  } catch (err) {
    showStatus(`Connection error: ${err.message}`, "error", 3000);
  }
}

// Clear form and reset state
function clearForm() {
  pointName.value = "";
  pointName.readOnly = false;
  pointName.classList.remove("input-readonly");
  dateTime.value = "Auto-generated";
  sequence.value = lastSequence;
  nature.value = "";
  document.getElementById("is_tf").checked = false;   // ← ADD THIS
  editingPointName = null;
  oldPointName = null;
  showStatus("Form cleared", "success", 1500);
}

// Update point file name
// async function updatePointFileName() {
//   try {
//     const res = await fetch(`${API_BASE}/getPointFileName`);
//     if (!res.ok) throw new Error(`Server returned ${res.status}`);
//     const data = await res.json();
//     const fileName = data.points_file_name || "No file name";
//     pointFileName.textContent = fileName;
//     originPointFileName.textContent = fileName;

//     if (fileName === "No file name" || fileName === "null") {
//       showStatus("Create or load a file to start", "info", 3000);
//     }
//   } catch (err) {
//     showStatus(`Failed to update file name: ${err.message}`, "error", 2000);
//   }
// }

// Reload points
async function reloadPoints() {
  await loadPoints();
}

// Persist sequence selection
sequence.addEventListener("change", () => {
  lastSequence = sequence.value;
});

// Update point
async function updatePoint() {
  if (!editingPointName) {
    showStatus("No point selected for editing", "error", 3000);
    return;
  }
  const point = getPointFromForm();
  if (!validatePoint(point)) return;
  if (point.name !== oldPointName) {
    pendingPoint = point;
    nameChangeModal.style.display = "flex";
    return;
  }
  const body = { oldName: oldPointName, ...point };
  await callAPI("updatePoint", body, () => {
    clearForm();
    loadPoints();
  });
  if (updatePointPublishState) {
    try {
      await fetch(`${API_BASE}/editedPoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointName: point.name }),
      });
      console.log(`Published ${point.name}`);
      setTimeout(() => {
        reloadPoints();
        // updatePointFileName();
        showStatus(`${point.name} published`, "info", 2000);
      }, 500);
    } catch (err) {
      console.error("Failed to publish edited point:", err);
    }
  }
}


// No ROSLIB imports or rosbridge connection

async function setFrame(frameName) {
  try {
    const response = await fetch('/ros/set_frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ frame: frameName })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    // UI active button highlight
    document.getElementById("btnEnd").classList.remove("active");
    document.getElementById("btnBase").classList.remove("active");
    document.getElementById("btnExt").classList.remove("active");

    if (frameName === "end") document.getElementById("btnEnd").classList.add("active");
    if (frameName === "base_link") document.getElementById("btnBase").classList.add("active");
    if (frameName === "external_link") document.getElementById("btnExt").classList.add("active");

  } catch (err) {
    console.error("Failed to set frame:", err);
  }
}

setTimeout(() => {
  setFrame('end');
}, 1000);

// Initialize
async function init() {
  sequence.value = lastSequence;
  await loadPoints();
  // await updatePointFileName();
  await checkUndo();
}

document.addEventListener("DOMContentLoaded", () => {
  init();
  disableDeletePoints(true);
});
