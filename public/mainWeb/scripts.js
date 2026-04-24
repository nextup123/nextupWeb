// frontend - mainWeb.js

// ===================== CONFIG =====================
const port = window.location.port || "3000";
const ACTION_COOLDOWN_MS = 2000;
const PAGE_KEY = "activeDashboardPage";

// ===================== GLOBAL STATUS =====================
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
  fault: {
    jointStatus: [false, false, false, false, false, false],
    anyFault: false,
  },
};

window.loaderState = {
  expectedNodes: [],
  expectedControllers: [],
  expectedSet: new Set(),
  activeSet: new Set(),
  totalCount: 0,
};

// ===================== DOM REFS =====================
const loadingCount = document.getElementById("loadingCount");
const progressFill = document.getElementById("progressFill");
const loadingText = document.getElementById("loadingText");
const loadingScreen = document.getElementById("loadingScreen");
const loadingBypassBtn = document.getElementById("loadingBypass");

const robotLedFault = document.getElementById("robot-led-fault");
const faultLeds = Array.from({ length: 6 }, (_, i) =>
  document.getElementById(`joint${i + 1}-led-fault`),
);

const robotLedOp = document.getElementById("robot-led-op");
const jointLeds = Array.from({ length: 6 }, (_, i) =>
  document.getElementById(`joint${i + 1}-led-op`),
);

const robotLedEmergency = document.getElementById("robot-led-emergency");
const emergencyLeds = Array.from({ length: 6 }, (_, i) =>
  document.getElementById(`joint${i + 1}-led-emergency`),
);

const robotLedHoming = document.getElementById("robot-led-homing");
const homingLeds = Array.from({ length: 6 }, (_, i) =>
  document.getElementById(`joint${i + 1}-led-homing`),
);

const homeButton = document.getElementById("homeButton");
const resetButton = document.getElementById("resetButton");
const emergencyButton = document.getElementById("emergency-button");

// ===================== WEBSOCKET =====================
let ws = null;
let latestJointStateMsg = null;

function initWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('WebSocket connected to ROS backend');
    isConnected = true;
    reconnectAttempts = 0;
    updateROSConnectionStatus(true);
    ws.send(JSON.stringify({ type: "PING" }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleROSMessage(msg);
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    isConnected = false;
    updateROSConnectionStatus(false);
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      setTimeout(initWS, RECONNECT_DELAY);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    isConnected = false;
    updateROSConnectionStatus(false);
  };
}

initWS();

// ===================== WS MESSAGE HANDLER =====================
function handleROSMessage(msg) {
  switch (msg.type) {

    case "DO_STATUS": {
      const { driver, do1, do2, do3, do4 } = msg.payload;

      [do1, do2, do3, do4].forEach((state, i) => {
        const id = i + 1;

        const indicator = document.getElementById(`do_indicator_${driver}_${id}`);
        const toggle = document.getElementById(`do_toggle_${driver}_${id}`);

        if (indicator) indicator.classList.toggle("on", state);
        if (toggle && !toggle.disabled) toggle.checked = state;
      });
      break;
    }


    case "DRIVER_STATUS":
      updateDriverStatus(msg.payload);
      break;

    case "EMERGENCY_STATUS":
      updateEmergency(msg.payload);
      break;

    case "ACTIVE_NODES":
      updateActiveNodes(msg.payload);
      break;

    case "JOINT_STATES":
      latestJointStateMsg = msg.payload;
      break;

    case "MOTION_ACTIVE":
      updateButtonStates(msg.payload);
      break;


    case "PONG":
      console.log("ROS connection alive");
      break;

    default:
      console.log("Unknown message type:", msg.type);
  }

  // Forward to iframes
  document.querySelectorAll("iframe").forEach((iframe) => {
    iframe.contentWindow.postMessage(msg, "*");
  });
}

// ===================== RECEIVE FROM IFRAMES =====================
window.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WS not ready");
    return;
  }

  switch (msg.type) {
    case "UI_COMMANDS":
    case "START_SERVO":
    case "TOGGLE_DO":
    case "MONITORING_START":   // ← add
    case "MONITORING_STOP":    // ← add
    case "CHANGE_MODE": 
      ws.send(JSON.stringify(msg));
      break;
    default:
      console.warn("Unknown iframe message:", msg.type);
  }
});


