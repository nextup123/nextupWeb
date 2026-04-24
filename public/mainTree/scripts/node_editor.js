async function deleteNode() {
    if (!selectedNode || !currentSubtreeId || selectedNode.data.type === 'BehaviorTree') {
        showToast('Select a valid node to delete!', 'warn');
        return;
    }
    if (!(await showConfirm('Delete this node?'))) return;


    try {
        // 🔹 send UID-based path to backend
        const res = await fetch(`${API_BASE}/deleteNode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subtreeId: currentSubtreeId,
                nodePath: selectedNode.data.path.slice(1), // UID path (excluding subtree root)
            }),
        });

        if (!res.ok) throw new Error(await res.text());
        showToast('Node deleted!');
        selectedNode = null;
        ['add-node-btn', 'delete-node-btn', 'delete-wrapper-btn', 'add-wrapper-btn']
            .forEach(id => (document.getElementById(id).disabled = true));
        document.getElementById('edit-section').style.display = 'none';
        loadSubtree(currentSubtreeId);
    } catch (err) {
        console.error('Error deleting node:', err);
        showToast(`Failed: ${err.message}`, 'failure');
    }
}

async function addNode() {
    if (!selectedNode || !currentSubtreeId) {
        showToast('Select a parent node first!', 'warn');
        return;
    }
    
    console.log(`=== addNode() called ===`);
    console.log(`Selected node type: ${selectedNode.data.type}`);
    console.log(`Selected node data:`, selectedNode.data);
    
    // Dynamically check if the selected node can be a parent
    const canBeParent = checkIsWrapper(selectedNode.data.type);
    
    console.log(`checkIsWrapper("${selectedNode.data.type}") = ${canBeParent}`);
    console.log(`Node definitions available:`, nodeDefinitions);
    
    if (!canBeParent) {
        showToast('Can only add under wrapper nodes!', 'warn');
        return;
    }

    const name = document.getElementById('new-node-name').value.trim();
    const type = document.getElementById('node-type').value;
    if (!name || !type) {
        showToast('Name and type required!', 'warn');
        return;
    }

    console.log(`Adding node type: ${type}, name: ${name}`);
    
    const attributes = {};
    document.querySelectorAll('#node-attributes input[data-attr]').forEach(inp => {
        const v = inp.value.trim();
        if (v) attributes[inp.dataset.attr] = v;
    });

    try {
        const res = await fetch(`${API_BASE}/addNode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subtreeId: currentSubtreeId,
                parentPath: selectedNode.data.path.slice(1), // 🔹 use _uid path
                nodeType: type,
                nodeName: name,
                attributes
            })
        });
        
        const responseText = await res.text();
        console.log(`Backend response status: ${res.status}`);
        console.log(`Backend response:`, responseText);
        
        if (!res.ok) throw new Error(responseText);

        // reset UI
        document.getElementById('new-node-name').value = '';
        document.getElementById('node-category').value = '';
        document.getElementById('node-type').innerHTML = '<option value="">Select Node Type</option>';
        document.getElementById('node-attributes').innerHTML = '';

        showToast('Node added!', 'warn');
        loadSubtree(currentSubtreeId);
    } catch (err) {
        console.error(err);
        showToast(`Failed: ${err.message}`, 'failure');
    }
}
async function deleteWrapperOnly() {
    if (!selectedNode || !currentSubtreeId) {
        showToast('Select a wrapper node!', 'warn');
        return;
    }
    const wrapperTypes = ['Sequence', 'Fallback', 'Selector'];
    if (
        !wrapperTypes.includes(selectedNode.data.type) ||
        !selectedNode.parent ||
        !wrapperTypes.concat(['BehaviorTree']).includes(selectedNode.parent.data.type)
    ) {
        showToast('Select a wrapper node with a wrapper parent!', 'warn');
        return;
    }
    if (!(await showConfirm('Delete wrapper only (children move to parent)?'))) return;


    try {
        const res = await fetch(`${API_BASE}/deleteWrapperOnly`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subtreeId: currentSubtreeId,
                nodePath: selectedNode.data.path.slice(1) // 🔹 use _uid path
            })
        });
        if (!res.ok) throw new Error(await res.text());
        showToast('Wrapper deleted, children moved!');
        selectedNode = null;
        ['add-node-btn', 'delete-node-btn', 'delete-wrapper-btn', 'add-wrapper-btn']
            .forEach(id => document.getElementById(id).disabled = true);
        document.getElementById('edit-section').style.display = 'none';
        loadSubtree(currentSubtreeId);
    } catch (err) {
        console.error('Error deleting wrapper:', err);
        showToast(`Failed: ${err.message}`, 'failure');
    }
}

async function copyNode() {
    if (!selectedNode || !currentSubtreeId) {
        showToast('Select a node to copy!', 'warn');
        return;
    }
    if (selectedNode.data.type === 'BehaviorTree') {
        showToast('Cannot copy the root BehaviorTree node!', 'warn');
        return;
    }
 
    try {
        const res = await fetch(`${API_BASE}/copyNode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subtreeId: currentSubtreeId,
                nodePath: selectedNode.data.path.slice(1), // UID path, exclude subtree root
            }),
        });
 
        if (!res.ok) throw new Error(await res.text());
        showToast('Node copied!', 'success');
        loadSubtree(currentSubtreeId);
    } catch (err) {
        console.error('Error copying node:', err);
        showToast(`Failed to copy: ${err.message}`, 'failure');
    }
}

async function addWrapper() {
    if (!selectedNode || !currentSubtreeId) {
        showToast('Select a wrapper node!', 'warn');
        return;
    }
    const wrapperTypes = ['Sequence', 'Fallback', 'Selector'];
    if (
        !wrapperTypes.includes(selectedNode.data.type) ||
        !selectedNode.parent ||
        !wrapperTypes.concat(['BehaviorTree']).includes(selectedNode.parent.data.type)
    ) {
        showToast('Select a wrapper node with a wrapper parent!', 'warn');
        return;
    }

    const wrapperType = document.getElementById('new-wrapper-type').value;
    if (!wrapperType) {
        showToast('Select a wrapper type!', 'warn');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/addWrapper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subtreeId: currentSubtreeId,
                nodePath: selectedNode.data.path.slice(1), // 🔹 use _uid path
                wrapperType
            })
        });
        if (!res.ok) throw new Error(await res.text());
        showToast('Wrapper added!');
        loadSubtree(currentSubtreeId);
    } catch (err) {
        console.error('Error adding wrapper:', err);
        showToast(`Failed: ${err.message}`, 'failure');
    }
}