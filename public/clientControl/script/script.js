// ============================================================
// clientControl.js
// All ROS communication goes through window.parent.postMessage
// MainWeb.js forwards messages to/from the backend WebSocket
// ============================================================

// ============================================================
// HELPERS
// ============================================================

function sendToParent(msg) {
    window.parent.postMessage(msg, "*");
}

// ============================================================
// GLOBAL STATE
// ============================================================

let currentSpeedScale = 0.1;
let allJointsOp       = false;


// ============================================================
// INBOUND MESSAGE ROUTER
// (MainWeb.js forwards all WS messages to iframes via postMessage)
// ============================================================

window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
        case "DRIVER_STATUS":
            handleDriverStatus(msg.payload);
            break;
        case "JOINT_STATUS":
            handleJointStatus(msg.payload);
            break;
        case "DI_STATUS":
            updateDIStatusFromBackend(msg.payload);
            break;
    }
});


// ============================================================
// CNC START GATE LOGIC + TEST OVERRIDE
// ============================================================

const DEBUG_CNC_START = false;
const logOnce = (...args) => DEBUG_CNC_START && console.log("[CNC-START]", ...args);

let cncFaultActive = false;
let cncAutoMode    = false;

let useOverride           = false;
let overrideAllJointsOp   = true;
let overrideCncFault      = false;
let overrideCncAutoMode   = true;

// CNC fault / auto mode come from DI_STATUS (driver 2, di3 & di4)
// Parsed inside updateDIStatusFromBackend — see DI STATUS section below

function getEffectiveStates() {
    return {
        jointsOp: useOverride ? overrideAllJointsOp : allJointsOp,
        cncFault: useOverride ? overrideCncFault     : cncFaultActive,
        cncAuto:  useOverride ? overrideCncAutoMode  : cncAutoMode,
    };
}

function canRobotStart() {
    // const { jointsOp, cncFault, cncAuto } = getEffectiveStates();
    const  jointsOp = true;
    const  cncFault = false;
    const  cncAuto  = true;
    const issues = [];

    if (!jointsOp) issues.push("One or more robot joints are NOT operational");
    if (cncFault)  issues.push("CNC alarm / fault is active");
    if (!cncAuto)  issues.push("CNC is NOT in AUTO mode");

    return { allowed: issues.length === 0, issues };
}

function showStartBlockedModal(issues) {
    const modal = document.getElementById("start-blocked-modal");
    const list  = document.getElementById("start-blocked-list");
    list.innerHTML = "";
    issues.forEach(issue => {
        const li = document.createElement("li");
        li.textContent = issue;
        list.appendChild(li);
    });
    modal.classList.add("show");
}

function closeStartBlockedModal() {
    document.getElementById("start-blocked-modal")?.classList.remove("show");
}

function openOverrideModal() {
    document.getElementById("override-modal")?.classList.add("show");
    document.getElementById("override-enable").checked = useOverride;
    document.getElementById("override-joints").checked = overrideAllJointsOp;
    document.getElementById("override-fault").checked  = overrideCncFault;
    document.getElementById("override-auto").checked   = overrideCncAutoMode;
}

function closeOverrideModal() {
    document.getElementById("override-modal")?.classList.remove("show");
}

function applyOverrides() {
    useOverride           = document.getElementById("override-enable").checked;
    overrideAllJointsOp   = document.getElementById("override-joints").checked;
    overrideCncFault      = document.getElementById("override-fault").checked;
    overrideCncAutoMode   = document.getElementById("override-auto").checked;
    closeOverrideModal();
}


// ============================================================
// SPEED / MODE / CNC SETTINGS
// ============================================================

const lowBtn        = document.getElementById("mode-low");
const highBtn       = document.getElementById("mode-high");
const productionBtn = document.getElementById("mode-production");
const slider        = document.getElementById("speed-slider");
const speedValue    = document.getElementById("speed-value");
const cncButtons    = document.querySelectorAll(".cnc-btn");

let settings = { mode: "testing", speed: 0.1, cnc: "none" };

function publishSpeed(value) {
    sendToParent({
        type: "UI_COMMANDS",
        payload: { command: "set_speed", value: parseFloat(value) },
    });
}