// ===================== DRIVER STATUS =====================
function updateDriverStatus(data) {
  const { jointStatus, faultStatus } = data;

  const allJointsOperational = jointStatus.every(Boolean);
  window.robotStatus.operational.allOperational = allJointsOperational;
  window.robotStatus.operational.jointStatus = jointStatus;

  robotLedOp.classList.toggle("led-op-true", allJointsOperational);
  robotLedOp.classList.toggle("led-op-false", !allJointsOperational);

  jointStatus.forEach((status, i) => {
    const led = jointLeds[i];
    if (!led) return;
    const wasActive = led.classList.contains("joint-indicator-true");
    led.classList.toggle("joint-indicator-true", status);
    led.classList.toggle("joint-indicator-false", !status);
    if (wasActive !== status) {
      led.style.animation = "none";
      void led.offsetHeight;
      led.style.animation = status ? "bounce 0.5s ease" : "pulse 2s infinite";
    }
  });

  const anyFault = faultStatus.some(Boolean);
  window.robotStatus.fault.anyFault = anyFault;
  window.robotStatus.fault.jointStatus = faultStatus;

  robotLedFault.classList.toggle("led-fault-true", !anyFault);
  robotLedFault.classList.toggle("led-fault-false", anyFault);

  faultStatus.forEach((hasFault, i) => {
    const led = faultLeds[i];
    if (!led) return;
    led.classList.toggle("joint-indicator-true", !hasFault);
    led.classList.toggle("joint-indicator-false", hasFault);
  });

  updateButtonStates();
}

// ===================== EMERGENCY STATUS =====================
function updateEmergency(data) {
  const emergencyStatus = data.jointStatus;
  const anyEmergency = emergencyStatus.some(Boolean);

  window.robotStatus.emergency.anyEmergency = anyEmergency;
  window.robotStatus.emergency.jointStatus = emergencyStatus;

  robotLedEmergency.classList.toggle("led-emergency-true", anyEmergency);
  robotLedEmergency.classList.toggle("led-emergency-false", !anyEmergency);

  emergencyStatus.forEach((hasEmergency, i) => {
    const led = emergencyLeds[i];
    if (!led) return;
    led.classList.toggle("joint-indicator-true", !hasEmergency);
    led.classList.toggle("joint-indicator-false", hasEmergency);
  });

  updateButtonStates();
}

// ===================== ACTIVE NODES =====================
function updateActiveNodes(activeList) {
  window.loaderState.activeSet = new Set(activeList);

  let activeExpectedCount = 0;
  window.loaderState.expectedSet.forEach((name) => {
    if (window.loaderState.activeSet.has(name)) activeExpectedCount++;
  });

  const total = window.loaderState.totalCount;
  const percentage =
    total === 0 ? 0 : Math.floor((activeExpectedCount / total) * 100);

  updateLoadingBar(percentage);
  loadingCount.textContent = `${activeExpectedCount} / ${total}`;
}

// ===================== HOMING DISPLAY (5 Hz) =====================
setInterval(() => {
  if (!latestJointStateMsg) return;

  const jointPositions = {};
  latestJointStateMsg.name.forEach((name, i) => {
    jointPositions[name] = latestJointStateMsg.position[i];
  });

  const homingStatus = [];

  for (let i = 1; i <= 6; i++) {
    const position = jointPositions[`joint${i}`] ?? 0.0;
    const isHomed = Math.abs(position).toFixed(3) === "0.000";
    homingStatus.push(isHomed);

    const led = homingLeds[i - 1];
    if (led) {
      led.classList.toggle("joint-indicator-true", isHomed);
      led.classList.toggle("joint-indicator-false", !isHomed);
    }
  }

  const allHomed = homingStatus.every(Boolean);
  robotLedHoming.classList.toggle("led-homing-true", allHomed);
  robotLedHoming.classList.toggle("led-homing-false", !allHomed);

  window.robotStatus.homing = { jointStatus: homingStatus, allHomed };
}, 200);

// ===================== SYSTEM INFO (1 Hz) =====================
function updateSystemStatus() {
  const now = new Date();
  document.getElementById("sys-status-current-time").textContent =
    `TIME : ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

  fetch("/uptime")
    .then((res) => {
      if (!res.ok) throw new Error("Network response was not ok");
      return res.json();
    })
    .then((data) => {
      document.getElementById("sys-status-uptime").textContent =
        `UpTime: ${data.uptime}`;
      document.getElementById("sys-status-load-avg").textContent =
        `Load: ${data.loadAverage.replace(/,/g, " ")}`;
    })
    .catch(() => {
      document.getElementById("sys-status-load-avg").textContent = "Load: N/A";
    });
}

updateSystemStatus();
setInterval(updateSystemStatus, 1000);

// ===================== PROJECT MANAGER =====================
async function refreshActiveProjectName() {
  try {
    const res = await fetch("/api/projects/active");
    const data = await res.json();
    document.getElementById("navActiveProjectName").textContent =
      data.active_project || "—";
  } catch {
    document.getElementById("navActiveProjectName").textContent = "—";
  }
}

window.addEventListener("activeProjectChanged", (e) => {
  document.getElementById("navActiveProjectName").textContent =
    e.detail?.name || "—";
});

refreshActiveProjectName();

// ===================== PAGE ROUTING =====================
document.getElementById("page0").src =
  `http://localhost:${port}/projectManagerEn`;
document.getElementById("page1").src = `http://localhost:${port}/pointPlanning`;
document.getElementById("page2").src = `http://localhost:${port}/pathPlanning`;
document.getElementById("page3").src = `http://localhost:3003/`;
document.getElementById("page5").src = `http://localhost:${port}/doDiWeb`;
document.getElementById("page6").src =
  `http://localhost:${port}/error-handling`;
document.getElementById("page7").src = `http://localhost:${port}/mainTree`;
document.getElementById("page8").src = `http://localhost:${port}/clientControl`;
document.getElementById("page9").src = `rosLogs/index.html`;

function switchPage(pageId) {
  document
    .querySelectorAll("iframe")
    .forEach((i) => i.classList.remove("active"));

  const iframe = document.getElementById(pageId);
  if (iframe) iframe.classList.add("active");

  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.getAttribute("onclick")?.includes(pageId),
    );
  });

  localStorage.setItem(PAGE_KEY, pageId);
}

