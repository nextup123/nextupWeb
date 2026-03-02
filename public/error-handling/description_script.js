document.addEventListener('DOMContentLoaded', () => {

    const modal = document.getElementById('description-modal');
    const textarea = document.getElementById('description-text');

    const openBtn = document.getElementById('open-description');
    const closeBtn = document.getElementById('close-description');
    const editBtn = document.getElementById('edit-description');
    const saveBtn = document.getElementById('save-description');

    // ---------------- OPEN ----------------
    openBtn.onclick = () => {
        modal.classList.remove('hidden');
        loadDescription();
    };

    // ---------------- CLOSE ----------------
    closeBtn.onclick = () => {
        exitEditMode();
        modal.classList.add('hidden');
    };

    // ---------------- EDIT ----------------
    editBtn.onclick = () => {
        textarea.removeAttribute('readonly');
        textarea.focus();
        editBtn.classList.add('hidden');
        saveBtn.classList.remove('hidden');
    };

    // ---------------- SAVE ----------------
    saveBtn.onclick = () => {
        fetch('/error-logs/description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: textarea.value })
        })
            .then(res => res.json())
            .then(() => exitEditMode())
            .catch(() => alert('Failed to save description'));
    };

    function exitEditMode() {
        textarea.setAttribute('readonly', true);
        editBtn.classList.remove('hidden');
        saveBtn.classList.add('hidden');
    }

    function loadDescription() {
        textarea.value = 'Loading…';

        fetch('/error-logs/description')
            .then(res => res.text())
            .then(text => textarea.value = text)
            .catch(() => textarea.value = 'Failed to load description');
    }
});
