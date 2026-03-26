const port = window.location.port || "3000";

const ws = new WebSocket(`ws://localhost:${port}`);

ws.onopen = () => {
  console.log("WS Connected");
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  handleWSMessage(msg);
};

ws.onclose = () => {
  console.log("WS Disconnected");
};

function handleWSMessage(msg) {
    switch (msg.type) {

        case "DRIVER_STATUS":
            handleDriverStatus(msg.payload);
            break;

        case "EMERGENCY_STATUS":
            handleEmergency(msg.payload);
            break;

        case "ACTIVE_NODES":
            handleActiveNodes(msg.payload);
            break;

        default:
            console.warn("Unknown WS message:", msg);
    }

    // 🔁 Broadcast to iframes (simple pipe)
    document.querySelectorAll("iframe").forEach((iframe) => {
        iframe.contentWindow.postMessage(msg, "*");
    });
}

//Global Objects:
// Global robot status object
window.robotStatus = {
  operational: {
    jointStatus: [false, false, false, false, false, false],
    allOperational: false,
  },
  homing: {
    jointStatus: [false, false, false, false, false, false],
    allHomed: false,
  },
  running: {
    jointStatus: [false, false, false, false, false, false],
    anyRunning: false,
  },
  emergency: {
    jointStatus: [false, false, false, false, false, false],
    anyEmergency: false,
  },
};

window.robotStatus.fault = {
  jointStatus: [false, false, false, false, false, false],
  anyFault: false,
};

window.loaderState = {
  expectedNodes: [],
  expectedControllers: [],
  expectedSet: new Set(),
  activeSet: new Set(),
  totalCount: 0,
};

const loadingCount = document.getElementById("loadingCount");

// Fault LEDs
// ===================== FAULT LED DOM TEST =====================

// ===================== FAULT LED TEST (STANDARD CLASSES) =====================

const robotLedFault = document.getElementById("robot-led-fault");
const faultLeds = Array.from({ length: 6 }, (_, i) =>
  document.getElementById(`joint${i + 1}-led-fault`),
);

console.log("robotLedFault:", robotLedFault);
console.log("faultLeds:", faultLeds);

//common functions here:

function publishRosString(topicName, messageData) {
  const topic = new ROSLIB.Topic({
    ros: ros,
    name: topicName,
    messageType: "std_msgs/String",
  });
  const message = new ROSLIB.Message({
    data: messageData,
  });
  topic.publish(message);
  console.log(`Published to ${topicName}: ${messageData}`);
}

// Assign webpage sources
document.getElementById("page0").src =
  `http://localhost:${port}/projectManagerEn`;
document.getElementById("page1").src = `http://localhost:${port}/pointPlanning`;
document.getElementById("page2").src = `http://localhost:${port}/pathPlanning`;
document.getElementById("page3").src = `http://localhost:3003/`;

// document.getElementById("page4").src = `web/index.html`;
// document.getElementById("page3").src = `http://localhost:${port}/ui_micron_diagnosis`;
document.getElementById("page5").src = `http://localhost:${port}/doDiWeb`;
document.getElementById("page7").src = `http://localhost:${port}/mainTree`;
document.getElementById("page6").src =
  `http://localhost:${port}/error-handling`;
document.getElementById("page8").src = `http://localhost:${port}/clientControl`;
document.getElementById("page9").src = `rosLogs/index.html`;

const PAGE_KEY = "activeDashboardPage";

function switchPage(pageId) {
  // Hide all iframes
  document
    .querySelectorAll("iframe")
    .forEach((i) => i.classList.remove("active"));

  // Show selected iframe
  const iframe = document.getElementById(pageId);
  if (iframe) iframe.classList.add("active");

  // Update sidebar buttons
  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("onclick")?.includes(pageId),
    );
  });

  // Persist selection
  localStorage.setItem(PAGE_KEY, pageId);
}

document.addEventListener("DOMContentLoaded", () => {
  const savedPage = localStorage.getItem(PAGE_KEY) || "page1";
  switchPage(savedPage);
});

let loadingPercentage = 0;
const progressFill = document.getElementById("progressFill");
const loadingText = document.getElementById("loadingText");
const loadingScreen = document.getElementById("loadingScreen");
const loadingBypassBtn = document.getElementById("loadingBypass");

updateLoadingBar(1);

//////////////////////////////////////////////////////////////////

// Connect to ROSBridge
const ros = new ROSLIB.Ros({
  url: "ws://localhost:9090",
});

