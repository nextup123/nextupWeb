// ============================================================
// Combined Frontend JS
// Merged from: ros_init.js, doDiWeb.js, action.js
// ============================================================


// ============================================================
// SECTION 1 — SHARED CONSTANTS
// ============================================================

const API_BASE = 'http://localhost:3000/io-control';
let xmlContent = '';
let editingControlName = null;
let editingControlType = null;


// ============================================================
// SECTION 2 — ROS INIT  (ros_init.js)
// ============================================================

// const ros = new ROSLIB.Ros({ url: 'ws://localhost:9090' });
const statusElem = document.getElementById('di_indicator_status');

ros.on('connection', () => {
    statusElem.textContent = 'Connected';
    statusElem.className = 'di-indicator-status connected';
});
ros.on('error', (err) => {
    statusElem.textContent = 'Error';
    statusElem.className = 'di-indicator-status error';
    console.error(err);
});
ros.on('close', () => {
    statusElem.textContent = 'Closed';
    statusElem.className = 'di-indicator-status closed';
});


// --- Publish DO ---
function  publishDO(driver, doId, state) {
    const topicName = `/nextup_digital_output_controller_${driver}/commands`;
    const digitalOutputTopic = new ROSLIB.Topic({
        ros,
        name: topicName,
        messageType: 'nextup_joint_interfaces/NextupDigitalOutputs'
    });
    const message = new ROSLIB.Message({
        do1: doId === 1 ? [state] : [],
        do2: doId === 2 ? [state] : [],
        do3: doId === 3 ? [state] : [],
        pi_p: doId === 4 ? [state] : []
    });
    digitalOutputTopic.publish(message);
}

// --- Toggle DO ---
function toggleDO(driver, doId) {
  const toggle = document.getElementById(`do_toggle_${driver}_${doId}`);
  const state = toggle.checked;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("WS not connected");
    return;
  }

  ws.send(JSON.stringify({
    type: "TOGGLE_DO",
    payload: { driver, doId, state }
  }));
}

// --- Build DI Table (8 x 6 grid) ---
const diTbody = document.getElementById('di_indicator_table_body');
const DI_ROWS = ['DI1', 'DI2', 'DI3', 'DI4', 'DI5', 'DI6', 'DI7', 'DI8'];

for (let di = 0; di < DI_ROWS.length; di++) {
    const row = document.createElement('tr');
    let html = `<td><b>${DI_ROWS[di]}</b></td>`;

    for (let drv = 1; drv <= 6; drv++) {
        const id = `di_indicator_${drv}_${di}`;
        html += `<td><div class="di-indicator-light" id="${id}"></div></td>`;
    }

    row.innerHTML = html;
    diTbody.appendChild(row);
}

// --- Subscriber for Digital Inputs ---
function subscribeToDITopic() {
    const sub = new ROSLIB.Topic({
        ros,
        name: '/nextup_digital_inputs',
        messageType: 'nextup_joint_interfaces/msg/NextupDigitalInputs'
    });

    sub.subscribe((msg) => {
        const jointCount = msg.name?.length || 0;
        if (jointCount === 0) return;

        const diMap = [
            msg.di1, msg.di2, msg.di3, msg.di4,
            msg.di5, msg.sto1, msg.sto2, msg.edm
        ];

        for (let drv = 0; drv < jointCount; drv++) {
            for (let di = 0; di < diMap.length; di++) {
                const value = diMap[di]?.[drv];
                const indicator = document.getElementById(`di_indicator_${drv + 1}_${di}`);
                if (!indicator || value === undefined) continue;
                indicator.classList.toggle('on', value === true);
            }
        }
    });
}

// --- Collect all DI indicators for boot animation ---
const allDiIndicators = [];
const TOTAL_DI_ROWS = 8;
const TOTAL_DRIVERS = 6;

for (let di = 0; di < TOTAL_DI_ROWS; di++) {
    for (let drv = 1; drv <= TOTAL_DRIVERS; drv++) {
        const el = document.getElementById(`di_indicator_${drv}_${di}`);
        if (el) allDiIndicators.push(el);
    }
}

