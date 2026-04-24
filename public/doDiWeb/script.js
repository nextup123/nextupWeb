const API_BASE = 'http://localhost:3000/io-control';
let xmlContent = '';
let editingControlName = null;
let editingControlType = null;

// DOM elements
const doName = document.getElementById('doName');
const doDriverId = document.getElementById('doDriverId');
const doId = document.getElementById('doId');
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

//---------------------------------------------------ROS CODE------------------------------------------------------
const allDiIndicators = [];

// setInterval(() => {
//     console.log(allDiIndicators);
// }, 1000);

window.addEventListener("message", (event) => {
    const msg = event.data;

    if (!msg || !msg.type) return;

    switch (msg.type) {

        case "DO_STATUS":
            const { driver, do1, do2, do3, do4 } = msg.payload;

            [1, 2, 3, 4].forEach((id) => {
                const state =
                    id === 1 ? do1 :
                        id === 2 ? do2 :
                            id === 3 ? do3 :
                                do4;

                const indicator = document.getElementById(`do_indicator_${driver}_${id}`);
                const toggle = document.getElementById(`do_toggle_${driver}_${id}`);

                if (indicator) {
                    indicator.classList.toggle("on", state);
                }
                if (toggle) {
                    toggle.checked = state;
                }
            });
            break;


        // In the DI_STATUS message handler in script.js
        case "DI_STATUS":
            const payload = msg.payload;
            console.log(payload);
            payload.forEach((driverData, drvIndex) => {
                driverData.forEach((value, diIndex) => {
                    const id = `di_indicator_${drvIndex + 1}_${diIndex}`;
                    const indicator = document.getElementById(id);
                    if (indicator) {
                        indicator.classList.toggle("on", value === true);
                    }
                });
            });
            break;
    }
});

// ========== ROS INITIALIZATION ==========

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
            setTimeout(() => {
                ind.classList.remove('on');
            }, stepTime * 0.8);
        }, i * stepTime);
    });
    setTimeout(() => {
        callback && callback();
    }, totalDuration + 100);
}


function toggleDO(driver, doId) {
    const toggle = document.getElementById(`do_toggle_${driver}_${doId}`);
    const state = toggle.checked;

    window.parent.postMessage({
        type: "TOGGLE_DO",
        payload: { driver, doId, state }
    }, "*");
}
// ----------------------------------------------------------------------------------------------------------------

let currentEditor = 0;

function showStatus(message, type = "success", timeout = 3000) {
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
                    if (toast.parentElement) {
                        toast.remove();
                    }
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
    currentFontSize += delta;
    if (currentFontSize < 7) currentFontSize = 7;
    if (currentFontSize > 20) currentFontSize = 20;
    xmlOutput.style.fontSize = currentFontSize + "px";
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
    if (diFallbackEnabled.checked) {
        console.log('di fallback enabled');
    }
    else {
        console.log('di fallback disabled');
    }
}

function updateDoIdOptions(driverId) {
    const doIdSelect = document.getElementById('doId');
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
        editingControlName &&
            doIdSelect.querySelector(`option[value="${previous}"]`)
            ? previous
            : '1';

    enforceControlTypeForDO();
}

function enforceControlTypeForDO() {
    const doIdSelect = document.getElementById('doId');
    const controlTypeSelect = document.getElementById('controlType');

    const isPiP = doIdSelect.value === 'pi_p';

    const pushOption = controlTypeSelect.querySelector('option[value="push"]');
    const switchOption = controlTypeSelect.querySelector('option[value="switch"]');

    if (isPiP) {
        if (pushOption) pushOption.disabled = true;
        controlTypeSelect.value = 'switch';
    } else {
        if (pushOption) pushOption.disabled = false;
    }
}

document.getElementById('doId').addEventListener('change', enforceControlTypeForDO);