function publishCNC(selection) {
    sendToParent({
        type: "UI_COMMANDS",
        payload: { command: "select_cnc", value: selection },
    });
}

async function loadSettings() {
    try {
        const res  = await fetch("/settings");
        const data = await res.json();
        settings = data;
        applySettings();
        publishSpeed(settings.speed);
        publishCNC(settings.cnc);
        // console.log("Loaded settings:", data);
    } catch (err) {
        console.error("Failed to load settings:", err);
    }
}

async function saveSettings() {
    try {
        await fetch("/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings),
        });
    } catch (err) {
        console.error("Failed to save settings:", err);
    }
}

function applySettings() {
    [lowBtn, highBtn, productionBtn].forEach(b => b.classList.remove("active"));

    if (settings.mode === "low_testing") {
        lowBtn.classList.add("active");
        slider.disabled = true;
        slider.min = 0.01;
        slider.max = 0.20;
        currentSpeedScale = 0.1;
    } else if (settings.mode === "high_testing") {
        highBtn.classList.add("active");
        slider.disabled = false;
        slider.min = 0.50;
        slider.max = 0.90;
        currentSpeedScale = settings.speed;
    } else if (settings.mode === "production") {
        productionBtn.classList.add("active");
        slider.disabled = true;
        currentSpeedScale = 0.0;
    }

    slider.value = currentSpeedScale;
    speedValue.textContent = currentSpeedScale.toFixed(2);
    publishSpeed(currentSpeedScale);
}

lowBtn.addEventListener("click", () => {
    settings.mode  = "low_testing";
    settings.speed = 0.1;
    applySettings();
    saveSettings();
});

highBtn.addEventListener("click", () => {
    settings.mode = "high_testing";
    if (settings.speed < 0.5) settings.speed = 0.5;
    applySettings();
    saveSettings();
});

productionBtn.addEventListener("click", () => {
    settings.mode  = "production";
    settings.speed = 0.0;
    applySettings();
    saveSettings();
});

slider.addEventListener("input", () => {
    if (settings.mode !== "high_testing") return;
    settings.speed    = parseFloat(slider.value);
    currentSpeedScale = settings.speed;
    speedValue.textContent = currentSpeedScale.toFixed(2);
    saveSettings();
    publishSpeed(currentSpeedScale);
});

cncButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        cncButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        settings.cnc = btn.textContent.trim();
        saveSettings();
        publishCNC(settings.cnc);
    });
});

loadSettings();


// ============================================================
// CYCLE COUNTERS
// ============================================================

const currentEl     = document.getElementById("current-operation");
const lastSessionEl = document.getElementById("last-session");
const totalEl       = document.getElementById("total-operation");
const resetBtn      = document.getElementById("reset-total");

let currentCount    = 0;
let lastCount       = 0;
let lastSession     = 0;
let totalOperations = 0;

async function loadCycleSettings() {
    try {
        const res  = await fetch("/settings");
        const data = await res.json();
        lastSession     = data.last_session_operations || 0;
        totalOperations = data.total_operations        || 0;
        updateCycleUI();
    } catch (err) {
        console.error("Error loading cycle settings:", err);
    }
}

async function saveCycleSettings() {
    try {
        const res  = await fetch("/settings");
        const data = await res.json();
        data.total_operations        = totalOperations;
        data.last_session_operations = lastSession;
        await fetch("/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    } catch (err) {
        console.error("Error saving cycle data:", err);
    }
}


function handleCycleIncrement() {
    currentCount++;
    totalOperations++;
    lastCount = currentCount;
    updateCycleUI();
    saveCycleSettings();
}

function updateCycleUI() {
    if (currentEl)     currentEl.textContent     = currentCount;
    if (lastSessionEl) lastSessionEl.textContent = lastSession;
    if (totalEl)       totalEl.textContent        = totalOperations;
}

if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
        try {
            await fetch("/cycle/reset");
            totalOperations = 0;
            updateCycleUI();
        } catch (err) {
            console.error("Failed to reset total:", err);
        }
    });
}

loadCycleSettings();


// ============================================================
// CYCLE TIMES
// ============================================================