// --- Boot Animation ---
function playBootAnimation(callback) {
    if (!allDiIndicators.length) {
        callback && callback();
        return;
    }

    const totalDuration = 1000;
    const stepTime = totalDuration / allDiIndicators.length;

    allDiIndicators.forEach((ind, i) => {
        setTimeout(() => {
            ind.classList.add('on');
            setTimeout(() => ind.classList.remove('on'), stepTime * 0.8);
        }, i * stepTime);
    });

    setTimeout(() => {
        callback && callback();
    }, totalDuration + 100);
}


// ============================================================
// SECTION 3 — DO/DI WEB EDITOR  (doDiWeb.js)
// ============================================================

// DOM elements
const doName = document.getElementById('doName');
const doDriverId = document.getElementById('doDriverId');
const doIdSelect = document.getElementById('doId');
const controlType = document.getElementById('controlType');
const pushWait = document.getElementById('pushWait');
const doResponseMsg = document.getElementById('doResponseMsg');
const diName = document.getElementById('diName');
const diDriverId = document.getElementById('diDriverId');
const diId = document.getElementById('diId');
const waitTimeEnabled = document.getElementById('waitTimeEnabled');
const diFallbackEnabled = document.getElementById('diFallbackEnabled');
const waitTime = document.getElementById('waitTime');
const diResponseMsg = document.getElementById('diResponseMsg');
const updateDOBtn = document.getElementById('updateDOBtn');
const updateDIBtn = document.getElementById('updateDIBtn');
const sequenceList = document.getElementById('sequenceList');
const xmlOutput = document.getElementById('xmlOutput');
const xmlModal = document.getElementById('xmlModal');
const sequenceCount = document.getElementById('sequenceCount');
const editorSlider = document.querySelector('.editor-slider');
const diEditor = document.getElementById('diEditor');
const doEditor = document.getElementById('doEditor');

let currentEditor = 0;

function showStatus(message, type = 'success', timeout = 3000) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
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
    return toast;
}

function openXMLModal() {
    reloadXML();
    xmlOutput.textContent = xmlContent || 'No XML available';
    xmlModal.style.display = 'flex';
}

function closeXMLModal() {
    xmlModal.style.display = 'none';
}

let currentFontSize = 10;
function changeFontSize(delta) {
    currentFontSize = Math.min(20, Math.max(7, currentFontSize + delta));
    xmlOutput.style.fontSize = currentFontSize + 'px';
}

function copyXML() {
    navigator.clipboard.writeText(xmlOutput.textContent)
        .then(() => showStatus('XML copied to clipboard', 'success', 2000))
        .catch(() => showStatus('Failed to copy XML', 'error', 3000));
}

function togglePushWait() {
    pushWait.disabled = controlType.value !== 'push';
}

function toggleWaitTime() {
    waitTime.disabled = !waitTimeEnabled.checked;
}

function toggleDIFallback() {
    console.log(`di fallback ${diFallbackEnabled.checked ? 'enabled' : 'disabled'}`);
}

function updateDoIdOptions(driverId) {
    doIdSelect.innerHTML = '';
    const options =
        driverId === '5' || driverId === '6'
            ? ['1', '2', '3', 'pi_p']
            : ['1', '3', 'pi_p'];

    options.forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = id;
        doIdSelect.appendChild(option);
    });

    const previous = doIdSelect.value;
    doIdSelect.value =
        editingControlName && doIdSelect.querySelector(`option[value="${previous}"]`)
            ? previous
            : '1';

    enforceControlTypeForDO();
}

function enforceControlTypeForDO() {
    const isPiP = doIdSelect.value === 'pi_p';
    const pushOption = controlType.querySelector('option[value="push"]');
    if (isPiP) {
        if (pushOption) pushOption.disabled = true;
        controlType.value = 'switch';
    } else {
        if (pushOption) pushOption.disabled = false;
    }
}

doIdSelect.addEventListener('change', enforceControlTypeForDO);

function swipeEditor(direction) {
    if (direction === 'left' && currentEditor > 0) {
        doEditor.classList.add('active');
        diEditor.classList.remove('active');
        currentEditor--;
    } else if (direction === 'right' && currentEditor < 1) {
        diEditor.classList.add('active');
        doEditor.classList.remove('active');
        currentEditor++;
    }
    editorSlider.style.transform = `translateX(-${currentEditor * 50}%)`;
}

