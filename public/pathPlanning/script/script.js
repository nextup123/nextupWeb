
const API_BASE = 'http://localhost:3000/path-planning';

let pointData = [];
let editingPathName = null;
let oldPathName = null;
let intermediatePoints = [];
let xmlContent = '';

// DOM elements
const startPoint = document.getElementById('startPoint');
const goalPoint = document.getElementById('goalPoint');
const planSpace = document.getElementById('planSpace');
const pathName = document.getElementById('pathName');
const intermediateDisplay = document.getElementById('intermediateDisplay');
const updateBtn = document.getElementById('updateBtn');
const sequenceList = document.getElementById('sequenceList');
const xmlOutput = document.getElementById('xmlOutput');
const pointSelect = document.getElementById('pointSelect');
const selectedPoints = document.getElementById('selectedPoints');
const intermediateModal = document.getElementById('intermediateModal');
const xmlModal = document.getElementById('xmlModal');
const statusModal = document.getElementById('statusModal');
const sequenceCount = document.getElementById('sequenceCount');

// Updated showStatus function with toast notifications
function showStatus(message, type = "success", timeout = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Set icon based on type
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

    // Add toast to container
    toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    }, 10);

    // Auto remove after timeout
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

// Close status modal
function closeStatusModal() {
    statusModal.style.display = 'none';
}

// Open XML modal
function openXMLModal() {
    reloadXML();
    xmlOutput.textContent = xmlContent || 'No XML available';
    xmlModal.style.display = 'flex';
}

// Close XML modal
function closeXMLModal() {
    xmlModal.style.display = 'none';
}

let currentFontSize = 11; // default size

function changeFontSize(delta) {
    currentFontSize += delta;
    if (currentFontSize < 7) currentFontSize = 7; // minimum
    if (currentFontSize > 24) currentFontSize = 24; // maximum
    document.getElementById("xmlOutput").style.fontSize = currentFontSize + "px";
}


// Copy XML to clipboard
function copyXML() {
    navigator.clipboard.writeText(xmlOutput.textContent)
        .then(() => showStatus('XML copied to clipboard', 'success', 2000))
        .catch(() => showStatus('Failed to copy XML', 'error', 3000));
}