// Handle connection and errors
ros.on("connection", () => console.log("Connected to ROSBridge"));
ros.on("error", (error) => console.error("ROSBridge Error:", error));
ros.on("close", () => console.log("Connection to ROSBridge closed"));

// Cache DOM elements
const robotLedOp = document.getElementById("robot-led-op");
const jointLeds = Array.from({ length: 6 }, (_, i) =>
  document.getElementById(`joint${i + 1}-led-op`),
);

// Subscribe to /nextup_driver_status
const driverStatusTopic = new ROSLIB.Topic({
  ros: ros,
  name: "/nextup_driver_status",
  messageType: "nextup_joint_interfaces/msg/NextupDriverStatus",
});

driverStatusTopic.subscribe((message) => {
  if (!message.name || !message.op_status) return;

  // Expected joint order for UI
  const jointOrder = [
    "joint1",
    "joint2",
    "joint3",
    "joint4",
    "joint5",
    "joint6",
  ];

  // Build jointStatus[] in fixed order
  const jointStatus = jointOrder.map((jointName) => {
    const index = message.name.indexOf(jointName);
    return index !== -1 ? Boolean(message.op_status[index]) : false;
  });

  const activeJoints = jointStatus.filter(Boolean).length;
  const allJointsOperational = activeJoints === jointStatus.length;

  /* ================= LOADING BAR ================= */

  // if (typeof updateLoadingBar === 'function') {
  //     const newPercentage = Math.floor(
  //         (activeJoints / jointStatus.length) * 100
  //     );
  //     updateLoadingBar(newPercentage);
  // }

  /* ================= CONTAINER LED ================= */

  robotLedOp.classList.toggle("led-op-true", allJointsOperational);
  robotLedOp.classList.toggle("led-op-false", !allJointsOperational);

  /* ================= PER-JOINT LED ================= */

  jointStatus.forEach((status, index) => {
    const led = jointLeds[index];
    if (!led) return;

    const wasActive = led.classList.contains("joint-indicator-true");
    const nowActive = status;

    led.classList.toggle("joint-indicator-true", nowActive);
    led.classList.toggle("joint-indicator-false", !nowActive);

    // Animate only on state change
    if (wasActive !== nowActive) {
      led.style.animation = "none";
      void led.offsetHeight; // force reflow
      led.style.animation = nowActive
        ? "bounce 0.5s ease"
        : "pulse 2s infinite";
    }
  });

  /* ================= GLOBAL STATE ================= */

  window.robotStatus.operational.jointStatus = jointStatus;
  window.robotStatus.operational.allOperational = allJointsOperational;

  /* ================= FAULT STATUS ================= */

  // Build faultStatus[] in fixed joint order
  const faultStatus = jointOrder.map((jointName) => {
    const index = message.name.indexOf(jointName);
    return index !== -1 ? Boolean(message.fault[index]) : false;
  });

  // Any joint fault?
  const anyFault = faultStatus.some(Boolean);

  /* ================= CONTAINER LED ================= */

  // anyFault = true  → RED  (false)
  // anyFault = false → GREEN (true)
  const robotHealthy = !anyFault;

  robotLedFault.classList.toggle("led-fault-true", robotHealthy);
  robotLedFault.classList.toggle("led-fault-false", !robotHealthy);

  /* ================= PER-JOINT LED ================= */

  faultStatus.forEach((hasFault, index) => {
    const led = faultLeds[index];
    if (!led) return;

    // hasFault = false → GREEN (true)
    // hasFault = true  → RED   (false)
    const nowActive = !hasFault;

    led.classList.toggle("joint-indicator-true", nowActive);
    led.classList.toggle("joint-indicator-false", !nowActive);
  });

  /* ================= GLOBAL STATE ================= */

  window.robotStatus.fault.jointStatus = faultStatus;
  window.robotStatus.fault.anyFault = anyFault;
});

// ===================== EMERGENCY STATUS (DI5) =====================

// Cache Emergency LEDs
const robotLedEmergency = document.getElementById("robot-led-emergency");
const emergencyLeds = Array.from({ length: 6 }, (_, i) =>
  document.getElementById(`joint${i + 1}-led-emergency`),
);

// Subscribe to Digital Inputs
const diTopic = new ROSLIB.Topic({
  ros,
  name: "/nextup_digital_inputs",
  messageType: "nextup_joint_interfaces/msg/NextupDigitalInputs",
});

