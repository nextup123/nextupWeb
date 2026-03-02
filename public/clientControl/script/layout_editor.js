// layout_editor.js
document.addEventListener('DOMContentLoaded', () => {
  const containers = document.querySelectorAll('.editable-container');

  containers.forEach(container => {
    const type = container.id.startsWith('di') ? 'di' : 'do';
    const editBtn = document.querySelector(`.edit-btn[data-target="${type}"]`);
    const saveBtn = document.querySelector(`.save-btn[data-target="${type}"]`);

    // Load saved layout if any
    loadLayout(container, type);

    editBtn.addEventListener('click', () => toggleEdit(container, editBtn, saveBtn, type));
    saveBtn.addEventListener('click', () => saveLayout(container, editBtn, saveBtn, type));
  });
});

function toggleEdit(container, editBtn, saveBtn, type) {
  const isEditing = container.classList.toggle('edit-mode');
  editBtn.textContent = isEditing ? 'Add / Delete' : 'Edit';
  saveBtn.disabled = !isEditing;

  if (isEditing) {
    enableEditing(container);
  } else {
    disableEditing(container);
  }
}

function enableEditing(container) {
  container.querySelectorAll('.movable').forEach(el => makeDraggable(el, container));
}

function disableEditing(container) {
  container.querySelectorAll('.movable').forEach(el => {
    el.onmousedown = null;
  });
}

function makeDraggable(el, container) {
  let offsetX, offsetY, isDragging = false;
  el.onmousedown = (e) => {
    isDragging = true;
    el.style.cursor = 'grabbing';
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    document.onmousemove = (e) => {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      let x = e.clientX - rect.left - offsetX;
      let y = e.clientY - rect.top - offsetY;

      // Boundaries
      x = Math.max(0, Math.min(x, rect.width - el.offsetWidth));
      y = Math.max(0, Math.min(y, rect.height - el.offsetHeight));

      // Snap to 10px grid
      el.style.left = Math.round(x / 10) * 10 + 'px';
      el.style.top = Math.round(y / 10) * 10 + 'px';
    };
    document.onmouseup = () => {
      isDragging = false;
      el.style.cursor = 'grab';
      document.onmousemove = null;
    };
  };
}

function saveLayout(container, editBtn, saveBtn, type) {
  const layout = [];
  container.querySelectorAll('.movable').forEach(el => {
    layout.push({
      id: el.id,
      x: parseInt(el.style.left || 0),
      y: parseInt(el.style.top || 0),
      width: el.offsetWidth,
      height: el.offsetHeight,
      classList: Array.from(el.classList)
    });
  });
  localStorage.setItem(`layout_${type}`, JSON.stringify(layout));
  saveBtn.disabled = true;
  container.classList.remove('edit-mode');
  disableEditing(container);
  alert(`Layout for ${type.toUpperCase()} saved.`);
}

function loadLayout(container, type) {
  const saved = localStorage.getItem(`layout_${type}`);
  if (!saved) return;
  try {
    const layout = JSON.parse(saved);
    layout.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) {
        el.style.position = 'absolute';
        el.style.left = item.x + 'px';
        el.style.top = item.y + 'px';
        el.classList.add('movable');
      }
    });
  } catch (err) {
    console.error('Failed to load layout:', err);
  }
}