const lastCycleEl = document.getElementById("last-cycle-time");
const avg5El      = document.getElementById("avg-5");
const avg15El     = document.getElementById("avg-15");

const recent5 = [], recent15 = [];
let sum5 = 0, sum15 = 0;

function pushToBuffer(buffer, newValue, maxSize, currentSum) {
    if (buffer.length >= maxSize) currentSum -= buffer.shift();
    buffer.push(newValue);
    return currentSum + newValue;
}

// CYCLE_TIME payload is the delta in seconds (computed server-side)
window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg || msg.type !== "CYCLE_TIME" || msg.payload === null) return;

    const deltaSec = msg.payload;

    // ✅ COUNT FIX (ADD THIS LINE)
    handleCycleIncrement();

    // ✅ EXISTING TIME LOGIC
    if (deltaSec > 0 && deltaSec < 300) {
        if (lastCycleEl) lastCycleEl.textContent = deltaSec.toFixed(3);

        sum5  = pushToBuffer(recent5,  deltaSec, 5,  sum5);
        sum15 = pushToBuffer(recent15, deltaSec, 15, sum15);

        if (avg5El)  avg5El.textContent  = (sum5  / recent5.length).toFixed(3);
        if (avg15El) avg15El.textContent = (sum15 / recent15.length).toFixed(3);
    }
});


// ============================================================
// JOINT STATUS
// ============================================================

function handleJointStatus(msg) {
    if (!msg || !msg.name || !msg.op_status) return;

    const jointOrder = ["joint1", "joint2", "joint3", "joint4", "joint5", "joint6"];

    const jointOps = jointOrder.map(name => {
        const index = msg.name.indexOf(name);
        return index !== -1 ? Boolean(msg.op_status[index]) : false;
    });

    let allActive = true;

    jointOps.forEach((active, i) => {
        const el = document.getElementById(`joint${i + 1}`);
        if (!el) return;
        el.classList.toggle("green", active);
        el.classList.toggle("red", !active);
        if (!active) allActive = false;
    });

    allJointsOp = allActive;

    const overallIndicator = document.getElementById("joint-overall-indicator");
    if (overallIndicator) {
        overallIndicator.classList.toggle("green", allActive);
        overallIndicator.classList.toggle("red", !allActive);
        overallIndicator.title = allActive
            ? "All joints OPERATION_ENABLED"
            : "One or more joints not operational";
    }
}

// DRIVER_STATUS comes from the backend (rosService.js → wsServer → MainWeb → iframe)
function handleDriverStatus(data) {
    if (!data) return;
    const { jointStatus } = data;
    if (!jointStatus) return;

    const allActive = jointStatus.every(Boolean);
    allJointsOp = allActive;

    jointStatus.forEach((active, i) => {
        const el = document.getElementById(`joint${i + 1}`);
        if (!el) return;
        el.classList.toggle("green", active);
        el.classList.toggle("red", !active);
    });

    const overallIndicator = document.getElementById("joint-overall-indicator");
    if (overallIndicator) {
        overallIndicator.classList.toggle("green", allActive);
        overallIndicator.classList.toggle("red", !allActive);
    }
}