async function loadSequences() {
    try {
        const res = await fetch(`${API_BASE}/getTreeData`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const sequences = await res.json();
        sequenceList.innerHTML = '';
        sequenceCount.textContent = sequences.length;
        if (sequences.length === 0) {
            sequenceList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No sequences added yet</p>
                    <small>Start by creating a sequence using the editors</small>
                </div>
            `;
            return;
        }
        sequences.forEach((seq, index) => {
            const div = document.createElement('div');
            div.className = `sequence-item ${seq.type === 'DO' ? 'sequence-do' : 'sequence-di'}`;
            div.draggable = true;
            div.dataset.name = seq.name;
            div.dataset.type = seq.type;
            const details = `
                <div class="sequence-details">
                    <span class="badge badge-primary">${seq.name}</span>
                    <span class="badge badge-secondary">${seq.type.toUpperCase()}</span>
                    <span class="badge badge-secondary">Driver: ${seq.driverId}</span>
                    <span class="badge badge-secondary">${seq.type === 'DO' ? `DO ID: ${seq.doId}` : `DI ID: ${seq.diId}`}</span>
                    ${seq.type === 'DO' ? `<span class="badge badge-secondary">Control: ${seq.controlType}</span>` : ''}
                    ${seq.type === 'DO' && seq.controlType === 'push' ? `<span class="badge badge-secondary">Push Wait: ${seq.pushWait}ms</span>` : ''}
                    ${seq.type === 'DI' && seq.waitTime ? `<span class="badge badge-secondary">Wait Time: ${seq.waitTime}ms</span>` : ''}
                </div>
            `;
            div.innerHTML = `
                <div class="sequence-index-container">
                    <span class="drag-handle"></span>
                    <span class="sequence-index">${index + 1}</span>
                </div>
                <div class="sequence-content">${details}</div>
                <div class="sequence-actions">
                    <button class="btn-icon btn-edit" onclick="editControl('${seq.name}', '${seq.type}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteControl('${seq.name}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            sequenceList.appendChild(div);
        });
        showStatus(`Reloaded ${sequences.length} sequences`, 'success', 1000);
        initDragAndDrop();
    } catch (err) {
        showStatus(`Failed to reload sequences: ${err.message}`, 'error', 3000);
        console.error(err);
    }
}

function initDragAndDrop() {
    const items = sequenceList.querySelectorAll('.sequence-item');
    items.forEach(item => {
        item.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', item.dataset.name);
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('drop', e => {
            e.preventDefault();
            const draggedName = e.dataTransfer.getData('text/plain');
            const targetItem = e.target.closest('.sequence-item');
            if (!targetItem || draggedName === targetItem.dataset.name) return;
            const allItems = Array.from(sequenceList.querySelectorAll('.sequence-item'));
            const draggedItem = sequenceList.querySelector(`.sequence-item[data-name="${draggedName}"]`);
            const targetIndex = allItems.indexOf(targetItem);
            const draggedIndex = allItems.indexOf(draggedItem);
            if (draggedIndex < targetIndex) {
                targetItem.after(draggedItem);
            } else {
                targetItem.before(draggedItem);
            }
            const newOrder = Array.from(sequenceList.querySelectorAll('.sequence-item')).map(i => i.dataset.name);
            reorderSequences(newOrder);
        });
    });
}

async function reorderSequences(sequenceNames) {
    await callAPI('reorderSequences', { sequenceNames }, loadSequences);
}

async function addDOControl() {
    if (!doName.value || !/^[A-Za-z0-9]+$/.test(doName.value)) {
        showStatus('DO Name must be alphanumeric without spaces', 'error', 3000);
        return;
    }
    if (!doDriverId.value || !doIdSelect.value || !controlType.value || !doResponseMsg.value) {
        showStatus('All required fields must be filled', 'error', 3000);
        return;
    }
    const body = {
        type: 'DO',
        name: `${doName.value}[DO]`,
        driverId: doDriverId.value,
        doId: doIdSelect.value,
        controlType: controlType.value,
        pushWait: controlType.value === 'push' ? pushWait.value : '250',
        responseMsg: doResponseMsg.value
    };
    await callAPI('addControl', body, () => {
        clearDOForm();
        loadSequences();
    });
}