document.addEventListener("DOMContentLoaded", () => {
  switchPage(localStorage.getItem(PAGE_KEY) || "page1");
});

// ===================== LOADING SCREEN =====================
updateLoadingBar(1);

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
  loadingCount.textContent = `0 / ${window.loaderState.totalCount}`;
}

loadExpectedRosEntities();

function updateLoadingBar(percentage) {
  percentage = Math.max(0, Math.min(100, percentage));
  progressFill.style.width = `${percentage}%`;
  loadingText.textContent = `${percentage}%`;

  if (percentage === 100) {
    setTimeout(() => loadingScreen.classList.add("hidden"), 500);
  }
}

loadingBypassBtn.addEventListener("click", () => updateLoadingBar(100));

// ===================== POPUP =====================
const popup = document.createElement("div");
popup.id = "statusPopup";
Object.assign(popup.style, {
  display: "none",
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  backgroundColor: "#2d2d2d",
  padding: "20px",
  borderRadius: "8px",
  boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
  zIndex: "1000",
  color: "white",
  fontFamily: "'Roboto Mono', monospace",
  textAlign: "center",
});

const popupMessage = document.createElement("p");
popupMessage.style.marginBottom = "20px";

const popupOkButton = document.createElement("button");
popupOkButton.textContent = "OK";
Object.assign(popupOkButton.style, {
  padding: "8px 16px",
  backgroundColor: "#4CAF50",
  color: "white",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
});
popupOkButton.addEventListener("click", () => {
  popup.style.display = "none";
});

popup.appendChild(popupMessage);
popup.appendChild(popupOkButton);
document.body.appendChild(popup);

function showPopup(message) {
  popupMessage.textContent = message;
  popup.style.display = "block";
}

// ===================== COOLDOWN =====================
function applyCooldown(button, cooldownMs = ACTION_COOLDOWN_MS) {
  button.disabled = true;
  button.style.opacity = "0.4";
  button.style.cursor = "not-allowed";
  setTimeout(() => {
    button.disabled = false;
    button.style.opacity = "1";
    button.style.cursor = "pointer";
  }, cooldownMs);
}

// ===================== BUTTON ACTIONS =====================
homeButton.addEventListener("click", () => {
  const { operational, emergency, running } = window.robotStatus;
  if (!operational.allOperational) {
    showPopup("Cannot HOME: Not all joints are operational");
    return;
  }
  if (emergency.anyEmergency) {
    showPopup("Cannot HOME: Emergency condition detected");
    return;
  }
  if (running.anyRunning) {
    showPopup("Cannot HOME: Some joints are still running");
    return;
  }

  ws.send(
    JSON.stringify({ type: "UI_COMMANDS", payload: { command: "home" } }),
  );
  applyCooldown(homeButton);
});

resetButton.addEventListener("click", () => {
  if (window.robotStatus.emergency.anyEmergency) {
    showPopup("Cannot RESET: Emergency condition detected");
    return;
  }
  ws.send(JSON.stringify({ type: "RESET_FAULT" }));
  applyCooldown(resetButton);
});

emergencyButton.addEventListener("click", () => {
  ws.send(JSON.stringify({ type: "EMERGENCY_TRIGGER" }));
  console.log("🚨 Emergency Trigger Sent");
});

// ===================== BUTTON STATE =====================
function updateButtonStates() {
  const { operational, emergency, running } = window.robotStatus;

  const homeEnabled =
    operational.allOperational &&
    !emergency.anyEmergency &&
    !running.anyRunning;

  homeButton.disabled = !homeEnabled;
  homeButton.style.opacity = homeEnabled ? "1" : "0.6";

  const resetEnabled = !emergency.anyEmergency;
  resetButton.disabled = !resetEnabled;
  resetButton.style.opacity = resetEnabled ? "1" : "0.6";
}

