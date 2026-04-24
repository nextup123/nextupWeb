// script/do_control.js - UPDATED WITH DESCRIPTIVE IDs
document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('do-container');
    let editMode = false;
    // let layoutData = JSON.parse(localStorage.getItem('do_layout') || '{}');

    let layoutData = {};

    async function loadLayoutFromBackend() {
        const res = await fetch('/ros/do-layout');
        return await res.json();
    }

    layoutData = await loadLayoutFromBackend();


    // Track existing positions to avoid overlaps
    const usedPositions = new Set();

    if (typeof ros === 'undefined' || !ros) {
        console.error('❌ ROS connection not found. Ensure script.js initializes it first.');
        return;
    }



    function publishDO(driver, doId, state) {
        let mappedDoId;

        if (doId === 'pi_p') mappedDoId = 4;
        else mappedDoId = parseInt(doId);

        window.parent.postMessage({
            type: "TOGGLE_DO",
            payload: {
                driver,
                doId: mappedDoId,
                state
            }
        }, "*");
    }

    // 🟢 Push Type: momentary button
    async function handlePush(doItem, btn) {
        console.log(`▶️ DO ${doItem.name} ON`);
        publishDO(doItem.driver_id, doItem.do_id, true);

        btn.disabled = true;
        await new Promise(res => setTimeout(res, parseInt(doItem.push_wait) || 250));

        console.log(`⏹️ DO ${doItem.name} OFF`);
        publishDO(doItem.driver_id, doItem.do_id, false);

        btn.disabled = false;
    }

    // 🟡 Switch Type: toggle button
    function handleSwitch(doItem, toggleEl) {
        const state = toggleEl.checked;
        console.log(`🔁 DO ${doItem.name} ${state ? 'ON' : 'OFF'}`);
        publishDO(doItem.driver_id, doItem.do_id, state);
    }

    // --- Create Edit/Save button ---
    const header = document.querySelector('#do-control .section-header-do');
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<i class="fa-solid fa-up-down-left-right"></i>';
    editBtn.className = 'edit-layout-btn';
    header.appendChild(editBtn);

    editBtn.addEventListener('click', () => {
        editMode = !editMode;
        // ✅ Use innerHTML instead of textContent
        editBtn.innerHTML = editMode
            ? '<i class="fa-regular fa-square-check"></i>'
            : '<i class="fa-solid fa-up-down-left-right"></i>';
        container.classList.toggle('edit-mode', editMode);

        if (!editMode) saveLayout();
    });

    // --- Get smart starting position (non-overlapping) ---
    function getSmartPosition(elementWidth, elementHeight) {
        const gridSize = 20;
        const padding = 10;

        // Try positions in a spiral pattern from top-left
        for (let radius = 0; radius < 10; radius++) {
            for (let x = 0; x <= radius; x++) {
                for (let y = 0; y <= radius; y++) {
                    if (x === 0 && y === 0) continue;

                    const positions = [
                        [x * (elementWidth + padding), y * (elementHeight + padding)],
                        [-x * (elementWidth + padding), y * (elementHeight + padding)],
                        [x * (elementWidth + padding), -y * (elementHeight + padding)],
                        [-x * (elementWidth + padding), -y * (elementHeight + padding)]
                    ];

                    for (const [posX, posY] of positions) {
                        const gridX = Math.round(posX / gridSize) * gridSize;
                        const gridY = Math.round(posY / gridSize) * gridSize;
                        const positionKey = `${gridX},${gridY}`;

                        if (!usedPositions.has(positionKey)) {
                            // Check if this position fits in container
                            const containerRect = container.getBoundingClientRect();
                            if (gridX >= 0 && gridY >= 0 &&
                                gridX + elementWidth <= containerRect.width &&
                                gridY + elementHeight <= containerRect.height) {
                                usedPositions.add(positionKey);
                                return { x: gridX, y: gridY };
                            }
                        }
                    }
                }
            }
        }

        // Fallback: random position that doesn't overlap
        const containerRect = container.getBoundingClientRect();
        let x, y;
        let attempts = 0;

        do {
            x = Math.floor(Math.random() * (containerRect.width - elementWidth));
            y = Math.floor(Math.random() * (containerRect.height - elementHeight));

            // Snap to grid
            x = Math.round(x / gridSize) * gridSize;
            y = Math.round(y / gridSize) * gridSize;

            attempts++;
        } while (usedPositions.has(`${x},${y}`) && attempts < 50);

        usedPositions.add(`${x},${y}`);
        return { x, y };
    }

    // --- Helper: Create safe ID from name ---
    function createSafeId(name, driverId, doId) {
        // Replace spaces and special characters with underscores
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return `do_${safeName}_${driverId}_${doId}`;
    }

    // --- Load DO list ---
    async function loadDOList() {
        try {
            const res = await fetch('/ros/do-list');
            const json = await res.json();

            // First, create all elements to calculate sizes
            const tempElements = [];
            json.data.forEach(doItem => {
                const doId = createSafeId(doItem.name, doItem.driver_id, doItem.do_id);
                const div = document.createElement('div');
                div.className = 'do-item';
                div.id = doId;
                div.title = `${doItem.name} (Driver: ${doItem.driver_id}, DO: ${doItem.do_id})`;

                div.innerHTML = `
            <span class="do-label">${doItem.name} :</span>
            ${doItem.type_of_control === 'switch'
                        ? `<label class="switch-wrapper">
                    <input type="checkbox" class="switch-input">
                    <span class="switch-slider"></span>
                </label>`
                        : `<button class="do-btn">Push</button>`
                    }
        `;
                tempElements.push({ doItem, div, doId });
            });

            // Add to DOM first to get actual sizes
            tempElements.forEach(({ div }) => {
                container.appendChild(div);
            });

            // Now position each element
            tempElements.forEach(({ doItem, div, doId }) => {
                const elementRect = div.getBoundingClientRect();

                let position;
                if (layoutData[doId]) {
                    // Use saved position
                    position = layoutData[doId];
                    usedPositions.add(`${position.x},${position.y}`);
                } else {
                    // Get smart position for new elements
                    position = getSmartPosition(elementRect.width, elementRect.height);
                }

                // Apply position
                div.style.position = 'absolute';
                div.style.left = `${position.x}px`;
                div.style.top = `${position.y}px`;

                makeDraggable(div);

                const btn = div.querySelector('button');
                const toggle = div.querySelector('input[type="checkbox"]');

                if (btn) {
                    btn.addEventListener('click', () => handlePush(doItem, btn));
                }
                if (toggle) {
                    toggle.addEventListener('change', () => handleSwitch(doItem, toggle));
                }
            });

        } catch (err) {
            console.error('Failed to fetch DO list:', err);
        }
    }
    // --- FIXED Dragging Function ---
    function makeDraggable(el) {
        let isDragging = false;
        let startX, startY, initialX, initialY;

        el.addEventListener('mousedown', (e) => {
            if (!editMode) return;

            isDragging = true;
            e.preventDefault();

            // Get initial positions
            const rect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            startX = e.clientX;
            startY = e.clientY;
            initialX = rect.left - containerRect.left;
            initialY = rect.top - containerRect.top;

            el.style.zIndex = '1000';
            el.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            // Calculate new position
            const containerRect = container.getBoundingClientRect();
            let newX = initialX + (e.clientX - startX);
            let newY = initialY + (e.clientY - startY);

            // Boundary checking
            const elRect = el.getBoundingClientRect();
            newX = Math.max(0, Math.min(containerRect.width - elRect.width, newX));
            newY = Math.max(0, Math.min(containerRect.height - elRect.height, newY));

            // Snap to grid (10px)
            const gridSize = 10;
            newX = Math.round(newX / gridSize) * gridSize;
            newY = Math.round(newY / gridSize) * gridSize;

            // Apply new position
            el.style.left = `${newX}px`;
            el.style.top = `${newY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                el.style.zIndex = '1';
                el.classList.remove('dragging');
            }
        });
    }

    async function saveLayout() {
        const items = container.querySelectorAll('.do-item');
        const layout = {};

        items.forEach(el => {
            layout[el.id] = {
                x: parseInt(el.style.left) || 0,
                y: parseInt(el.style.top) || 0
            };
        });

        await fetch('/ros/do-layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(layout)
        });

        console.log('DO layout saved to backend');
    }


    const refreshBtn = document.getElementById("refresh-do");
    refreshBtn.addEventListener("click", async () => {
        console.log("🔄 Refreshing DO list...");

        container.innerHTML = "";
        usedPositions.clear();

        layoutData = await loadLayoutFromBackend();
        loadDOList();
    });

    // await loadLayoutFromBackend();
    loadDOList();
}); 