// ============================================================
// ROBOT CONTROL (START / EXIT / RUN ONCE)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const startBtn   = document.getElementById("start-btn");
    const exitBtn    = document.getElementById("exit-btn");
    const runonceBtn = document.getElementById("runonce-btn");

    if (!startBtn || !exitBtn || !runonceBtn) {
        console.error("❌ One or more control buttons not found");
        return;
    }

    // Disabled until backend confirms BT is ready
    setTimeout(() => {
        startBtn.classList.add("btn-disabled");
        runonceBtn.classList.add("btn-disabled");
    }, 1500);

    function setStartButtonsEnabled(enabled) {
        [startBtn, runonceBtn].forEach(btn => {
            btn.disabled = !enabled;
            btn.classList.toggle("btn-disabled", !enabled);
        });
    }

    // Listen for MOTION_ACTIVE from backend
    window.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === "CONTROL_ACTIVE") setStartButtonsEnabled(msg.payload);
    });

    function publishSpeedBeforeStart() {
        publishSpeed(currentSpeedScale);
    }

    startBtn.addEventListener("click", () => {
        if (startBtn.disabled) return;
        const { allowed, issues } = canRobotStart();
        if (!allowed) { showStartBlockedModal(issues); return; }

        sendToParent({ type: "UI_COMMANDS", payload: { command: "change_mode", value: "8" } });
        publishSpeedBeforeStart();
        setTimeout(() => {
            sendToParent({ type: "UI_COMMANDS", payload: { command: "control_start_bt", value: true } });
        }, 750);
    });

    runonceBtn.addEventListener("click", () => {
        if (runonceBtn.disabled) return;
        const { allowed, issues } = canRobotStart();
        if (!allowed) { showStartBlockedModal(issues); return; }

        sendToParent({ type: "UI_COMMANDS", payload: { command: "change_mode", value: "8" } });
        publishSpeedBeforeStart();
        setTimeout(() => {
            sendToParent({ type: "UI_COMMANDS", payload: { command: "control_start_bt", value: true } });
            setTimeout(() => {
                sendToParent({ type: "UI_COMMANDS", payload: { command: "control_reset_bt", value: true } });
            }, 3000);
        }, 750);
    });

    exitBtn.addEventListener("click", () => {
        sendToParent({ type: "UI_COMMANDS", payload: { command: "control_reset_bt", value: true } });
    });

    // --- Process Toggle ---
    const processToggle    = document.querySelector(".process-toggle");
    const processIndicator = document.querySelector(".process-status-indicator");
    let processState = "stopped";

    window.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg || msg.type !== "PROCESS_STATUS") return;

        const firstWord = (msg.payload || "").trim().split(/\s+/)[0].toLowerCase();

        if (firstWord === "running") {
            processState = "running";
            processToggle?.classList.add("active");
            processIndicator?.classList.add("running");
        } else if (firstWord === "stopped") {
            processState = "stopped";
            processToggle?.classList.remove("active");
            processIndicator?.classList.remove("running");
            setTimeout(() => {
                startBtn.classList.add("btn-disabled");
                runonceBtn.classList.add("btn-disabled");
            }, 1000);
        }
    });

    processToggle?.addEventListener("click", () => {
        if (processState === "running") {
            processState = "stopped";
            processToggle.classList.remove("active");
            sendToParent({ type: "UI_COMMANDS", payload: { command: "process_control", value: "stop" } });
        } else {
            processState = "running";
            processToggle.classList.add("active");
            sendToParent({ type: "UI_COMMANDS", payload: { command: "process_control", value: "start" } });
        }
    });
});


// ============================================================
// DI STATUS
// ============================================================

const INDEX_MAP = { di1: 0, di2: 1, di3: 2, di4: 3, di5: 4, sto1: 5, sto2: 6, edm: 7 };
const DRV2_IDX = 1; // driver 2 = array index 1