async function updateDOControl() {
    if (!editingControlName || !doName.value || !/^[A-Za-z0-9]+(\[(DO|DI)\])?$/.test(doName.value)) {
        showStatus('DO Name must be alphanumeric without spaces', 'error', 3000);
        return;
    }
    if (!doDriverId.value || !doIdSelect.value || !controlType.value || !doResponseMsg.value) {
        showStatus('All required fields must be filled', 'error', 3000);
        return;
    }
    const body = {
        oldName: editingControlName,
        type: 'DO',
        name: doName.value,
        driverId: doDriverId.value,
        doId: doIdSelect.value,
        controlType: controlType.value,
        pushWait: controlType.value === 'push' ? pushWait.value : '250',
        responseMsg: doResponseMsg.value
    };
    await callAPI('updateControl', body, () => {
        clearDOForm();
        loadSequences();
    });
}

async function addDIControl() {
    if (!diName.value || !/^[A-Za-z0-9]+$/.test(diName.value)) {
        showStatus('DI Name must be alphanumeric without spaces', 'error', 3000);
        return;
    }
    if (!diDriverId.value || !diId.value || !diResponseMsg.value) {
        showStatus('All required fields must be filled', 'error', 3000);
        return;
    }
    const body = {
        type: 'DI',
        name: `${diName.value}[DI]`,
        driverId: diDriverId.value,
        diId: diId.value,
        waitTime: waitTimeEnabled.checked ? waitTime.value : null,
        responseMsg: diResponseMsg.value,
        with_fallback: diFallbackEnabled.checked
    };
    await callAPI('addControl', body, () => {
        clearDIForm();
        loadSequences();
    });
}

async function updateDIControl() {
    if (!editingControlName || !diName.value || !/^[A-Za-z0-9]+(\[(DO|DI)\])?$/.test(diName.value)) {
        showStatus('DI Name must be alphanumeric without spaces', 'error', 3000);
        return;
    }
    if (!diDriverId.value || !diId.value || !diResponseMsg.value) {
        showStatus('All required fields must be filled', 'error', 3000);
        return;
    }
    const body = {
        oldName: editingControlName,
        type: 'DI',
        name: diName.value,
        driverId: diDriverId.value,
        diId: diId.value,
        waitTime: waitTimeEnabled.checked ? waitTime.value : null,
        responseMsg: diResponseMsg.value,
        with_fallback: diFallbackEnabled.checked
    };
    await callAPI('updateControl', body, () => {
        clearDIForm();
        loadSequences();
    });
}

function editControl(name, type) {
    editingControlName = name;
    editingControlType = type;
    swipeEditor(type === 'DO' ? 'left' : 'right');
    fetch(`${API_BASE}/getControl/${name}`)
        .then(res => res.json())
        .then(data => {
            if (type === 'DO') {
                doName.value = data.name;
                doDriverId.value = data.driverId;
                updateDoIdOptions(data.driverId);
                doIdSelect.value = data.doId;
                controlType.value = data.controlType;
                pushWait.value = data.pushWait;
                doResponseMsg.value = data.responseMsg;
                togglePushWait();
                updateDOBtn.disabled = false;
                updateDIBtn.disabled = true;
                showStatus(`Editing ${name} (DO)`, 'success', 2000);
            } else {
                diName.value = data.name;
                diDriverId.value = data.driverId;
                diId.value = data.diId;
                waitTimeEnabled.checked = !!data.waitTime;
                diFallbackEnabled.checked = data.with_fallback;
                waitTime.value = data.waitTime || '250';
                diResponseMsg.value = data.responseMsg;
                toggleWaitTime();
                updateDIBtn.disabled = false;
                updateDOBtn.disabled = true;
                showStatus(`Editing ${name} (DI)`, 'success', 2000);
            }
        })
        .catch(err => showStatus(`Failed to load control: ${err.message}`, 'error', 3000));
}