// Load points from server
async function loadPoints() {
    try {
        const res = await fetch(`${API_BASE}/getPointNames`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        pointData = await res.json();
        populateDropdowns();
        updateIntermediateModal();
        showStatus(`Reloaded ${pointData.length} points`, 'success', 1500);
    } catch (err) {
        showStatus(`Failed to reload points: ${err.message}`, 'error', 2000);
        console.error(err);
    }
}

// Populate start and goal dropdowns
function populateDropdowns() {
    const startValue = startPoint.value;
    const goalValue = goalPoint.value;

    startPoint.innerHTML = '<option value="">Select point</option>';
    goalPoint.innerHTML = '<option value="">Select point</option>';

    pointData.forEach(p => {
        if (p !== goalValue) startPoint.add(new Option(p, p));
        if (p !== startValue) goalPoint.add(new Option(p, p));
    });

    startPoint.value = startValue;
    goalPoint.value = goalValue;

    startPoint.addEventListener('change', () => {
        const newGoalOptions = pointData.filter(p => p !== startPoint.value);
        const currentGoal = goalPoint.value;
        goalPoint.innerHTML = '<option value="">Select point</option>';
        newGoalOptions.forEach(p => goalPoint.add(new Option(p, p)));
        goalPoint.value = currentGoal && newGoalOptions.includes(currentGoal) ? currentGoal : '';
        updatePathName();
        updateIntermediateModal();
    });

    goalPoint.addEventListener('change', () => {
        const newStartOptions = pointData.filter(p => p !== goalPoint.value);
        const currentStart = startPoint.value;
        startPoint.innerHTML = '<option value="">Select point</option>';
        newStartOptions.forEach(p => startPoint.add(new Option(p, p)));
        startPoint.value = currentStart && newStartOptions.includes(currentStart) ? currentStart : '';
        updatePathName();
        updateIntermediateModal();
    });
}

// Update path name dynamically
function updatePathName() {
    const points = [startPoint.value, ...intermediatePoints, goalPoint.value].filter(Boolean);
    pathName.value = points.length >= 2 ? points.join('_') : '';
    intermediateDisplay.textContent = intermediatePoints.length > 0 ? `Selected: ${intermediatePoints.join(' → ')}` : 'No points selected';
}

// Open intermediate points modal
function openIntermediateModal() {
    if (!startPoint.value || !goalPoint.value) {
        showStatus('Select start and goal points first', 'error', 3000);
        return;
    }
    updateIntermediateModal();
    intermediateModal.style.display = 'flex';
}

// Close intermediate points modal
function closeIntermediateModal() {
    intermediateModal.style.display = 'none';
}

// Update modal with available points
function updateIntermediateModal() {
    const availablePoints = pointData.filter(p => p !== startPoint.value && p !== goalPoint.value && !intermediatePoints.includes(p));
    pointSelect.innerHTML = '<option value="">Select point</option>';
    availablePoints.forEach(p => pointSelect.add(new Option(p, p)));

    selectedPoints.innerHTML = '';
    if (intermediatePoints.length === 0) {
        selectedPoints.innerHTML = '<div class="empty-state"><i class="fas fa-dot-circle"></i><p>No points selected</p></div>';
    } else {
        intermediatePoints.forEach((point, index) => {
            const div = document.createElement('div');
            div.className = 'point-item';
            div.draggable = true;
            div.dataset.point = point;
            div.innerHTML = `
            <span>${point}</span>
            <div class="point-actions">
              <button class="btn-icon btn-delete" onclick="removeIntermediatePoint(${index})">
                <i class="fas fa-times"></i>
              </button>
            </div>
          `;
            selectedPoints.appendChild(div);
        });
    }

    initPointDragAndDrop();
}

// Add intermediate point
function addIntermediatePoint() {
    const selectedPoint = pointSelect.value;
    if (!selectedPoint) {
        showStatus('Select a point to add', 'error', 3000);
        return;
    }
    intermediatePoints.push(selectedPoint);
    updatePathName();
    updateIntermediateModal();
}

// Remove intermediate point
function removeIntermediatePoint(index) {
    intermediatePoints.splice(index, 1);
    updatePathName();
    updateIntermediateModal();
}

// Initialize drag-and-drop for intermediate points
function initPointDragAndDrop() {
    const items = selectedPoints.querySelectorAll('.point-item');
    items.forEach(item => {
        item.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', item.dataset.point);
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
        item.addEventListener('dragover', e => e.preventDefault());
        item.addEventListener('drop', e => {
            e.preventDefault();
            const draggedPoint = e.dataTransfer.getData('text/plain');
            const targetItem = e.target.closest('.point-item');
            if (!targetItem || draggedPoint === targetItem.dataset.point) return;

            const items = Array.from(selectedPoints.querySelectorAll('.point-item'));
            const draggedItem = selectedPoints.querySelector(`.point-item[data-point="${draggedPoint}"]`);
            const targetIndex = items.indexOf(targetItem);
            const draggedIndex = items.indexOf(draggedItem);

            intermediatePoints.splice(draggedIndex, 1);
            intermediatePoints.splice(targetIndex, 0, draggedPoint);
            updatePathName();
            updateIntermediateModal();
        });
    });
}

// Save intermediate points
function saveIntermediatePoints() {
    updatePathName();
    closeIntermediateModal();
}

// Load sequences from server
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
              <p>No paths added yet</p>
              <small>Start by creating a path using the editor</small>
            </div>
          `;
            return;
        }

        sequences.forEach((seq, index) => {
            const div = document.createElement('div');
            div.className = 'sequence-item';
            div.draggable = true;
            div.dataset.name = seq.name;

            // Parse intermediate points if they exist
            const intermediatePoints = seq.intermediateGoal ? seq.intermediateGoal.split(',') : [];

            // Create path visualization
            let pathVisualization = `
            <div class="path-visualization">
              <span class="path-point path-start">${seq.startPoint}</span>
          `;

            // Add intermediate points if they exist
            if (intermediatePoints.length > 0) {
                pathVisualization += `<span class="path-arrow">→</span>`;
                intermediatePoints.forEach((point, index) => {
                    pathVisualization += `
                <span class="path-point path-intermediate">${point}</span>
                ${index < intermediatePoints.length - 1 ? '<span class="path-arrow">→</span>' : ''}
              `;
                });
            }

            // Add goal point
            pathVisualization += `
            <span class="path-arrow">→</span>
            <span class="path-point path-goal">${seq.goalPoint}</span>
          </div>
          `;

            // Create details section
            const details = `
            <div class="sequence-details">
              <span class="badge badge-primary">${seq.name}</span>
              <span class="badge badge-secondary">${seq.planSpace}</span>
            </div>
          `;

            div.innerHTML = `
                <div class="sequence-index-container">
                    <span class="drag-handle"></span>
                    <span class="sequence-index status-red">${index + 1}</span>
                </div>
                <div class="sequence-content">
                    ${details}
                    ${pathVisualization}
                </div>
                <div class="sequence-actions">
                    <button class="btn-icon btn-edit" onclick="editPath('${seq.name}', '${seq.startPoint}', '${seq.goalPoint}', '${seq.planSpace}', '${seq.intermediateGoal}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deletePath('${seq.name}')">
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
// Initialize drag-and-drop for sequences
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

// Reorder sequences
async function reorderSequences(sequenceNames) {
    await callAPI('reorderSequences', { sequenceNames }, loadSequences);
}

// Add a new path
async function addPath() {
    if (!startPoint.value || !goalPoint.value || !planSpace.value || !pathName.value) {
        showStatus('All required fields must be filled', 'error', 3000);
        return;
    }
    const body = {
        startPoint: startPoint.value,
        goalPoint: goalPoint.value,
        planSpace: planSpace.value,
        pathName: pathName.value,
        intermediateGoal: intermediatePoints.join(',')
    };
    await callAPI('addPlanPath', body, () => {
        clearForm();
        loadSequences();
    });
}

// Update an existing path
async function updatePath() {
    if (!editingPathName || !startPoint.value || !goalPoint.value || !planSpace.value || !pathName.value) {
        showStatus('All required fields must be filled', 'error', 3000);
        return;
    }
    const body = {
        oldPathName: oldPathName,
        newPathName: pathName.value,
        startPoint: startPoint.value,
        goalPoint: goalPoint.value,
        planSpace: planSpace.value,
        intermediateGoal: intermediatePoints.join(',')
    };
    await callAPI('updatePlanPath', body, () => {
        clearForm();
        loadSequences();
    });
}

// Edit a path (populate form)
function editPath(name, start, goal, space, intermediate) {
    editingPathName = name;
    oldPathName = name;
    startPoint.value = start;
    goalPoint.value = goal;
    planSpace.value = space;
    intermediatePoints = intermediate ? intermediate.split(',') : [];
    updatePathName();
    updateBtn.disabled = false;
    showStatus(`Editing ${name}`, 'success', 2000);
}

// Delete a path
async function deletePath(pathName) {
    if (confirm(`Delete ${pathName}?`)) {
        await callAPI('deletePath', { pathName }, loadSequences);
    }
}

// Delete last sequence
async function deleteLast() {
    if (confirm('Delete the last sequence?')) {
        await callAPI('deleteLast', {}, loadSequences);
    }
}

// Delete all sequences
async function deleteAll() {
    if (confirm('Delete all sequences?')) {
        await callAPI('deleteAll', {}, loadSequences);
    }
}

// Reload XML from server
async function reloadXML() {
    await callAPI('getXML', {}, () => {
        xmlOutput.textContent = xmlContent || 'No XML available';
    });
}
// API call function
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

// Clear form and reset state
function clearForm() {
    startPoint.value = '';
    goalPoint.value = '';
    planSpace.value = 'cartesian';
    pathName.value = '';
    intermediatePoints = [];
    editingPathName = null;
    oldPathName = null;
    updateBtn.disabled = true;
    populateDropdowns();
    updatePathName();
}

// Reload paths
async function reloadPaths() {
    await loadSequences();
    setTimeout(updateOriginPointFileName, 400);
}



// Reload points
async function reloadPoints() {
    await loadPoints();
    setTimeout(updatePointFileName, 400);

}

// Initialize
async function init() {
    await loadPoints();
    await loadSequences();
}
init();