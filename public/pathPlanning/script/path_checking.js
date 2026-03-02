// Check path status and update indicators
async function checkPathStatus() {
    try {
        const res = await fetch(`${API_BASE}/getPathNames`);
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${await res.text()}`);
        const pathNames = await res.json();
        console.log(`Path names from /getPathNames: ${pathNames}`);
        const sequences = await (await fetch(`${API_BASE}/getTreeData`)).json();
        console.log(`Sequences from /getTreeData: ${JSON.stringify(sequences.map(s => s.name))}`);

        // Find extra path names not in sequences
        const sequenceNames = sequences.map(s => s.name.startsWith('plan_') ? s.name.slice(5) : s.name);
        const extraPathNames = pathNames.filter(name => !sequenceNames.includes(name));
        if (extraPathNames.length > 0) {
            console.log(`Extra path names in paths.yaml not in tree.xml: ${extraPathNames}`);
            showStatus('Extra Paths Found: check logs for names', 'process', 5000);

            const msg = new ROSLIB.Message({
                data: extraPathNames.join(" | ")
            });
            logsPublisher.publish(msg);
        } else {
            console.log('No extra path names found in paths.yaml');
            showStatus('No Extra Path Found...', 'success', 1000);
        }

        sequenceList.querySelectorAll('.sequence-item').forEach(item => {
            const seqName = item.dataset.name.startsWith('plan_') ? item.dataset.name.slice(5) : item.dataset.name;
            const indexSpan = item.querySelector('.sequence-index');
            if (pathNames.includes(seqName)) {
                indexSpan.classList.add('status-green');
                indexSpan.classList.remove('status-red');
            } else {
                indexSpan.classList.add('status-red');
                indexSpan.classList.remove('status-green');
            }
        });
        showStatus('Path status updated', 'success', 1500);

    } catch (err) {
        showStatus(`Failed to check path status: ${err.message}`, 'error', 2000);
        console.error('Error in checkPathStatus:', err);
    }
}

// Expose checkPathStatus to global scope for button onclick
window.checkPathStatus = checkPathStatus;


async function updateOriginPointFileName() {
    try {
        const res = await fetch(`${API_BASE}/getOriginPointFileName`);
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${await res.text()}`);
        const data = await res.json();
        console.log(`Origin point file name: ${data.originPointFileName}`);
        const originElement = document.getElementById('origin-point-file-name');
        if (originElement) {
            originElement.textContent = data.originPointFileName || 'No origin file name';
        } else {
            console.error('Origin point file name element not found');
        }
    } catch (err) {
        showStatus(`Failed to update origin point file name: ${err.message}`, 'error', 2000);
        console.error('Error in updateOriginPointFileName:', err);
    }
}

async function updatePointFileName() {
    try {
        const res = await fetch(`${API_BASE}/getPointFileName`);
        if (!res.ok) throw new Error(`Server returned ${res.status}: ${await res.text()}`);
        const data = await res.json();
        console.log(`Point file name: ${data.pointFileName}`);
        const pointElement = document.getElementById('point-file-name');
        if (pointElement) {
            pointElement.textContent = data.pointFileName || 'No point file name';
        } else {
            console.error('Point file name element not found');
        }
    } catch (err) {
        showStatus(`Failed to update point file name: ${err.message}`, 'error', 2000);
        console.error('Error in updatePointFileName:', err);
    }
}


setTimeout(() => {
    updatePointFileName()
    setTimeout(updateOriginPointFileName, 400);
    setTimeout(checkPathStatus, 800);

}, 500);

window.updateOriginPointFileName = updateOriginPointFileName;