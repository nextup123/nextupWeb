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