// ===================== POWER OPTIONS =====================
let selectedAction = "";
let countdown = 15;
let timerInterval;

function openModal() {
  document.getElementById("powerModal").style.display = "block";
}

function closeModal() {
  clearInterval(timerInterval);
  document.getElementById("confirmSection").style.display = "none";
  document.getElementById("powerModal").style.display = "none";
}

function confirmAction(action) {
  selectedAction = action;
  document.getElementById("confirmText").innerText =
    `Are you sure you want to ${action}?`;
  document.getElementById("countdown").innerHTML =
    `System will automatically ${action} in <span id="timer">15</span> seconds`;
  document.getElementById("confirmSection").style.display = "block";
  countdown = 15;
  timerInterval = setInterval(updateTimer, 1000);
}

function cancelConfirm() {
  clearInterval(timerInterval);
  document.getElementById("confirmSection").style.display = "none";
}

function updateTimer() {
  countdown--;
  document.getElementById("timer").innerText = countdown;
  if (countdown <= 0) {
    clearInterval(timerInterval);
    executeAction();
  }
}

function executeAction() {
  const urls = {
    shutdown: "/shutdown",
    reboot: "/reboot",
    "force shutdown": "/force-shutdown",
  };

  fetch(urls[selectedAction], { method: "POST" })
    .then(() => {
      document.getElementById("confirmText").innerText =
        `Executing ${selectedAction}...`;
    })
    .catch(() => {
      document.getElementById("confirmText").innerText =
        `Failed to ${selectedAction}`;
    });

  clearInterval(timerInterval);
}

function startEtherCAT() {
  fetch("http://localhost:3000/start-ethercat", { method: "POST" })
    .then((res) => res.text())
    .then(() => {
      document.getElementById("output").textContent = "Started";
    })
    .catch(() => {
      document.getElementById("output").textContent = "Error";
    });
}

function controlService(service, action) {
  fetch(`/${action}/${service}`, { method: "POST" })
    .then((res) => res.text())
    .then((msg) => alert(msg))
    .catch((err) => alert("Error: " + err));
}

// ===================LOG DRAWER CODE=======================
let allLogs = [];


function renderLogs() {
  const container = document.getElementById("drawerContent");
  const filter = document.getElementById("filterType").value;
  const sort = document.getElementById("sortOrder").value;

  let logs = [...allLogs];

  // Filter
  if (filter !== "all") {
    logs = logs.filter(l => l.type === filter);
  }

  // Sort
  logs.sort((a, b) => {
    return sort === "newest"
      ? new Date(b.timestamp) - new Date(a.timestamp)
      : new Date(a.timestamp) - new Date(b.timestamp);
  });

  // Render
  container.innerHTML = "";

  logs.forEach(log => {
    const div = document.createElement("div");
    div.className = `log-card log-${log.type}`;

    div.innerHTML = `
    <div class="log-message">${log.message}</div>
    <div class="log-meta">
        <span class="log-type-badge badge-${log.type}">
            ${log.type}
        </span>
        <span>${new Date(log.timestamp).toLocaleTimeString()}</span>
    </div>
`;

    container.appendChild(div);
  });
}

let logsLoaded = false;

async function toggleDrawer() {
  const drawer = document.getElementById("leftDrawer");
  const button = document.getElementById("drawerToggle");

  drawer.classList.toggle("open");

  if (drawer.classList.contains("open")) {
    button.innerHTML = '<i class="fa-solid fa-angle-right"></i>';

    // 🔥 Fetch logs only first time (lazy load)
    // if (!logsLoaded) {
    await fetchLogs();
    //     logsLoaded = true;
    // }

  } else {
    button.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
  }
}

async function fetchLogs() {
  try {
    const res = await fetch("http://localhost:3000/ros/logs");
    const result = await res.json();

    if (!result.success) {
      console.error("Failed to fetch logs");
      return;
    }
    const logs = [];

    // Convert grouped logs → flat array

    Object.entries(result.data).forEach(([type, items]) => {
      items.forEach(item => {
        logs.push({
          ...item,
          type
        });
      });
    });

    // Save globally
    allLogs = logs;

    renderLogs();

  } catch (err) {
    console.error("Error fetching logs:", err);
  }
}

function clearLogs() {
  allLogs = [];
  renderLogs();
}

// Button click
document.getElementById("drawerToggle").addEventListener("click", toggleDrawer);
document.getElementById("filterType").addEventListener("change", renderLogs);
document.getElementById("sortOrder").addEventListener("change", renderLogs);