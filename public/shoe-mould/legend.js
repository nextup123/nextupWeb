// Legend toggle functionality
function setupLegend() {
    const toggle = document.getElementById('legendToggle');
    const content = document.getElementById('legendContent');

    if (!toggle || !content) return;

    toggle.addEventListener('click', () => {
        const isCollapsed = content.classList.toggle('collapsed');
        toggle.textContent = isCollapsed ? '+' : '−';
        toggle.title = isCollapsed ? 'Expand Legend' : 'Collapse Legend';
    });

    // Auto-collapse after 5 seconds on first load
    setTimeout(() => {
        if (!content.classList.contains('collapsed')) {
            content.classList.add('collapsed');
            toggle.textContent = '+';
            toggle.title = 'Expand Legend';
        }
    }, 5000);
}


setTimeout(() => {
    setupLegend(); // Add this
}, 1000);