function swipeEditor(direction) {
    if (direction === 'left' && currentEditor > 0) {
        currentEditor--;
    } else if (direction === 'right' && currentEditor < 1) {
        currentEditor++;
    }
    editorSlider.style.transform = `translateX(-${currentEditor * 50}%)`;

    // ✅ Keep tab highlight in sync
    document.getElementById('doEditor').classList.toggle('active', currentEditor === 0);
    document.getElementById('diEditor').classList.toggle('active', currentEditor === 1);
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
                <div class="sequence-content">
                    ${details}
                </div>
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
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('drop', e => {
            e.preventDefault();
            const draggedName = e.dataTransfer.getData('text/plain');
            const targetItem = e.target.closest('.sequence-item');
            if (!targetItem || draggedName === targetItem.dataset.name) return;
            const items = Array.from(sequenceList.querySelectorAll('.sequence-item'));
            const draggedItem = sequenceList.querySelector(`.sequence-item[data-name="${draggedName}"]`);
            const targetIndex = items.indexOf(targetItem);
            const draggedIndex = items.indexOf(draggedItem);
            if (draggedIndex < targetIndex) {
                targetItem.after(draggedItem);
            } else {
                targetItem.before(draggedItem);
            }
            const newOrder = Array.from(sequenceList.querySelectorAll('.sequence-item')).map(item => item.dataset.name);
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

    if (!doDriverId.value || !doId.value || !controlType.value || !doResponseMsg.value) {
        showStatus('All required fields must be filled', 'error', 3000);
        return;
    }

    const body = {
        type: 'DO',
        name: `${doName.value}[DO]`,
        driverId: doDriverId.value,
        doId: doId.value,
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
    if (!doDriverId.value || !doId.value || !controlType.value || !doResponseMsg.value) {
        showStatus('All required fields must be filled', 'error', 3000);
        return;
    }
    const body = {
        oldName: editingControlName,
        type: 'DO',
        name: doName.value,
        driverId: doDriverId.value,
        doId: doId.value,
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
    if (type === 'DO') {
        fetch(`${API_BASE}/getControl/${name}`)
            .then(res => res.json())
            .then(data => {
                doName.value = data.name;
                doDriverId.value = data.driverId;
                updateDoIdOptions(data.driverId);
                doId.value = data.doId;
                controlType.value = data.controlType;
                pushWait.value = data.pushWait;
                doResponseMsg.value = data.responseMsg;
                togglePushWait();
                updateDOBtn.disabled = false;
                updateDIBtn.disabled = true;
                showStatus(`Editing ${name} (DO)`, 'success', 2000);
            })
            .catch(err => showStatus(`Failed to load control: ${err.message}`, 'error', 3000));
    } else {
        fetch(`${API_BASE}/getControl/${name}`)
            .then(res => res.json())
            .then(data => {
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
            })
            .catch(err => showStatus(`Failed to load control: ${err.message}`, 'error', 3000));
    }
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

// ========== ACTION.JS FUNCTIONS ==========
const undoBtn = document.getElementById('undoBtn');
const sortDiFirstBtn = document.getElementById('sortDiFirst');
const sortDoFirstBtn = document.getElementById('sortDoFirst');

async function makeRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}/${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
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
        const data = await makeRequest('undo', { method: 'POST' });
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
        const data = await makeRequest(`reorderSequences?sortOrder=${sortOrder}`, { method: 'POST' });
        showStatus(`Sorted ${sortOrder === 'diFirst' ? 'DI' : 'DO'} first successfully`, 'success', 1000);
        setTimeout(reloadSequences, 200);
        setTimeout(checkUndo, 300);
    } catch (error) {
        console.error(`Failed to sort ${sortOrder}:`, error);
        showStatus(`Failed to sort ${sortOrder === 'diFirst' ? 'DI' : 'DO'} first`, 'error', 3000);
    }
}

// ========== INITIALIZATION ==========
async function init() {
    await loadSequences();
    togglePushWait();
    toggleWaitTime();
    updateDoIdOptions(doDriverId.value);
    buildDIIndicatorTable();
    doDriverId.addEventListener('change', () => updateDoIdOptions(doDriverId.value));

    checkUndo();

    if (sortDiFirstBtn) {
        sortDiFirstBtn.addEventListener('click', () => sortSequences('diFirst'));
    }
    if (sortDoFirstBtn) {
        sortDoFirstBtn.addEventListener('click', () => sortSequences('doFirst'));
    }
    if (undoBtn) {
        undoBtn.addEventListener('click', performUndo);
    }

    playBootAnimation(() => {
        // subscribeToDITopic();
        // subscribeToDOTopics();
    });
}

function buildDIIndicatorTable() {
    console.log("Table is trggered")
    const tbody = document.getElementById('di_indicator_table_body');
    tbody.innerHTML = '';

    for (let diIndex = 0; diIndex < 8; diIndex++) {
        const tr = document.createElement('tr');

        const tdLabel = document.createElement('td');
        tdLabel.innerHTML = `<b>DI${diIndex + 1}</b>`;
        tr.appendChild(tdLabel);

        for (let drvIndex = 1; drvIndex <= 6; drvIndex++) {
            const td = document.createElement('td');
            const span = document.createElement('span');
            span.className = 'di-indicator-light';
            span.id = `di_indicator_${drvIndex}_${diIndex}`;
            td.appendChild(span);
            tr.appendChild(td);

            // ✅ Reference the span directly — no querySelector on detached nodes
            allDiIndicators.push(span);
        }

        tbody.appendChild(tr);
    }
}

init();