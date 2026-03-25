document.addEventListener('DOMContentLoaded', () => {

    const modal = document.getElementById('commands-modal');
    const container = document.getElementById('cells-container');

    const openBtn = document.getElementById('open-commands');
    const closeBtn = document.getElementById('close-commands');
    const saveBtn = document.getElementById('save-commands');
    const addTextBtn = document.getElementById('add-text-cell');
    const addCmdBtn = document.getElementById('add-command-cell');

    let cells = [];

    // ---------- OPEN ----------
    openBtn.onclick = () => {
        modal.classList.remove('hidden');
        loadCells();
    };

    closeBtn.onclick = () => {
        modal.classList.add('hidden');
    };

    // ---------- LOAD ----------
    function loadCells() {
        container.innerHTML = 'Loading…';
        fetch('/error-logs/commands')
            .then(res => res.json())
            .then(data => {
                cells = data.cells || [];
                render();
            })
            .catch(() => {
                cells = [];
                render();
            });
    }

    // ---------- SAVE ----------
    saveBtn.onclick = () => {
        fetch('/error-logs/commands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cells })
        })
            .then(() => alert('Saved'))
            .catch(() => alert('Save failed'));
    };

    // ---------- ADD CELLS ----------
    addTextBtn.onclick = () => {
        cells.push({ type: 'text', content: '' });
        render();
    };

    addCmdBtn.onclick = () => {
        cells.push({ type: 'command', content: '' });
        render();
    };

    // ---------- RENDER ----------
    function render() {
        container.innerHTML = '';
        cells.forEach((cell, index) => {
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

        const editBtn = createEditBtn(() => {
            enableEdit(content, index);
        });

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

        const editBtn = createEditBtn(() => {
            enableEdit(content, index);
        });

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
            cells[index].content = contentDiv.textContent.trim();
            contentDiv.contentEditable = false;
        };
    }


    document.getElementById('open-terminal').onclick = () => {
        fetch('/error-logs/open-terminal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cwd: '/home/nextup'   // optional
            })
        })
            .catch(() => alert('Failed to open terminal'));
    };


});
