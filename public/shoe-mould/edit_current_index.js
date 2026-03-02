// Modal functionality
const modal = document.getElementById('indexModal');
const modalInput = document.getElementById('modalIndexInput');
const indexGrid = document.getElementById('indexGrid');
const modalCurrentDisplay = document.getElementById('modalCurrentDisplay');
let modalSelectedIndex = 1;

// Generate grid buttons
function generateIndexGrid() {
    indexGrid.innerHTML = '';
    
    for (let i = 1; i <= 60; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = i;
        btn.dataset.index = i;
        
        // Styling
        btn.style.cssText = `
            aspect-ratio: 1;
            border: 2px solid var(--border);
            border-radius: 8px;
            background: white;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 40px;
        `;
        
        // Hover effects
        btn.addEventListener('mouseenter', () => {
            if (parseInt(btn.dataset.index) !== modalSelectedIndex) {
                btn.style.background = '#f1f5f9';
                btn.style.borderColor = '#3b82f6';
                btn.style.transform = 'scale(1.05)';
            }
        });
        
        btn.addEventListener('mouseleave', () => {
            if (parseInt(btn.dataset.index) !== modalSelectedIndex) {
                btn.style.background = 'white';
                btn.style.borderColor = 'var(--border)';
                btn.style.transform = 'scale(1)';
            }
        });
        
        // Click handler
        btn.addEventListener('click', () => {
            selectGridIndex(i);
        });
        
        indexGrid.appendChild(btn);
    }
    
    updateGridSelection();
}

// Update visual selection in grid
function updateGridSelection() {
    const buttons = indexGrid.querySelectorAll('button');
    buttons.forEach(btn => {
        const idx = parseInt(btn.dataset.index);
        if (idx === modalSelectedIndex) {
            // Selected state - yellow highlight
            btn.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
            btn.style.color = 'white';
            btn.style.borderColor = '#d97706';
            btn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
            btn.style.transform = 'scale(1.1)';
            btn.style.fontWeight = '800';
        } else {
            // Normal state
            btn.style.background = 'white';
            btn.style.color = 'var(--text)';
            btn.style.borderColor = 'var(--border)';
            btn.style.boxShadow = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.fontWeight = '600';
        }
    });
    
    // Update display
    modalCurrentDisplay.textContent = modalSelectedIndex;
}

// Select index from grid
function selectGridIndex(index) {
    modalSelectedIndex = index;
    updateGridSelection();
}

// Open modal
document.getElementById('btnSetIndex').addEventListener('click', () => {
    modalSelectedIndex = state.currentIndex;
    generateIndexGrid();
    modal.style.display = 'flex';
    
    // Scroll selected into view
    setTimeout(() => {
        const selectedBtn = indexGrid.querySelector(`button[data-index="${modalSelectedIndex}"]`);
        if (selectedBtn) {
            selectedBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 100);
});

// Close modal handlers
document.getElementById('btnModalCancel').addEventListener('click', closeModal);
document.getElementById('btnModalClose').addEventListener('click', closeModal);

function closeModal() {
    modal.style.display = 'none';
}

// Confirm selection
document.getElementById('btnModalConfirm').addEventListener('click', async () => {
    const newIndex = modalSelectedIndex;
    
    // Validate (should always be valid but safety first)
    if (newIndex < 1 || newIndex > 60) {
        showToast(`Invalid index! Must be between 1 and 60`, true);
        return;
    }
    
    state.currentIndex = newIndex;
    updateRotation();
    
    // Send to backend
    const success = await updateBackend();
    
    if (success) {
        showToast(`Current index updated to ${newIndex}`, false);
    } else {
        showToast('Failed to update backend', true);
    }
    
    closeModal();
});

// Close modal on outside click
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    if (modal.style.display !== 'flex') return;
    
    if (e.key === 'Escape') {
        closeModal();
    } else if (e.key === 'Enter') {
        document.getElementById('btnModalConfirm').click();
    }
});