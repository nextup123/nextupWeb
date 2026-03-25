const seqCreator = (function () {
    const data = {
        points: [],
        paths: [],
        pointsMap: new Map(),
        pathsMap: new Map(),
        pathsByStartPoint: new Map(),
        currentSequence: {
            startPoint: null,
            steps: [],
            currentPosition: null,
            velocities: new Map()
        }
    };

    let editingStepIndex = null;

    const elements = {
        startPoint: document.getElementById('seq-creator-startPoint'),
        defaultVelocity: document.getElementById('seq-creator-defaultVelocity'),
        velocityValue: document.getElementById('seq-creator-velocityValue'),
        sequenceContent: document.getElementById('seq-creator-sequenceContent'),
        emptyState: document.getElementById('seq-creator-emptyState'),
        sequenceArea: document.getElementById('seq-creator-sequenceArea'),
        startPointName: document.getElementById('seq-creator-startPointName'),
        sequenceSteps: document.getElementById('seq-creator-sequenceSteps'),
        statusMessage: document.getElementById('seq-creator-statusMessage'),
        velocityModal: document.getElementById('seq-creator-velocityModal'),
        modalVelocity: document.getElementById('seq-creator-modalVelocity'),
        modalVelocityValue: document.getElementById('seq-creator-modalVelocityValue')
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        loadData();
        setupVelocitySliders();
    });

    function setupVelocitySliders() {
        // Default velocity slider
        elements.defaultVelocity.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            elements.velocityValue.textContent = value.toFixed(2);
        });

        // Modal velocity slider
        elements.modalVelocity.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            elements.modalVelocityValue.textContent = value.toFixed(2);
        });
    }

    async function loadData() {
        showStatus('Loading data...', 'info');
        try {
            const pointsResponse = await fetch('http://localhost:3003/pose/points');
            const pathsResponse = await fetch('http://localhost:3003/pose/paths');

            if (!pointsResponse.ok || !pathsResponse.ok) {
                throw new Error('Failed to load data');
            }

            const pointsData = await pointsResponse.json();
            const pathsData = await pathsResponse.json();

            processData(pointsData.points || [], pathsData.paths || []);
            updateStartPointDropdown();

            showStatus('Data loaded', 'success');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        }
    }

    function processData(points, paths) {
        data.points = points;
        data.pointsMap.clear();
        points.forEach(point => {
            data.pointsMap.set(point.name, point);
        });

        data.paths = paths;
        data.pathsMap.clear();
        data.pathsByStartPoint.clear();

        paths.forEach(path => {
            data.pathsMap.set(path.name, path);

            if (!data.pathsByStartPoint.has(path.start_point)) {
                data.pathsByStartPoint.set(path.start_point, []);
            }
            data.pathsByStartPoint.get(path.start_point).push(path);
        });
    }

    function updateStartPointDropdown() {
        elements.startPoint.innerHTML = '<option value="">Select starting point...</option>' +
            data.points.map(point =>
                `<option value="${point.name}">${point.name}</option>`
            ).join('');
    }

    function createNewSequence() {
        const startPoint = elements.startPoint.value;

        if (!startPoint) {
            showStatus('Please select a start point', 'error');
            return;
        }

        if (!data.pointsMap.has(startPoint)) {
            showStatus('Selected start point not found', 'error');
            return;
        }

        data.currentSequence = {
            startPoint: startPoint,
            steps: [],
            currentPosition: startPoint,
            velocities: new Map()
        };

        elements.emptyState.style.display = 'none';
        elements.sequenceArea.style.display = 'block';
        elements.startPointName.textContent = startPoint;

        clearAndRenderSteps();
        showStatus(`Started from ${startPoint}`, 'success');
    }

    function clearAndRenderSteps() {
        elements.sequenceSteps.innerHTML = '';
        data.currentSequence.steps.forEach((step, index) => {
            addStepToDOM(step, index, false);
        });
        updateCurrentPosition();
        showAvailablePaths();
    }

    function addStepToDOM(step, index, animate = false) {
        const stepElement = document.createElement('div');
        stepElement.className = `seq-creator-step-item ${animate ? 'seq-creator-new-step' : ''}`;

        const stepType = step.plan_space === 'Joint' ? 'J' : 'C';
        const stepTypeClass = step.plan_space === 'Joint' ? 'seq-creator-step-type-joint' : 'seq-creator-step-type-cartesian';
        const velocity = data.currentSequence.velocities.get(index) || parseFloat(elements.defaultVelocity.value);

        stepElement.innerHTML = `
                    <div class="seq-creator-step-number">${index + 1}</div>
                    <div class="seq-creator-step-info">
                        <div class="seq-creator-step-name">${step.name}</div>
                        <div class="seq-creator-step-type ${stepTypeClass}">${stepType}</div>
                        <div class="seq-creator-step-velocity" onclick="seqCreator.openVelocityModal(${index})" title="Click to change velocity">
                            ${velocity.toFixed(2)}
                        </div>
                    </div>
                    <div class="seq-creator-step-actions">
                        <div class="seq-creator-action-icon seq-creator-action-icon-remove" onclick="seqCreator.removeStep(${index})">×</div>
                    </div>
                `;

        elements.sequenceSteps.appendChild(stepElement);

        if (animate) {
            setTimeout(() => stepElement.classList.remove('seq-creator-new-step'), 500);
        }
    }

    function updateCurrentPosition() {
        // Remove existing current position
        const existingPosition = document.querySelector('.seq-creator-current-position');
        if (existingPosition) {
            existingPosition.remove();
        }

        // Create current position display
        const currentPositionHTML = `
                    <div class="seq-creator-current-position">
                        <div class="seq-creator-position-icon">📍</div>
                        <div class="seq-creator-position-info">
                            <h3>Current Position</h3>
                            <p>${data.currentSequence.currentPosition}</p>
                        </div>
                    </div>
                `;

        // Insert after sequence steps
        elements.sequenceSteps.insertAdjacentHTML('afterend', currentPositionHTML);
    }

    function addStep(pathName) {
        const path = data.pathsMap.get(pathName);

        if (!path) {
            showStatus('Path not found', 'error');
            return;
        }

        if (path.start_point !== data.currentSequence.currentPosition) {
            showStatus(`Cannot add ${pathName} - must start from ${data.currentSequence.currentPosition}`, 'error');
            return;
        }

        const index = data.currentSequence.steps.length;
        data.currentSequence.steps.push(path);
        data.currentSequence.currentPosition = path.end_point;
        data.currentSequence.velocities.set(index, parseFloat(elements.defaultVelocity.value));

        addStepToDOM(path, index, true);
        updateCurrentPosition();
        updateAvailablePaths();

        showStatus(`Added: ${pathName}`, 'success');
    }

    function showAvailablePaths() {
        const currentPos = data.currentSequence.currentPosition;
        const availablePaths = data.pathsByStartPoint.get(currentPos) || [];

        const existingSection = document.querySelector('.seq-creator-available-steps-section');
        if (existingSection) existingSection.remove();

        const existingOutput = document.querySelector('.seq-creator-output-section');
        if (existingOutput) existingOutput.remove();

        if (availablePaths.length === 0) {
            // Add output section if we have steps
            if (data.currentSequence.steps.length > 0) {
                addJSONOutputSection();
            }
            return;
        }

        const availableStepsHTML = `
                    <div class="seq-creator-available-steps-section">
                        <div class="seq-creator-available-steps-title">
                            Next Available Paths (${availablePaths.length})
                        </div>
                        <div class="seq-creator-available-steps-grid">
                            ${availablePaths.map(path => `
                                <div class="seq-creator-step-item seq-creator-available-step" onclick="seqCreator.addStep('${path.name}')">
                                    <div class="seq-creator-step-number">+</div>
                                    <div class="seq-creator-step-info">
                                        <div class="seq-creator-step-name">${path.name}</div>
                                        <div class="seq-creator-step-type ${path.plan_space === 'Joint' ? 'seq-creator-step-type-joint' : 'seq-creator-step-type-cartesian'}">
                                            ${path.plan_space === 'Joint' ? 'J' : 'C'}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;

        // Insert after current position
        const currentPositionElement = document.querySelector('.seq-creator-current-position');
        if (currentPositionElement) {
            currentPositionElement.insertAdjacentHTML('afterend', availableStepsHTML);
        } else {
            elements.sequenceSteps.insertAdjacentHTML('afterend', availableStepsHTML);
        }

        // Add JSON output section
        if (data.currentSequence.steps.length > 0) {
            addJSONOutputSection();
        }
    }

    function updateAvailablePaths() {
        showAvailablePaths();
    }

    function removeStep(index) {
        if (index < 0 || index >= data.currentSequence.steps.length) return;

        data.currentSequence.steps.splice(index, 1);
        data.currentSequence.velocities.delete(index);

        // Re-index velocities
        const newVelocities = new Map();
        data.currentSequence.steps.forEach((step, newIndex) => {
            const oldIndex = index <= newIndex ? newIndex + 1 : newIndex;
            newVelocities.set(newIndex, data.currentSequence.velocities.get(oldIndex) || parseFloat(elements.defaultVelocity.value));
        });
        data.currentSequence.velocities = newVelocities;

        // Recalculate position
        if (index === data.currentSequence.steps.length) {
            if (data.currentSequence.steps.length > 0) {
                const lastStep = data.currentSequence.steps[data.currentSequence.steps.length - 1];
                data.currentSequence.currentPosition = lastStep.end_point;
            } else {
                data.currentSequence.currentPosition = data.currentSequence.startPoint;
            }
        }

        clearAndRenderSteps();
        showStatus('Step removed', 'info');
    }

    function moveStepUp(index) {
        if (index <= 0) return;

        // Swap steps
        [data.currentSequence.steps[index], data.currentSequence.steps[index - 1]] =
            [data.currentSequence.steps[index - 1], data.currentSequence.steps[index]];

        // Swap velocities
        const vel1 = data.currentSequence.velocities.get(index) || parseFloat(elements.defaultVelocity.value);
        const vel2 = data.currentSequence.velocities.get(index - 1) || parseFloat(elements.defaultVelocity.value);
        data.currentSequence.velocities.set(index, vel2);
        data.currentSequence.velocities.set(index - 1, vel1);

        recalculatePositions();
        clearAndRenderSteps();
        showStatus('Step moved up', 'info');
    }

    function moveStepDown(index) {
        if (index >= data.currentSequence.steps.length - 1) return;

        [data.currentSequence.steps[index], data.currentSequence.steps[index + 1]] =
            [data.currentSequence.steps[index + 1], data.currentSequence.steps[index]];

        const vel1 = data.currentSequence.velocities.get(index) || parseFloat(elements.defaultVelocity.value);
        const vel2 = data.currentSequence.velocities.get(index + 1) || parseFloat(elements.defaultVelocity.value);
        data.currentSequence.velocities.set(index, vel2);
        data.currentSequence.velocities.set(index + 1, vel1);

        recalculatePositions();
        clearAndRenderSteps();
        showStatus('Step moved down', 'info');
    }

    function recalculatePositions() {
        let currentPos = data.currentSequence.startPoint;

        for (const step of data.currentSequence.steps) {
            if (step.start_point !== currentPos) {
                showStatus('Warning: Path connectivity may be broken', 'error');
                break;
            }
            currentPos = step.end_point;
        }

        data.currentSequence.currentPosition = currentPos;
    }

    function openVelocityModal(index) {
        editingStepIndex = index;
        const currentVelocity = data.currentSequence.velocities.get(index) || parseFloat(elements.defaultVelocity.value);
        elements.modalVelocity.value = currentVelocity;
        elements.modalVelocityValue.textContent = currentVelocity.toFixed(2);
        elements.velocityModal.style.display = 'flex';
    }

    function closeVelocityModal() {
        elements.velocityModal.style.display = 'none';
        editingStepIndex = null;
    }

    function saveVelocity() {
        if (editingStepIndex === null) return;

        const newVelocity = parseFloat(elements.modalVelocity.value);
        data.currentSequence.velocities.set(editingStepIndex, newVelocity);

        // Update the displayed velocity
        const stepElement = elements.sequenceSteps.children[editingStepIndex];
        const velocityElement = stepElement.querySelector('.seq-creator-step-velocity');
        velocityElement.textContent = newVelocity.toFixed(2);

        closeVelocityModal();
        showStatus(`Velocity set to ${newVelocity.toFixed(2)}`, 'success');
    }

    function addJSONOutputSection() {
        const existingOutput = document.querySelector('.seq-creator-output-section');
        if (existingOutput) existingOutput.remove();

        if (data.currentSequence.steps.length === 0) return;

        const outputHTML = `
                    <div class="seq-creator-output-section">
                        <div class="seq-creator-output-header">
                            <h3>Sequence Management</h3>
                            <div class="seq-creator-output-actions">
                                <button class="seq-creator-output-button" onclick="seqCreator.saveSequence()">
                                    💾 Save
                                </button>
                                <button class="seq-creator-output-button" onclick="seqCreator.loadSequences()">
                                    📂 Load
                                </button>
                                <button class="seq-creator-output-button" onclick="seqCreator.undoLast()">
                                    ↩️ Undo
                                </button>
                            </div>
                        </div>
                        <div class="seq-creator-json-output" id="seq-creator-jsonOutput">
                            // Sequence will be saved to config/path_sequence.json
                        </div>
                    </div>
                `;

        // Insert after available paths or current position
        let insertPoint = document.querySelector('.seq-creator-available-steps-section');
        if (!insertPoint) {
            insertPoint = document.querySelector('.seq-creator-current-position');
        }
        if (!insertPoint) {
            insertPoint = elements.sequenceSteps;
        }

        insertPoint.insertAdjacentHTML('afterend', outputHTML);
    }

    async function saveSequence() {
        if (data.currentSequence.steps.length === 0) {
            showStatus('No steps to save', 'error');
            return;
        }

        const sequenceData = {
            sequence: {
                id: `seq_${Date.now()}`,
                name: `sequence_${new Date().toISOString().slice(0, 10)}`,
                createdAt: new Date().toISOString(),
                start: data.currentSequence.startPoint,
                current: data.currentSequence.currentPosition,
                steps: data.currentSequence.steps.map((step, index) => ({
                    order: index + 1,
                    path: step.name,
                    type: step.plan_space === 'Joint' ? 'J' : 'C',
                    from: step.start_point,
                    to: step.end_point,
                    velocity: data.currentSequence.velocities.get(index) || parseFloat(elements.defaultVelocity.value)
                }))
            }
        };

        try {
            const response = await fetch('http://localhost:3003/api/sequences-creator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sequence: sequenceData.sequence,
                    sequenceName: sequenceData.sequence.name
                })
            });

            const result = await response.json();

            if (result.success) {
                document.getElementById('seq-creator-jsonOutput').textContent =
                    JSON.stringify(sequenceData, null, 2);
                showStatus('Sequence saved successfully', 'success');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showStatus(`Failed to save: ${error.message}`, 'error');
        }
    }

    async function loadSequences() {
        try {
            const response = await fetch('http://localhost:3003/api/sequences-creator');
            const result = await response.json();

            if (result.success && result.sequences.length > 0) {
                // Show list of sequences
                const sequenceList = result.sequences.map(seq =>
                    `📁 ${seq.name} (${seq.totalSteps} steps)`
                ).join('\n');

                document.getElementById('seq-creator-jsonOutput').textContent =
                    `Available sequences:\n${sequenceList}\n\nClick a sequence to load it.`;

                showStatus(`${result.sequences.length} sequences found`, 'success');
            } else {
                document.getElementById('seq-creator-jsonOutput').textContent =
                    'No saved sequences found.';
                showStatus('No sequences found', 'info');
            }
        } catch (error) {
            showStatus(`Failed to load sequences: ${error.message}`, 'error');
        }
    }

    async function undoLast() {
        try {
            const response = await fetch('http://localhost:3003/api/sequences-creator/undo', {
                method: 'POST'
            });

            const result = await response.json();

            if (result.success) {
                showStatus('Undo successful', 'success');
                // Reload the current sequence display
                if (data.currentSequence.steps.length > 0) {
                    generateJSON();
                }
            } else {
                showStatus(`Undo failed: ${result.error}`, 'error');
            }
        } catch (error) {
            showStatus(`Failed to undo: ${error.message}`, 'error');
        }
    }

    // Old function kept for compatibility
    function generateJSON() {
        const sequence = data.currentSequence;

        const sequenceJSON = {
            sequence: {
                id: `seq_${Date.now()}`,
                start: sequence.startPoint,
                current: sequence.currentPosition,
                steps: sequence.steps.map((step, index) => ({
                    order: index + 1,
                    path: step.name,
                    type: step.plan_space.charAt(0), // 'J' or 'C'
                    from: step.start_point,
                    to: step.end_point,
                    velocity: data.currentSequence.velocities.get(index) || parseFloat(elements.defaultVelocity.value)
                }))
            }
        };

        const jsonOutput = document.getElementById('seq-creator-jsonOutput');
        if (jsonOutput) {
            jsonOutput.textContent = JSON.stringify(sequenceJSON, null, 2);
            showStatus('JSON generated', 'success');
        }
    }

    // Old function kept for compatibility
    async function copyJSON() {
        const jsonOutput = document.getElementById('seq-creator-jsonOutput');
        if (!jsonOutput) {
            showStatus('No JSON to copy', 'error');
            return;
        }

        const jsonText = jsonOutput.textContent;

        if (jsonText === '// Sequence will be saved to config/path_sequence.json' ||
            jsonText === '// Click Generate to create JSON') {
            showStatus('Generate JSON first', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(jsonText);
            showStatus('Copied to clipboard', 'success');
        } catch (error) {
            showStatus('Failed to copy', 'error');
        }
    }

    function showStatus(message, type) {
        elements.statusMessage.textContent = message;
        elements.statusMessage.className = `seq-creator-status-message ${type}`;
        elements.statusMessage.classList.add('show');

        setTimeout(() => {
            elements.statusMessage.classList.remove('show');
        }, 2000);
    }

    // Public API
    return {
        loadData,
        createNewSequence,
        addStep,
        removeStep,
        moveStepUp,
        moveStepDown,
        openVelocityModal,
        closeVelocityModal,
        saveVelocity,
        saveSequence,
        loadSequences,
        undoLast,
        generateJSON,
        copyJSON,
        showStatus
    };
})();

// Export to global scope
window.seqCreator = seqCreator;