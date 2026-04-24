// file - error_handleing.js

document.addEventListener('DOMContentLoaded', () => {

    const state = {
        terminal: { isPaused: false, pausedLogs: [], allLogs: [] },
        cells: []
    };

    // ── ROS STATUS (driven by parent postMessage) ──────────────

 

    // ── RECEIVE FROM PARENT (replaces roslib subscriptions) ────
    window.addEventListener("message", (event) => {
        const msg = event.data;
        if (!msg || !msg.type) return;

        switch (msg.type) {

            // WS connection status forwarded from parent

            // Replaces logsListener.subscribe
            case "LOG_MESSAGE_INCOMING": {
                const entry = { time: timestamp(), data: msg.payload };
                if (state.terminal.isPaused) {
                    state.terminal.pausedLogs.push(entry);
                } else {
                    state.terminal.allLogs.push(entry);
                    renderLog(entry);
                }
                break;
            }

            // Replaces monitorTopic.subscribe
            case "ACTIVE_NODES": {
                const active = msg.payload;
                Object.values(nodeEls).forEach(e => e.classList.remove('active'));
                Object.values(controllerEls).forEach(e => e.classList.remove('active'));
                active.forEach(name => {
                    nodeEls[name]?.classList.add('active');
                    controllerEls[name]?.classList.add('active');
                });
                break;
            }

            // Service call response
            case "MONITORING_RESPONSE": {
                const btn = msg.payload.action === 'start' ? startBtn : stopBtn;
                flashButton(btn, msg.payload.success ? 'success' : 'failure');
                break;
            }
        }
    });

    // ── TERMINAL ───────────────────────────────────────────────
    const terminal = document.getElementById('terminal-display');
    const searchInput = document.getElementById('log-search-input');
    const clearSearchBtn = document.getElementById('clear-search');

    function applyFilterAndRender() {
        terminal.innerHTML = '';
        const keyword = searchInput.value.toLowerCase();
        state.terminal.allLogs
            .filter(log => log.data.toLowerCase().includes(keyword))
            .forEach(renderLog);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function renderLog(log) {
        const { cleanText, level } = parseLogLevel(log.data);
        const line = document.createElement('div');
        line.classList.add('log-line', level);
        line.innerHTML = `
            <span class="timestamp">${log.time}</span>
            <span class="log-message">${cleanText}</span>
        `;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function parseLogLevel(text) {
        const match = text.match(/^\[(info|success|warn|failure)\]\s*(.*)/i);
        if (!match) return { cleanText: text, level: 'log-default' };
        return { cleanText: match[2], level: `log-${match[1].toLowerCase()}` };
    }

    document.getElementById('clear-terminal').onclick = () => {
        terminal.innerHTML = '';
        state.terminal.allLogs = [];
    };

    document.getElementById('pause-terminal').onclick = () => togglePause(true);
    document.getElementById('play-terminal').onclick  = () => togglePause(false);

    function togglePause(pause) {
        state.terminal.isPaused = pause;
        document.getElementById('pause-terminal').disabled =  pause;
        document.getElementById('play-terminal').disabled  = !pause;
        if (!pause && state.terminal.pausedLogs.length) {
            state.terminal.allLogs.push(...state.terminal.pausedLogs);
            state.terminal.pausedLogs = [];
            applyFilterAndRender();
        }
    }

    searchInput.addEventListener('input', applyFilterAndRender);
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        applyFilterAndRender();
    });

    // ── CLOCK ──────────────────────────────────────────────────
    function timestamp() {
        return new Date().toLocaleTimeString('en-US', { hour12: false });
    }
    function updateClock() {
        document.getElementById('digital-clock').textContent =
            new Date().toLocaleTimeString('en-US', { hour12: false });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // ── SERVICES (send to parent → WS → ROS) ──────────────────
    function sendToParent(type) {
        window.parent.postMessage({ type }, "*");
    }

    function flashButton(button, cls) {
        button.classList.add(cls);
        setTimeout(() => button.classList.remove('success', 'failure'), 2000);
    }

    const startBtn = document.getElementById('monitorStartBtn');
    const stopBtn  = document.getElementById('monitorStopBtn');

    startBtn.addEventListener('click', () => sendToParent("MONITORING_START"));
    stopBtn.addEventListener('click',  () => sendToParent("MONITORING_STOP"));

    // ── MONITOR MODAL ──────────────────────────────────────────
    const monitorOpenBtn  = document.getElementById('monitor-open-btn');
    const monitorCloseBtn = document.getElementById('monitor-close-btn');
    const monitorOverlay  = document.getElementById('monitor-modal-overlay');

    monitorOpenBtn.onclick  = () => monitorOverlay.classList.remove('hidden');
    monitorCloseBtn.onclick = () => monitorOverlay.classList.add('hidden');

    const monitorNodeContainer       = document.getElementById('monitor-nodes');
    const monitorControllerContainer = document.getElementById('monitor-controllers');
    const nodeEls       = {};
    const controllerEls = {};

    fetch('/ros-monitor/names')
        .then(r => r.json())
        .then(data => {
            data.nodes.forEach(name => {
                const el = createMonitorItem(name);
                monitorNodeContainer.appendChild(el);
                nodeEls[name] = el;
            });
            data.controllers.forEach(name => {
                const el = createMonitorItem(name);
                monitorControllerContainer.appendChild(el);
                controllerEls[name] = el;
            });
        });

    function createMonitorItem(name) {
        const el = document.createElement('div');
        el.className = 'monitor-item';
        el.textContent = name;
        return el;
    }

    // ── COMMANDS MODAL ─────────────────────────────────────────
    // ... (rest of commands modal, description modal, open-terminal code unchanged)
    // Keep everything from your original below this line as-is:

    const modal     = document.getElementById('commands-modal');
    const container = document.getElementById('cells-container');
    const openBtn   = document.getElementById('open-commands');
    const closeBtn  = document.getElementById('close-commands');
    const saveBtn   = document.getElementById('save-commands');
    const addTextBtn = document.getElementById('add-text-cell');
    const addCmdBtn  = document.getElementById('add-command-cell');

    openBtn.onclick  = () => { modal.classList.remove('hidden'); loadCells(); };
    closeBtn.onclick = () => modal.classList.add('hidden');

    function loadCells() {
        container.innerHTML = 'Loading…';
        fetch('/error-logs/commands')
            .then(res => res.json())
            .then(data => { state.cells = data.cells || []; renderCells(); })
            .catch(() => { state.cells = []; renderCells(); });
    }

    saveBtn.onclick = () => {
        fetch('/error-logs/commands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cells: state.cells })
        }).then(() => alert('Saved')).catch(() => alert('Save failed'));
    };

    addTextBtn.onclick = () => { state.cells.push({ type: 'text', content: '' }); renderCells(); };
    addCmdBtn.onclick  = () => { state.cells.push({ type: 'command', content: '' }); renderCells(); };

    function renderCells() {
        container.innerHTML = '';
        state.cells.forEach((cell, index) => {
            if (cell.type === 'text') renderTextCell(cell, index);
            else renderCommandCell(cell, index);
        });
    }

    function renderTextCell(cell, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cell text-cell';
        const content = document.createElement('div');
        content.className = 'cell-content';
        content.textContent = cell.content || 'Click edit to add text';
        content.contentEditable = false;
        const editBtn = createEditBtn(() => enableEdit(content, index));
        wrapper.append(content, editBtn);
        container.appendChild(wrapper);
    }

    function renderCommandCell(cell, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cell command-cell';
        const content = document.createElement('div');
        content.className = 'cell-content mono';
        content.textContent = cell.content || 'Click edit to add command';
        content.contentEditable = false;
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(cell.content || '');
            copyBtn.textContent = 'Copied';
            setTimeout(() => copyBtn.textContent = 'Copy', 1000);
        };
        const editBtn = createEditBtn(() => enableEdit(content, index));
        wrapper.append(content, copyBtn, editBtn);
        container.appendChild(wrapper);
    }

    function createEditBtn(onClick) {
        const btn = document.createElement('button');
        btn.className = 'edit-btn';
        btn.innerHTML = 'edit';
        btn.onclick = onClick;
        return btn;
    }

    function enableEdit(contentDiv, index) {
        contentDiv.contentEditable = true;
        contentDiv.focus();
        contentDiv.onblur = () => {
            state.cells[index].content = contentDiv.textContent.trim();
            contentDiv.contentEditable = false;
        };
    }

    document.getElementById('open-terminal').onclick = () => {
        fetch('/error-logs/open-terminal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cwd: '/home/nextup' })
        }).catch(() => alert('Failed to open terminal'));
    };

    const descModal   = document.getElementById('description-modal');
    const textarea    = document.getElementById('description-text');
    const editDescBtn = document.getElementById('edit-description');
    const saveDescBtn = document.getElementById('save-description');

    document.getElementById('open-description').onclick = () => {
        descModal.classList.remove('hidden');
        loadDescription();
    };
    document.getElementById('close-description').onclick = () => {
        exitEditMode();
        descModal.classList.add('hidden');
    };
    editDescBtn.onclick = () => {
        textarea.removeAttribute('readonly');
        textarea.focus();
        editDescBtn.classList.add('hidden');
        saveDescBtn.classList.remove('hidden');
    };
    saveDescBtn.onclick = () => {
        fetch('/error-logs/description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: textarea.value })
        }).then(() => exitEditMode()).catch(() => alert('Failed to save description'));
    };

    function exitEditMode() {
        textarea.setAttribute('readonly', true);
        editDescBtn.classList.remove('hidden');
        saveDescBtn.classList.add('hidden');
    }

    function loadDescription() {
        textarea.value = 'Loading…';
        fetch('/error-logs/description')
            .then(res => res.text())
            .then(text => textarea.value = text)
            .catch(() => textarea.value = 'Failed to load description');
    }

}); // end first DOMContentLoaded

