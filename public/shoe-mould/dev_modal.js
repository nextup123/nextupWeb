// Developer Modal - Mapped Data Editor
const devState = {
    mappedData: {},
    selectedKey: null,
    isNewEntry: false
};

// Initialize developer modal
function initDevModal() {
    setupEventListeners();
    setupKeyboardShortcut();
}

// Keyboard shortcut: Ctrl+Shift+D or Cmd+Shift+D
function setupKeyboardShortcut() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            openDevModal();
        }
    });
    
    // Show hint on first load
    setTimeout(() => {
        showShortcutHint();
    }, 2000);
}

function showShortcutHint() {
    const hint = document.createElement('div');
    hint.className = 'dev-shortcut-hint';
    hint.textContent = 'Press Ctrl+Shift+D for Developer Tools';
    document.body.appendChild(hint);
    
    setTimeout(() => hint.classList.add('show'), 100);
    setTimeout(() => {
        hint.classList.remove('show');
        setTimeout(() => hint.remove(), 300);
    }, 4000);
}

function setupEventListeners() {
    // Open/close
    document.getElementById('btnCloseDev').addEventListener('click', closeDevModal);
    document.getElementById('devModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('devModal')) closeDevModal();
    });
    
    // List actions
    document.getElementById('btnAddEntry').addEventListener('click', startNewEntry);
    document.getElementById('devSearch').addEventListener('input', filterList);
    
    // Editor actions
    document.getElementById('btnDevSave').addEventListener('click', saveEntry);
    document.getElementById('btnDevDelete').addEventListener('click', deleteEntry);
    document.getElementById('btnDevReset').addEventListener('click', resetForm);
    
    // Raw YAML viewer
    document.getElementById('btnViewRaw').addEventListener('click', showRawYAML);
    document.getElementById('btnCloseRaw').addEventListener('click', hideRawYAML);
}

async function openDevModal() {
    document.getElementById('devModal').classList.add('show');
    await loadMappedData();
    renderList();
}

function closeDevModal() {
    document.getElementById('devModal').classList.remove('show');
    hideRawYAML();
    resetForm();
}

async function loadMappedData() {
    try {
        const response = await fetch('/shoe-mould/mapped-data');
        if (response.ok) {
            const data = await response.json();
            devState.mappedData = data.mapped_data || {};
        }
    } catch (error) {
        console.error('Failed to load mapped data:', error);
        showToast('Failed to load mapped data', true);
    }
}

function renderList(filter = '') {
    const list = document.getElementById('devList');
    list.innerHTML = '';
    
    const entries = Object.entries(devState.mappedData)
        .filter(([key]) => key.toLowerCase().includes(filter.toLowerCase()))
        .sort(([a], [b]) => a.localeCompare(b));
    
    entries.forEach(([key, data]) => {
        const item = document.createElement('div');
        item.className = 'dev-list-item';
        item.dataset.key = key;
        
        if (key === devState.selectedKey) {
            item.classList.add('selected');
        }
        
        item.innerHTML = `
            <span class="dev-list-item-key">${key}</span>
            <span class="dev-list-item-type ${data.shoe_foot_type}">${data.shoe_foot_type}</span>
        `;
        
        item.addEventListener('click', () => selectEntry(key));
        list.appendChild(item);
    });
    
    if (entries.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No entries found</div>';
    }
}

function filterList(e) {
    renderList(e.target.value);
}

function selectEntry(key) {
    devState.selectedKey = key;
    devState.isNewEntry = false;
    
    // Update list selection
    document.querySelectorAll('.dev-list-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.key === key);
    });
    
    // Show editor
    document.getElementById('devEmptyState').style.display = 'none';
    document.getElementById('devEditor').classList.add('show');
    
    // Populate form - key is NOT editable for existing entries
    const data = devState.mappedData[key];
    document.getElementById('devSelectedKey').textContent = key;
    document.getElementById('devKeyName').value = key;
    document.getElementById('devKeyName').disabled = true; // Cannot edit existing key
    document.getElementById('devKeyName').style.background = '#f3f4f6';
    
    document.getElementById('devShoeType').value = data.shoe_foot_type || '';
    document.getElementById('devYPos').value = data.y_cm ?? '';
    document.getElementById('devXOffset').value = data.x_offset_cm ?? 0;
    document.getElementById('devRoll').value = data.roll_deg ?? -150;
    document.getElementById('devPitch').value = data.pitch_deg ?? 0;
    document.getElementById('devYaw').value = data.yaw_deg ?? 180;
}

