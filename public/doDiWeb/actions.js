const undoBtn = document.getElementById('undoBtn');
const sortDiFirstBtn = document.getElementById('sortDiFirst');
const sortDoFirstBtn = document.getElementById('sortDoFirst');

window.onload = () => {
    checkUndo();
    // Attach event listeners for sorting buttons
    sortDiFirstBtn.addEventListener('click', () => sortSequences('diFirst'));
    sortDoFirstBtn.addEventListener('click', () => sortSequences('doFirst'));
};

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