document.addEventListener('DOMContentLoaded', () => {

    const container = document.getElementById('error-history');
    const limitSelect = document.getElementById('limit-select');
    const searchInput = document.getElementById('history-search');
    const countLabel = document.getElementById('history-count');

    let allLogs = [];

    // ---------------- INITIAL LOAD ----------------
    loadLogs(limitSelect.value);

    limitSelect.addEventListener('change', () => {
        loadLogs(limitSelect.value);
    });

    const reloadBtn = document.getElementById('reload-history');
    reloadBtn.addEventListener('click', () => {
        loadLogs(limitSelect.value);
    });


    searchInput.addEventListener('input', applyFilter);

    // ---------------- FETCH ----------------
    function loadLogs(limit) {
        container.innerHTML = `<div class="loading-text">Loading…</div>`;
        countLabel.textContent = '';

        fetch(`/error-logs?limit=${limit}`)
            .then(res => res.json())
            .then(data => {
                allLogs = data.logs || [];
                applyFilter();
            })
            .catch(() => {
                container.innerHTML =
                    `<div class="error-text">Failed to load logs</div>`;
            });
    }

    // ---------------- FILTER ----------------
    function applyFilter() {
        const keyword = searchInput.value.toLowerCase();
        container.innerHTML = '';

        const filtered = allLogs.filter(log => {
            const combined =
                `${log.time} ${log.joint} ${log.last_error} ${toHex(log.last_error)}`;
            return combined.toLowerCase().includes(keyword);
        });

        filtered.slice().reverse().forEach(renderRow);
        countLabel.textContent = `Showing ${filtered.length} / ${allLogs.length}`;
    }

    // ---------------- RENDER ----------------
    function renderRow(log) {
        const row = document.createElement('div');
        row.className = 'error-row';

        row.append(
            pill('time-pill', log.time),
            pill('joint-pill', log.joint),
            errorPills(log.last_error)
        );

        container.appendChild(row);
    }

    function pill(cls, text) {
        const div = document.createElement('div');
        div.className = `pill ${cls}`;
        div.textContent = text;
        return div;
    }

    function errorPills(dec) {
        const wrapper = document.createElement('div');
        wrapper.className = 'error-pill-group';

        const hex = pill('error-pill', `E ${toHex(dec)}`);
        const decPill = pill('error-pill faded', dec);

        wrapper.append(hex, decPill);
        return wrapper;
    }

    function toHex(dec) {
        return Number(dec).toString(16).toUpperCase().padStart(2, '0');
    }
});
