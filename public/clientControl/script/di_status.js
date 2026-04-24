// script/di_status.js - WITH ROS SUBSCRIPTION

window.addEventListener("message", (event) => {
    const msg = event.data;

    if (!msg || !msg.type) return;

    if (msg.type === "DI_STATUS") {
        updateDIStatusFromBackend(msg.payload);
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('di-container');
    let editMode = false;
    // let layoutData = JSON.parse(localStorage.getItem('di_layout') || '{}');
    async function loadLayoutFromBackend() {
        const res = await fetch('/ros/di-layout');
        return await res.json();
    }
    layoutData = await loadLayoutFromBackend();

    // Track existing positions to avoid overlaps
    const usedPositions = new Set();

    // --- Create Edit/Save button ---
    const header = document.querySelector('#di-status .section-header-do');
    const editBtn = document.createElement('button');
    editBtn.innerHTML = '<i class="fa-solid fa-up-down-left-right"></i>';
    editBtn.className = 'edit-layout-btn';
    header.appendChild(editBtn);

    editBtn.addEventListener('click', () => {
        editMode = !editMode;
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
    function createSafeId(name, driverId, diId) {
        // Replace spaces and special characters with underscores
        const safeName = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        return `di_${safeName}_${driverId}_${diId}`;
    }

    // --- Map DI ID to DI Key ---
    function mapDiIdToKey(diId) {
        // Map numeric DI IDs to their corresponding keys
        const diMap = {
            '1': 'di1',
            '2': 'di2',
            '3': 'di3',
            '4': 'di4',
            '5': 'di5',
            '6': 'sto1',
            '7': 'sto2',
            '8': 'edm'
        };
        return diMap[diId] || `di${diId}`; // fallback to di{id}
    }

    // --- Update DI status from ROS message ---


    function updateDIStatusFromBackend(payload) {
        const diItems = document.querySelectorAll('.di-item');

        diItems.forEach(item => {
            const driver = parseInt(item.dataset.driver, 10);
            const diKey = item.dataset.diKey;

            const indicator = item.querySelector('.di-indicator');
            if (!indicator) return;

            const driverData = payload[driver - 1]; // 👈 KEY CHANGE

            if (!driverData) return;

            // Mapping index
            const indexMap = {
                di1: 0,
                di2: 1,
                di3: 2,
                di4: 3,
                di5: 4,
                sto1: 5,
                sto2: 6,
                edm: 7
            };

            const index = indexMap[diKey];
            const isActive = driverData[index];

            if (isActive) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }
    // --- Initialize ROS Subscription ---


    // --- Show connection error ---
    function showConnectionError() {


        // Show a notification
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.innerHTML = `
            <i class="fa-solid fa-exclamation-triangle"></i>
            <span>DI Status: No ROS connection. Data will not update.</span>
        `;
        notification.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: #ff6b6b;
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        container.appendChild(notification);

        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    async function loadDIList() {
        console.log('Loading DI list...');
        try {
            const res = await fetch('/ros/di-list');
            const json = await res.json();
            console.log('Fetched DI list:', json);



            // First, create all elements to calculate sizes
            const tempElements = [];
            json.data.forEach(di => {
                const diId = di.di_id; // This is '1', '2', '3', '4' etc.
                const diKey = mapDiIdToKey(diId); // Convert to 'di1', 'di2', etc.
                const safeId = createSafeId(di.name, di.driver_id, diId);

                const div = document.createElement('div');
                div.className = 'di-item';
                div.id = safeId;
                div.title = `${di.name} (Driver: ${di.driver_id}, DI: ${diKey})`;

                div.dataset.driver = di.driver_id;
                div.dataset.diKey = diKey; // Store the mapped key

                div.innerHTML = `
                    <span class="di-label">${di.name}</span>
                    <div class="di-indicator" id="indicator_${safeId}"></div>
                `;

                tempElements.push({ di, div, safeId, diKey });
            });

            console.log(`Created ${tempElements.length} DI elements`);

            // Add to DOM first to get actual sizes
            tempElements.forEach(({ div }) => {
                container.appendChild(div);
            });

            // Now position each element
            tempElements.forEach(({ di, div, safeId }) => {
                const elementRect = div.getBoundingClientRect();

                let position;
                if (layoutData[safeId]) {
                    // Use saved position
                    position = layoutData[safeId];
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
            });

            // Initialize ROS subscription for real-time updates

        } catch (err) {
            console.error('Failed to fetch DI list:', err);

            // Fallback: Create some demo DIs for testing
            createDemoDIs();
        }
    }

    // --- Create demo DIs for testing when fetch fails ---
    function createDemoDIs() {
        console.log('Creating demo DIs...');

        const demoDIs = [
            { name: 'Limit Switch', driver_id: '1', di_id: '1' },
            { name: 'Proximity Sensor', driver_id: '1', di_id: '2' },
            { name: 'Safety Gate', driver_id: '1', di_id: '6' },
            { name: 'Emergency Stop', driver_id: '1', di_id: '7' },
            { name: 'Encoder Zero', driver_id: '2', di_id: '1' },
            { name: 'Overload Detect', driver_id: '2', di_id: '8' },
        ];

        // Create demo elements
        demoDIs.forEach(di => {
            const diKey = mapDiIdToKey(di.di_id);
            const safeId = createSafeId(di.name, di.driver_id, di.di_id);

            const div = document.createElement('div');
            div.className = 'di-item demo-item';
            div.id = safeId;
            div.title = `${di.name} (Driver: ${di.driver_id}, DI: ${diKey}) [DEMO]`;

            div.dataset.driver = di.driver_id;
            div.dataset.diKey = diKey;

            div.innerHTML = `
                <span class="di-label">${di.name}</span>
                <div class="di-indicator" id="indicator_${safeId}"></div>
            `;

            container.appendChild(div);

            // Position randomly
            const elementRect = div.getBoundingClientRect();
            const position = getSmartPosition(elementRect.width, elementRect.height);

            div.style.position = 'absolute';
            div.style.left = `${position.x}px`;
            div.style.top = `${position.y}px`;

            makeDraggable(div);
        });

        console.log('Demo DIs created. Waiting for ROS connection...');
    }

    // --- Dragging Function ---
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
        const items = container.querySelectorAll('.di-item');
        const layout = {};

        items.forEach(el => {
            layout[el.id] = {
                x: parseInt(el.style.left) || 0,
                y: parseInt(el.style.top) || 0
            };
        });

        await fetch('/ros/di-layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(layout)
        });

        console.log('DI layout saved to backend');
    }


    const refreshBtn = document.getElementById("refresh-di");
    refreshBtn.addEventListener("click", async () => {
        console.log("🔄 Refreshing DI list...");

        // Clear existing content
        container.innerHTML = "";
        usedPositions.clear();

        // Reload layout from backend (single source of truth)
        layoutData = await loadLayoutFromBackend();

        // Reload DI list
        loadDIList();
    });


    // Initialize
    loadDIList();
    loadLayoutFromBackend();
});