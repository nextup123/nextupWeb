const undoBtn = document.getElementById('undoBtn');


// Check if undo is available on page load
window.onload = checkUndo;

async function makeRequest(endpoint, options = {}) {

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
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
        showStatus(`Error: ${error.message}`, false);
        throw error;
    }
}

// Check if undo is available
async function checkUndo() {
    try {
        undoBtn.disabled = true;

        const data = await makeRequest('/canUndo');

        undoBtn.disabled = !data.canUndo;


    } catch (error) {
        undoBtn.disabled = true;
        console.error('Failed to check undo:', error);
    }
}

// Perform undo action
async function performUndo() {
    try {
        undoBtn.disabled = true;

        const data = await makeRequest('/undo', {
            method: 'POST'
        });

        showStatus('Undo Done...', 'success', 1000);

        // Check if undo is still available
        setTimeout(checkUndo, 800);
        setTimeout(reloadPaths, 1000);
    } catch (error) {
        console.error('Failed to undo:', error);

        // Re-check undo availability
        checkUndo();
    }
}