function updateDIStatusFromBackend(payload) {
    // Extract CNC signals from driver 2 (index 1), di3 & di4
    if (Array.isArray(payload) && payload[DRV2_IDX]) {
        cncFaultActive = Boolean(payload[DRV2_IDX][INDEX_MAP.di3]);
        cncAutoMode    = Boolean(payload[DRV2_IDX][INDEX_MAP.di4]);
    }

    // Update indicator elements
    document.querySelectorAll(".di-item").forEach(item => {
        const driver    = parseInt(item.dataset.driver, 10);
        const diKey     = item.dataset.diKey;
        const indicator = item.querySelector(".di-indicator");
        if (!indicator) return;

        const driverData = payload[driver - 1];
        if (!driverData) return;

        const index    = INDEX_MAP[diKey];
        const isActive = driverData[index];
        indicator.classList.toggle("active", Boolean(isActive));
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const diContainer = document.getElementById("di-container");
    let diEditMode = false;

    async function loadDILayoutFromBackend() {
        const res = await fetch("/ros/di-layout");
        return await res.json();
    }
    let diLayoutData = await loadDILayoutFromBackend();
    const diUsedPositions = new Set();

    // Edit button
    const diHeader  = document.querySelector("#di-status .section-header-do");
    const diEditBtn = document.createElement("button");
    diEditBtn.innerHTML = '<i class="fa-solid fa-up-down-left-right"></i>';
    diEditBtn.className = "edit-layout-btn";
    diHeader?.appendChild(diEditBtn);

    diEditBtn.addEventListener("click", () => {
        diEditMode = !diEditMode;
        diEditBtn.innerHTML = diEditMode
            ? '<i class="fa-regular fa-square-check"></i>'
            : '<i class="fa-solid fa-up-down-left-right"></i>';
        diContainer.classList.toggle("edit-mode", diEditMode);
        if (!diEditMode) saveDILayout();
    });

    function getDISmartPosition(w, h) {
        const gs = 20, pad = 10;
        for (let r = 0; r < 10; r++) {
            for (let x = 0; x <= r; x++) {
                for (let y = 0; y <= r; y++) {
                    if (!x && !y) continue;
                    for (const [px, py] of [
                        [x * (w + pad), y * (h + pad)], [-x * (w + pad), y * (h + pad)],
                        [x * (w + pad), -y * (h + pad)], [-x * (w + pad), -y * (h + pad)]
                    ]) {
                        const gx = Math.round(px / gs) * gs;
                        const gy = Math.round(py / gs) * gs;
                        const key = `${gx},${gy}`;
                        if (!diUsedPositions.has(key)) {
                            const cr = diContainer.getBoundingClientRect();
                            if (gx >= 0 && gy >= 0 && gx + w <= cr.width && gy + h <= cr.height) {
                                diUsedPositions.add(key);
                                return { x: gx, y: gy };
                            }
                        }
                    }
                }
            }
        }
        const cr = diContainer.getBoundingClientRect();
        let x, y, attempts = 0;
        do {
            x = Math.round(Math.floor(Math.random() * (cr.width  - w)) / gs) * gs;
            y = Math.round(Math.floor(Math.random() * (cr.height - h)) / gs) * gs;
        } while (diUsedPositions.has(`${x},${y}`) && ++attempts < 50);
        diUsedPositions.add(`${x},${y}`);
        return { x, y };
    }

    function createDISafeId(name, driverId, diId) {
        return `di_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${driverId}_${diId}`;
    }

    function mapDiIdToKey(diId) {
        return ({ "1": "di1", "2": "di2", "3": "di3", "4": "di4", "5": "di5", "6": "sto1", "7": "sto2", "8": "edm" })[diId] || `di${diId}`;
    }

    function makeDIDraggable(el) {
        let dragging = false, sx, sy, ix, iy;
        el.addEventListener("mousedown", e => {
            if (!diEditMode) return;
            dragging = true; e.preventDefault();
            const r = el.getBoundingClientRect(), cr = diContainer.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; ix = r.left - cr.left; iy = r.top - cr.top;
            el.style.zIndex = "1000"; el.classList.add("dragging");
        });
        document.addEventListener("mousemove", e => {
            if (!dragging) return;
            const cr = diContainer.getBoundingClientRect(), er = el.getBoundingClientRect(), gs = 10;
            let nx = Math.round((ix + e.clientX - sx) / gs) * gs;
            let ny = Math.round((iy + e.clientY - sy) / gs) * gs;
            nx = Math.max(0, Math.min(cr.width  - er.width,  nx));
            ny = Math.max(0, Math.min(cr.height - er.height, ny));
            el.style.left = `${nx}px`; el.style.top = `${ny}px`;
        });
        document.addEventListener("mouseup", () => {
            if (dragging) { dragging = false; el.style.zIndex = "1"; el.classList.remove("dragging"); }
        });
    }

    async function saveDILayout() {
        const layout = {};
        diContainer.querySelectorAll(".di-item").forEach(el => {
            layout[el.id] = { x: parseInt(el.style.left) || 0, y: parseInt(el.style.top) || 0 };
        });
        await fetch("/ros/di-layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(layout),
        });
    }

    async function loadDIList() {
        try {
            const res  = await fetch("/ros/di-list");
            const json = await res.json();
            const temp = [];

            json.data.forEach(di => {
                const diKey  = mapDiIdToKey(di.di_id);
                const safeId = createDISafeId(di.name, di.driver_id, di.di_id);
                const div    = document.createElement("div");
                div.className = "di-item";
                div.id        = safeId;
                div.title     = `${di.name} (Driver: ${di.driver_id}, DI: ${diKey})`;
                div.dataset.driver = di.driver_id;
                div.dataset.diKey  = diKey;
                div.innerHTML = `<span class="di-label">${di.name}</span><div class="di-indicator" id="indicator_${safeId}"></div>`;
                temp.push({ div, safeId });
            });

            temp.forEach(({ div }) => diContainer.appendChild(div));
            temp.forEach(({ div, safeId }) => {
                const er = div.getBoundingClientRect();
                const pos = diLayoutData[safeId]
                    ? (diUsedPositions.add(`${diLayoutData[safeId].x},${diLayoutData[safeId].y}`), diLayoutData[safeId])
                    : getDISmartPosition(er.width, er.height);
                div.style.cssText += `position:absolute;left:${pos.x}px;top:${pos.y}px`;
                makeDIDraggable(div);
            });
        } catch {
            createDemoDIs();
        }
    }

    function createDemoDIs() {
        [
            { name: "Limit Switch",     driver_id: "1", di_id: "1" },
            { name: "Proximity Sensor", driver_id: "1", di_id: "2" },
            { name: "Safety Gate",      driver_id: "1", di_id: "6" },
            { name: "Emergency Stop",   driver_id: "1", di_id: "7" },
            { name: "Encoder Zero",     driver_id: "2", di_id: "1" },
            { name: "Overload Detect",  driver_id: "2", di_id: "8" },
        ].forEach(di => {
            const diKey  = mapDiIdToKey(di.di_id);
            const safeId = createDISafeId(di.name, di.driver_id, di.di_id);
            const div    = document.createElement("div");
            div.className = "di-item demo-item"; div.id = safeId;
            div.dataset.driver = di.driver_id; div.dataset.diKey = diKey;
            div.innerHTML = `<span class="di-label">${di.name}</span><div class="di-indicator" id="indicator_${safeId}"></div>`;
            diContainer.appendChild(div);
            const er  = div.getBoundingClientRect();
            const pos = getDISmartPosition(er.width, er.height);
            div.style.cssText += `position:absolute;left:${pos.x}px;top:${pos.y}px`;
            makeDIDraggable(div);
        });
    }

    document.getElementById("refresh-di")?.addEventListener("click", async () => {
        diContainer.innerHTML = ""; diUsedPositions.clear();
        diLayoutData = await loadDILayoutFromBackend();
        loadDIList();
    });

    loadDIList();
});