async function deleteControl(name) {
    if (confirm(`Delete ${name}?`)) {
        await callAPI('deleteControl', { name }, loadSequences);
    }
}

async function deleteAll() {
    if (confirm('Delete all sequences?')) {
        await callAPI('deleteAll', {}, loadSequences);
    }
}

async function reloadXML() {
    await callAPI('getXML', {}, () => {
        xmlOutput.textContent = xmlContent || 'No XML available';
    });
}

async function callAPI(endpoint, body, callback) {
    showStatus('Processing...', 'process', 1000);
    try {
        const res = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok) {
            xmlContent = data.xml || 'No XML returned';
            showStatus(data.message, 'success', 2000);
            if (callback) callback();
        } else {
            xmlContent = `Error: ${data.message}`;
            showStatus(data.message, 'error', 3000);
        }
    } catch (err) {
        xmlContent = `Error: ${err.message}`;
        showStatus(`Connection error: ${err.message}`, 'error', 3000);
    }
}

function clearDOForm() {
    doName.value = '';
    doDriverId.value = '1';
    updateDoIdOptions('1');
    controlType.value = 'switch';
    pushWait.value = '250';
    doResponseMsg.value = '';
    editingControlName = null;
    editingControlType = null;
    updateDOBtn.disabled = true;
    togglePushWait();
}

function clearDIForm() {
    diName.value = '';
    diDriverId.value = '1';
    diId.value = '1';
    waitTimeEnabled.checked = false;
    waitTime.value = '250';
    diResponseMsg.value = '';
    editingControlName = null;
    editingControlType = null;
    updateDIBtn.disabled = true;
    toggleWaitTime();
}

async function reloadSequences() {
    await loadSequences();
}


// ============================================================
// SECTION 4 — ACTIONS: UNDO & SORT  (action.js)
// ============================================================

const undoBtn = document.getElementById('undoBtn');
const sortDiFirstBtn = document.getElementById('sortDiFirst');
const sortDoFirstBtn = document.getElementById('sortDoFirst');

async function makeRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}/${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        return data;
    } catch (error) {
        showStatus(`Error: ${error.message}`, 'error', 3000);
        throw error;
    }
}

async function checkUndo() {
    try {
        undoBtn.disabled = true;
        const data = await makeRequest('canUndo');
        undoBtn.disabled = !data.canUndo;
    } catch (error) {
        undoBtn.disabled = true;
        console.error('Failed to check undo:', error);
    }
}

async function performUndo() {
    try {
        undoBtn.disabled = true;
        await makeRequest('undo', { method: 'POST' });
        showStatus('Undo successful', 'success', 1000);
        setTimeout(reloadSequences, 500);
        setTimeout(checkUndo, 300);
    } catch (error) {
        console.error('Failed to undo:', error);
        checkUndo();
    }
}

async function sortSequences(sortOrder) {
    try {
        await makeRequest(`reorderSequences?sortOrder=${sortOrder}`, { method: 'POST' });
        showStatus(`Sorted ${sortOrder === 'diFirst' ? 'DI' : 'DO'} first successfully`, 'success', 1000);
        setTimeout(reloadSequences, 200);
        setTimeout(checkUndo, 300);
    } catch (error) {
        console.error(`Failed to sort ${sortOrder}:`, error);
        showStatus(`Failed to sort ${sortOrder === 'diFirst' ? 'DI' : 'DO'} first`, 'error', 3000);
    }
}


// ============================================================
// SECTION 5 — INIT (replaces window.onload + init() from both files)
// ============================================================

async function init() {
    // Editor UI
    await loadSequences();
    togglePushWait();
    toggleWaitTime();
    updateDoIdOptions(doDriverId.value);
    doDriverId.addEventListener('change', () => updateDoIdOptions(doDriverId.value));

    // Undo / sort buttons
    checkUndo();
    sortDiFirstBtn.addEventListener('click', () => sortSequences('diFirst'));
    sortDoFirstBtn.addEventListener('click', () => sortSequences('doFirst'));

    // Boot animation → then subscribe to ROS topics
  
}

init();