diTopic.subscribe((msg) => {
  const jointCount = msg.name?.length || 0;
  if (jointCount === 0) return;

  // Extract di5 for each joint (0..5)
  const emergencyStatus = [];

  for (let i = 0; i < 6; i++) {
    const di5 = msg.di5?.[i];
    const hasEmergency = di5 === true; // true = emergency active
    emergencyStatus.push(hasEmergency);

    const led = emergencyLeds[i];
    if (!led) continue;

    // Emergency active → RED
    // No emergency → GREEN
    const nowActive = !hasEmergency;

    led.classList.toggle("joint-indicator-true", nowActive);
    led.classList.toggle("joint-indicator-false", !nowActive);
  }

  // Robot-level emergency LED
  const anyEmergency = emergencyStatus.some(Boolean);
  const robotHealthy = !anyEmergency;

  robotLedEmergency.classList.toggle("led-emergency-true", !robotHealthy);
  robotLedEmergency.classList.toggle("led-emergency-false", robotHealthy);

  // Global state
  window.robotStatus.emergency.jointStatus = emergencyStatus;
  window.robotStatus.emergency.anyEmergency = anyEmergency;
});

const activeNodesTopic = new ROSLIB.Topic({
  ros,
  name: "/active_nodes_report",
  messageType: "std_msgs/String",
});

activeNodesTopic.subscribe((msg) => {
  if (!msg.data) return;

  const activeNames = msg.data
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  window.loaderState.activeSet = new Set(activeNames);

  let activeExpectedCount = 0;

  window.loaderState.expectedSet.forEach((name) => {
    if (window.loaderState.activeSet.has(name)) {
      activeExpectedCount++;
    }
  });

  const total = window.loaderState.totalCount;

  const percentage =
    total === 0 ? 0 : Math.floor((activeExpectedCount / total) * 100);

  updateLoadingBar(percentage);

  // Count text: "current / total"
  loadingCount.textContent = `${activeExpectedCount} / ${total}`;
});

async function loadExpectedRosEntities() {
  const res = await fetch("/ros-monitor/names");
  const data = await res.json();

  window.loaderState.expectedNodes = data.nodes || [];
  window.loaderState.expectedControllers = data.controllers || [];

  const allExpected = [
    ...window.loaderState.expectedNodes,
    ...window.loaderState.expectedControllers,
  ];

  window.loaderState.expectedSet = new Set(allExpected);
  window.loaderState.totalCount = allExpected.length;

  // Initialize UI
  loadingCount.textContent = `0 / ${window.loaderState.totalCount}`;
}

loadExpectedRosEntities();

// Function to update loading bar
function updateLoadingBar(percentage) {
  loadingPercentage = Math.max(0, Math.min(100, percentage));

  // Update UI
  progressFill.style.width = `${loadingPercentage}%`;
  loadingText.textContent = `${loadingPercentage}%`;

  // Hide loader smoothly when fully loaded
  if (loadingPercentage === 100) {
    setTimeout(() => {
      loadingScreen.classList.add("hidden");
    }, 500);
  }
}

// Bypass button: Instantly complete loading
loadingBypassBtn.addEventListener("click", () => {
  updateLoadingBar(100);
});

//can be used later --but remove at the last day of deployment!!
// Create service client
const startServoClient = new ROSLIB.Service({
  ros: ros,
  name: "/servo_node/start_servo",
  serviceType: "std_srvs/srv/Trigger",
});

// Call service on button click
function callStartServo() {
  const request = new ROSLIB.ServiceRequest({});
  startServoClient.callService(request, function (result) {
    console.log("Service response: ", result);
    document.getElementById("status").innerText = result.success
      ? `Success: ${result.message}`
      : `Failed: ${result.message}`;
  });
}

let keysPressed = new Set();

document.addEventListener("keydown", (event) => {
  keysPressed.add(event.key.toLowerCase());

  // Check for exact keys only
  if (
    event.ctrlKey &&
    event.altKey &&
    keysPressed.has("n") &&
    keysPressed.has("r")
  ) {
    // Prevent repeat triggers
    if (!keysPressed.has("dev-popup-triggered")) {
      keysPressed.add("dev-popup-triggered");
      showDeveloperPopup();
    }
  }
});

document.addEventListener("keyup", (event) => {
  // Clear the key from the set
  keysPressed.delete(event.key.toLowerCase());

  // Also clear the trigger lock when keys are lifted
  if (
    !keysPressed.has("ctrl") &&
    !keysPressed.has("alt") &&
    !keysPressed.has("n") &&
    !keysPressed.has("r")
  ) {
    keysPressed.delete("dev-popup-triggered");
  }
});

function showDeveloperPopup() {
  // Replace with your modal or popup logic
  alert("👨‍💻 Hidden Developer Popup Triggered!");
}