// ============================================================
// DO CONTROL
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
    const doContainer = document.getElementById("do-container");
    let doEditMode = false;

    async function loadDOLayoutFromBackend() {
        const res = await fetch("/ros/do-layout");
        return await res.json();
    }
    let doLayoutData = await loadDOLayoutFromBackend();
    const doUsedPositions = new Set();

    function publishDO(driver, doId, state) {
        let mappedDoId = (doId === "pi_p") ? 4 : parseInt(doId);
        sendToParent({ type: "TOGGLE_DO", payload: { driver, doId: mappedDoId, state } });
    }

    async function handlePush(doItem, btn) {
        publishDO(doItem.driver_id, doItem.do_id, true);
        btn.disabled = true;
        await new Promise(r => setTimeout(r, parseInt(doItem.push_wait) || 250));
        publishDO(doItem.driver_id, doItem.do_id, false);
        btn.disabled = false;
    }

    function handleSwitch(doItem, toggleEl) {
        publishDO(doItem.driver_id, doItem.do_id, toggleEl.checked);
    }

    const doHeader  = document.querySelector("#do-control .section-header-do");
    const doEditBtn = document.createElement("button");
    doEditBtn.innerHTML = '<i class="fa-solid fa-up-down-left-right"></i>';
    doEditBtn.className = "edit-layout-btn";
    doHeader?.appendChild(doEditBtn);

    doEditBtn.addEventListener("click", () => {
        doEditMode = !doEditMode;
        doEditBtn.innerHTML = doEditMode
            ? '<i class="fa-regular fa-square-check"></i>'
            : '<i class="fa-solid fa-up-down-left-right"></i>';
        doContainer.classList.toggle("edit-mode", doEditMode);
        if (!doEditMode) saveDOLayout();
    });

    function getDOSmartPosition(w, h) {
        const gs = 20, pad = 10;
        for (let r = 0; r < 10; r++) {
            for (let x = 0; x <= r; x++) {
                for (let y = 0; y <= r; y++) {
                    if (!x && !y) continue;
                    for (const [px, py] of [
                        [x * (w + pad), y * (h + pad)], [-x * (w + pad), y * (h + pad)],
                        [x * (w + pad), -y * (h + pad)], [-x * (w + pad), -y * (h + pad)]
                    ]) {
                        const gx = Math.round(px / gs) * gs;
                        const gy = Math.round(py / gs) * gs;
                        const key = `${gx},${gy}`;
                        if (!doUsedPositions.has(key)) {
                            const cr = doContainer.getBoundingClientRect();
                            if (gx >= 0 && gy >= 0 && gx + w <= cr.width && gy + h <= cr.height) {
                                doUsedPositions.add(key);
                                return { x: gx, y: gy };
                            }
                        }
                    }
                }
            }
        }
        const cr = doContainer.getBoundingClientRect();
        let x, y, attempts = 0;
        do {
            x = Math.round(Math.floor(Math.random() * (cr.width  - w)) / gs) * gs;
            y = Math.round(Math.floor(Math.random() * (cr.height - h)) / gs) * gs;
        } while (doUsedPositions.has(`${x},${y}`) && ++attempts < 50);
        doUsedPositions.add(`${x},${y}`);
        return { x, y };
    }

    function createDOSafeId(name, driverId, doId) {
        return `do_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}_${driverId}_${doId}`;
    }

    function makeDODraggable(el) {
        let dragging = false, sx, sy, ix, iy;
        el.addEventListener("mousedown", e => {
            if (!doEditMode) return;
            dragging = true; e.preventDefault();
            const r = el.getBoundingClientRect(), cr = doContainer.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; ix = r.left - cr.left; iy = r.top - cr.top;
            el.style.zIndex = "1000"; el.classList.add("dragging");
        });
        document.addEventListener("mousemove", e => {
            if (!dragging) return;
            const cr = doContainer.getBoundingClientRect(), er = el.getBoundingClientRect(), gs = 10;
            let nx = Math.round((ix + e.clientX - sx) / gs) * gs;
            let ny = Math.round((iy + e.clientY - sy) / gs) * gs;
            nx = Math.max(0, Math.min(cr.width  - er.width,  nx));
            ny = Math.max(0, Math.min(cr.height - er.height, ny));
            el.style.left = `${nx}px`; el.style.top = `${ny}px`;
        });
        document.addEventListener("mouseup", () => {
            if (dragging) { dragging = false; el.style.zIndex = "1"; el.classList.remove("dragging"); }
        });
    }

    async function saveDOLayout() {
        const layout = {};
        doContainer.querySelectorAll(".do-item").forEach(el => {
            layout[el.id] = { x: parseInt(el.style.left) || 0, y: parseInt(el.style.top) || 0 };
        });
        await fetch("/ros/do-layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(layout),
        });
    }

    async function loadDOList() {
        try {
            const res  = await fetch("/ros/do-list");
            const json = await res.json();
            const temp = [];

            json.data.forEach(doItem => {
                const doId = createDOSafeId(doItem.name, doItem.driver_id, doItem.do_id);
                const div  = document.createElement("div");
                div.className = "do-item"; div.id = doId;
                div.title = `${doItem.name} (Driver: ${doItem.driver_id}, DO: ${doItem.do_id})`;
                div.innerHTML = `
                    <span class="do-label">${doItem.name} :</span>
                    ${doItem.type_of_control === "switch"
                        ? `<label class="switch-wrapper"><input type="checkbox" class="switch-input"><span class="switch-slider"></span></label>`
                        : `<button class="do-btn">Push</button>`}`;
                temp.push({ doItem, div, doId });
            });

            temp.forEach(({ div }) => doContainer.appendChild(div));
            temp.forEach(({ doItem, div, doId }) => {
                const er = div.getBoundingClientRect();
                const pos = doLayoutData[doId]
                    ? (doUsedPositions.add(`${doLayoutData[doId].x},${doLayoutData[doId].y}`), doLayoutData[doId])
                    : getDOSmartPosition(er.width, er.height);
                div.style.cssText += `position:absolute;left:${pos.x}px;top:${pos.y}px`;
                makeDODraggable(div);

                const btn    = div.querySelector("button");
                const toggle = div.querySelector("input[type=checkbox]");
                btn?.addEventListener("click",  () => handlePush(doItem, btn));
                toggle?.addEventListener("change", () => handleSwitch(doItem, toggle));
            });
        } catch (err) {
            console.error("Failed to fetch DO list:", err);
        }
    }

    document.getElementById("refresh-do")?.addEventListener("click", async () => {
        doContainer.innerHTML = ""; doUsedPositions.clear();
        doLayoutData = await loadDOLayoutFromBackend();
        loadDOList();
    });

    loadDOList();
});