function startNewEntry() {
    devState.selectedKey = null;
    devState.isNewEntry = true;
    
    // Clear list selection
    document.querySelectorAll('.dev-list-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Show editor
    document.getElementById('devEmptyState').style.display = 'none';
    document.getElementById('devEditor').classList.add('show');
    
    // Reset form - key IS editable for new entries
    document.getElementById('devSelectedKey').textContent = 'New Entry';
    document.getElementById('devKeyName').value = '';
    document.getElementById('devKeyName').disabled = false; // Can edit when creating
    document.getElementById('devKeyName').style.background = 'white';
    document.getElementById('devKeyName').placeholder = 'e.g., left_custom_01';
    document.getElementById('devKeyName').focus();
    
    document.getElementById('devShoeType').value = '';
    document.getElementById('devYPos').value = '';
    document.getElementById('devXOffset').value = 0;
    document.getElementById('devRoll').value = -150;
    document.getElementById('devPitch').value = 0;
    document.getElementById('devYaw').value = 180;
}

function resetForm() {
    if (devState.isNewEntry) {
        startNewEntry();
    } else if (devState.selectedKey) {
        selectEntry(devState.selectedKey);
    } else {
        document.getElementById('devEditor').classList.remove('show');
        document.getElementById('devEmptyState').style.display = 'flex';
    }
}

async function saveEntry() {
    const keyInput = document.getElementById('devKeyName');
    let key;
    
    if (devState.isNewEntry) {
        // For new entries, get key from input
        key = keyInput.value.trim();
        if (!key) {
            showToast('Please enter a key name', true);
            keyInput.focus();
            return;
        }
        
        // Validate key format (alphanumeric, underscore, hyphen only)
        if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
            showToast('Key can only contain letters, numbers, underscores, and hyphens', true);
            keyInput.focus();
            return;
        }
        
        // Check if key already exists
        if (devState.mappedData[key]) {
            showToast(`Key "${key}" already exists. Please choose a different name.`, true);
            keyInput.focus();
            return;
        }
    } else {
        // For existing entries, use the selected key
        key = devState.selectedKey;
    }
    
    const shoeType = document.getElementById('devShoeType').value;
    const yPos = parseFloat(document.getElementById('devYPos').value);
    
    if (!shoeType) {
        showToast('Please select a shoe foot type', true);
        return;
    }
    
    if (isNaN(yPos)) {
        showToast('Please enter a valid Y position', true);
        return;
    }
    
    const entry = {
        shoe_foot_type: shoeType,
        y_cm: yPos,
        x_offset_cm: parseFloat(document.getElementById('devXOffset').value) || 0,
        roll_deg: parseFloat(document.getElementById('devRoll').value) || -150,
        pitch_deg: parseFloat(document.getElementById('devPitch').value) || 0,
        yaw_deg: parseFloat(document.getElementById('devYaw').value) || 180
    };
    
    try {
        const response = await fetch(`/shoe-mould/mapped-data/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });
        
        if (response.ok) {
            devState.mappedData[key] = entry;
            
            if (devState.isNewEntry) {
                // For new entries, switch to edit mode
                devState.selectedKey = key;
                devState.isNewEntry = false;
                renderList(document.getElementById('devSearch').value);
                selectEntry(key);
                showToast('New entry created successfully', false);
            } else {
                // For existing entries, just refresh
                renderList(document.getElementById('devSearch').value);
                selectEntry(key);
                showToast('Entry updated successfully', false);
            }
        } else {
            const error = await response.json();
            showToast(error.error || 'Failed to save', true);
        }
    } catch (error) {
        console.error('Save failed:', error);
        showToast('Failed to save entry', true);
    }
}

async function deleteEntry() {
    const key = devState.selectedKey;
    if (!key) return;
    
    if (!confirm(`Are you sure you want to delete "${key}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/shoe-mould/mapped-data/${key}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            delete devState.mappedData[key];
            devState.selectedKey = null;
            renderList(document.getElementById('devSearch').value);
            document.getElementById('devEditor').classList.remove('show');
            document.getElementById('devEmptyState').style.display = 'flex';
            showToast('Entry deleted', false);
        } else {
            showToast('Failed to delete entry', true);
        }
    } catch (error) {
        console.error('Delete failed:', error);
        showToast('Failed to delete entry', true);
    }
}

async function showRawYAML() {
    try {
        const response = await fetch('/shoe-mould/mapped-data/raw');
        if (response.ok) {
            const content = await response.text();
            document.getElementById('devRawContent').textContent = content;
            document.getElementById('devRawViewer').classList.add('show');
        }
    } catch (error) {
        showToast('Failed to load raw YAML', true);
    }
}

function hideRawYAML() {
    document.getElementById('devRawViewer').classList.remove('show');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initDevModal);