// ============================================================
// LEGACY LAYOUT EDITOR (localStorage-based, kept for compat)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".editable-container").forEach(container => {
        const type    = container.id.startsWith("di") ? "di" : "do";
        const editBtn = document.querySelector(`.edit-btn[data-target="${type}"]`);
        const saveBtn = document.querySelector(`.save-btn[data-target="${type}"]`);
        if (!editBtn || !saveBtn) return;

        loadLegacyLayout(container, type);
        editBtn.addEventListener("click", () => toggleLegacyEdit(container, editBtn, saveBtn, type));
        saveBtn.addEventListener("click", () => saveLegacyLayout(container, editBtn, saveBtn, type));
    });
});

function toggleLegacyEdit(container, editBtn, saveBtn, type) {
    const isEditing = container.classList.toggle("edit-mode");
    editBtn.textContent = isEditing ? "Add / Delete" : "Edit";
    saveBtn.disabled = !isEditing;
    isEditing ? enableLegacyEditing(container) : disableLegacyEditing(container);
}
function enableLegacyEditing(container)  { container.querySelectorAll(".movable").forEach(el => makeLegacyDraggable(el, container)); }
function disableLegacyEditing(container) { container.querySelectorAll(".movable").forEach(el => { el.onmousedown = null; }); }

function makeLegacyDraggable(el, container) {
    let oX, oY, drag = false;
    el.onmousedown = e => {
        drag = true; el.style.cursor = "grabbing"; oX = e.offsetX; oY = e.offsetY;
        document.onmousemove = e => {
            if (!drag) return;
            const r = container.getBoundingClientRect();
            el.style.left = Math.round(Math.max(0, Math.min(e.clientX - r.left - oX, r.width  - el.offsetWidth))  / 10) * 10 + "px";
            el.style.top  = Math.round(Math.max(0, Math.min(e.clientY - r.top  - oY, r.height - el.offsetHeight)) / 10) * 10 + "px";
        };
        document.onmouseup = () => { drag = false; el.style.cursor = "grab"; document.onmousemove = null; };
    };
}

function saveLegacyLayout(container, editBtn, saveBtn, type) {
    const layout = [];
    container.querySelectorAll(".movable").forEach(el => {
        layout.push({ id: el.id, x: parseInt(el.style.left || 0), y: parseInt(el.style.top || 0), width: el.offsetWidth, height: el.offsetHeight });
    });
    localStorage.setItem(`layout_${type}`, JSON.stringify(layout));
    saveBtn.disabled = true; container.classList.remove("edit-mode"); disableLegacyEditing(container);
}

function loadLegacyLayout(container, type) {
    try {
        const saved = localStorage.getItem(`layout_${type}`);
        if (!saved) return;
        JSON.parse(saved).forEach(item => {
            const el = document.getElementById(item.id);
            if (el) { el.style.position = "absolute"; el.style.left = item.x + "px"; el.style.top = item.y + "px"; el.classList.add("movable"); }
        });
    } catch (err) {
        console.error("Failed to load layout:", err);
    }
}