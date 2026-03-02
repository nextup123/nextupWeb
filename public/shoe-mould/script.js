const state = {
    articles: [],
    currentIndex: 1,
    selectedIndex: null,
    isConnected: true,
    totalArticles: 60,
    rotationOffset: 0,
    sseConnected: false
};

const SAFETY = {
    MIN_INDEX: 1,
    MAX_INDEX: 60,
    DEFAULT_INDEX: 1
};

function validateIndex(index) {
    const num = parseInt(index);
    if (isNaN(num) || num < SAFETY.MIN_INDEX || num > SAFETY.MAX_INDEX) {
        console.warn(`Invalid index ${index}, clamping to safe range ${SAFETY.MIN_INDEX}-${SAFETY.MAX_INDEX}`);
        return SAFETY.DEFAULT_INDEX;
    }
    return num;
}

function initializeData() {
    state.articles = [];
}

function generateRing() {
    const svg = document.getElementById('ringSvg');
    const centerX = 320;
    const centerY = 320;
    const innerRadius = 140;
    const outerRadius = 320;
    const totalSegments = state.totalArticles;

    svg.innerHTML = '';

    for (let i = 1; i <= totalSegments; i++) {
        const article = state.articles[i];
        // Check for y_cm instead of delta_y_cm
        const isMissing = !article || !article.name || article.y_cm === undefined;

        const startAngle = ((i - 1) / totalSegments) * 360 - 90;
        const endAngle = (i / totalSegments) * 360 - 90;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = centerX + innerRadius * Math.cos(startRad);
        const y1 = centerY + innerRadius * Math.sin(startRad);
        const x2 = centerX + outerRadius * Math.cos(startRad);
        const y2 = centerY + outerRadius * Math.sin(startRad);
        const x3 = centerX + outerRadius * Math.cos(endRad);
        const y3 = centerY + outerRadius * Math.sin(endRad);
        const x4 = centerX + innerRadius * Math.cos(endRad);
        const y4 = centerY + innerRadius * Math.sin(endRad);

        const pathData = `M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1}`;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.classList.add('segment');
        g.dataset.index = i;

        if (isMissing) {
            g.classList.add('missing');
        }

        let baseColor;
        if (isMissing) {
            baseColor = '#ef4444';
        } else {
            const isEven = i % 2 === 0;
            baseColor = isEven ? '#f1f5f9' : '#e2e8f0';
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', baseColor);
        path.classList.add('segment-path');

        const midAngle = (startAngle + endAngle) / 2;
        const midRad = (midAngle * Math.PI) / 180;
        const textRadius = (innerRadius + outerRadius) / 1.55;
        const textX = centerX + textRadius * Math.cos(midRad);
        const textY = centerY + textRadius * Math.sin(midRad);

        let textRotation = midAngle + 270;

        const textGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        textGroup.setAttribute('transform', `translate(${textX}, ${textY}) rotate(${textRotation})`);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', -6);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.classList.add('segment-text');
        text.style.fontSize = '12px';
        text.style.fontWeight = '700';
        text.textContent = i;

        const textOffset = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textOffset.setAttribute('x', 0);
        textOffset.setAttribute('y', 8);
        textOffset.setAttribute('text-anchor', 'middle');
        textOffset.setAttribute('dominant-baseline', 'middle');
        textOffset.classList.add('segment-text');
        textOffset.style.fontSize = '9px';

        if (isMissing) {
            text.style.fill = '#FFE4B5';
            textOffset.style.fill = '#DEB887';
            textOffset.textContent = 'N/A';
        } else {
            text.style.fill = '#334155';
            textOffset.style.fill = '#64748b';
            textOffset.textContent = `${article.y_cm}cm`; // Changed from delta_y_cm to y_cm
        }

        textGroup.appendChild(text);
        textGroup.appendChild(textOffset);

        g.appendChild(path);
        g.appendChild(textGroup);

        if (state.selectedIndex === i) {
            g.classList.add('selected');
        }

        g.addEventListener('mouseenter', (e) => handleHover(e, i));
        g.addEventListener('mouseleave', handleLeave);
        g.addEventListener('click', () => selectSegment(i));

        svg.appendChild(g);
    }
}

function handleHover(e, index) {
    const article = state.articles[index];
    const isMissing = !article || !article.name;
    const tooltip = document.getElementById('tooltip');

    if (isMissing) {
        document.getElementById('tt-id').textContent = index;
        document.getElementById('tt-name').textContent = '⚠️ NOT CONFIGURED';
        document.getElementById('tt-offset').textContent = '-';
        document.getElementById('tt-desc').textContent = 'Click to add data';
        tooltip.style.borderLeft = '4px solid #ef4444';
    } else {
        document.getElementById('tt-id').textContent = article.id;
        document.getElementById('tt-name').textContent = article.name;
        
        // Show shoe type in tooltip
        const shoeType = article.shoe_foot_type ? article.shoe_foot_type.toUpperCase() : 'N/A';
        const xOffset = article.x_offset_cm !== undefined ? article.x_offset_cm : '-';
        const roll = article.roll_deg !== undefined ? article.roll_deg : '-';
        
        document.getElementById('tt-offset').textContent = 
            `Y: ${article.y_cm} cm | Type: ${shoeType}`;
        document.getElementById('tt-desc').textContent = article.description;
        tooltip.style.borderLeft = '4px solid transparent';
    }

    tooltip.classList.add('visible');

    const updatePosition = (ev) => {
        tooltip.style.left = (ev.clientX + 15) + 'px';
        tooltip.style.top = (ev.clientY + 15) + 'px';
    };

    e.currentTarget.addEventListener('mousemove', updatePosition);
    e.currentTarget._moveHandler = updatePosition;
}

function handleLeave(e) {
    document.getElementById('tooltip').classList.remove('visible');
    if (e.currentTarget._moveHandler) {
        e.currentTarget.removeEventListener('mousemove', e.currentTarget._moveHandler);
    }
}


// Update selectSegment function
function selectSegment(index) {
    // Don't re-select if already selected
    if (state.selectedIndex === index) {
        return;
    }

    state.selectedIndex = index;
    const article = state.articles[index];
    const isMissing = !article || !article.name;

    document.querySelectorAll('.segment').forEach((seg) => {
        const segIndex = parseInt(seg.dataset.index);
        seg.classList.toggle('selected', segIndex === index);
    });

    const placeholderNotice = document.getElementById('placeholderNotice');
    if (placeholderNotice) {
        placeholderNotice.classList.toggle('visible', isMissing);
    }

    document.getElementById('inputId').value = index;

    if (isMissing) {
        // Placeholder data
        const yVal = index;
        document.getElementById('inputName').value = `size_${String(index).padStart(2, '0')}`;
        document.getElementById('inputOffset').value = yVal.toFixed(1);
        document.getElementById('inputDesc').value = `${yVal} cm distance from the base`;

        // Reset shoe type - MUST select
        resetShoeTypeSelector();

        document.getElementById('inputName').classList.add('placeholder-mode');
        document.getElementById('inputOffset').classList.add('placeholder-mode');
        document.getElementById('inputDesc').classList.add('placeholder-mode');

        showToast(`⚠️ Mould #${index} needs configuration`, true);
    } else {
        document.getElementById('inputName').value = article.name;
        document.getElementById('inputOffset').value = article.y_cm;
        document.getElementById('inputDesc').value = article.description;

        // Set shoe type from existing data
        if (article.shoe_foot_type) {
            setShoeTypeSelector(article.shoe_foot_type);
        } else {
            resetShoeTypeSelector();
        }

        document.getElementById('inputName').classList.remove('placeholder-mode');
        document.getElementById('inputOffset').classList.remove('placeholder-mode');
        document.getElementById('inputDesc').classList.remove('placeholder-mode');

        showToast(`Selected Mould #${index}`, false);
    }
}

// Smart description updater - detects and replaces Y value in description
function setupDescriptionSync() {
    const yInput = document.getElementById('inputOffset');
    const descInput = document.getElementById('inputDesc');

    let lastYValue = yInput.value;

    yInput.addEventListener('input', (e) => {
        const newY = e.target.value;
        const currentDesc = descInput.value;

        // Only auto-update if description matches expected patterns
        // Patterns: "12 cm", "12cm", "12 CM", "12CM"
        const oldY = lastYValue;

        if (!oldY || !newY || oldY === newY) return;

        // Create regex to find the old value in various formats
        // Matches: "12 cm", "12cm", "12 CM", "12CM" (with word boundaries or spaces)
        const escapedOldY = oldY.replace('.', '\\.');
        const patterns = [
            new RegExp(`(\\d*\\s*)${escapedOldY}(\\s*cm)`, 'gi'),     // "12 cm" or "12cm"
            new RegExp(`(\\d*\\s*)${escapedOldY}(\\s*CM)`, 'gi'),     // "12 CM" or "12CM"
            new RegExp(`(\\d*\\s*)${escapedOldY}(\\s*Cm)`, 'gi'),     // "12 Cm"
        ];

        let updatedDesc = currentDesc;
        let matchFound = false;

        for (const pattern of patterns) {
            if (pattern.test(updatedDesc)) {
                updatedDesc = updatedDesc.replace(pattern, `$1${newY}$2`);
                matchFound = true;
                break; // Only replace first occurrence
            }
        }

        // If no pattern matched but description contains the old number standalone
        if (!matchFound) {
            // Look for the number as a whole word/standalone
            const standalonePattern = new RegExp(`\\b${escapedOldY}\\b`, 'g');
            if (standalonePattern.test(updatedDesc)) {
                updatedDesc = updatedDesc.replace(standalonePattern, newY);
                matchFound = true;
            }
        }

        // Update description if we found and replaced something
        if (matchFound && updatedDesc !== currentDesc) {
            descInput.value = updatedDesc;

            // Visual feedback - brief highlight
            descInput.style.background = '#dcfce7';
            setTimeout(() => {
                descInput.style.background = '';
            }, 300);
        }

        lastYValue = newY;
    });

    // Update lastYValue when focus enters the field
    yInput.addEventListener('focus', () => {
        lastYValue = yInput.value;
    });
}


function updateRotation() {
    const segmentAngle = 360 / state.totalArticles;
    const targetRotation = -((state.currentIndex - 1) * segmentAngle) + 177;

    const ringWrapper = document.getElementById('ringWrapper');
    const currentTransform = ringWrapper.style.transform;
    let currentRotation = 0;
    if (currentTransform && currentTransform.includes('rotate')) {
        const match = currentTransform.match(/rotate\(([-\d.]+)deg\)/);
        if (match) currentRotation = parseFloat(match[1]);
    }

    let diff = targetRotation - currentRotation;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;

    const newRotation = currentRotation + diff;
    ringWrapper.style.transform = `rotate(${newRotation}deg)`;

    document.getElementById('centerIndex').textContent = state.currentIndex;

    const activeArticle = state.articles[state.currentIndex];
    const isMissing = !activeArticle || !activeArticle.name;

    const mouldNameEl = document.getElementById('activeMouldName');
    if (isMissing) {
        mouldNameEl.textContent = '⚠️ NOT SET';
        mouldNameEl.style.color = '#ffd3b3';
    } else {
        mouldNameEl.textContent = activeArticle.name;
        mouldNameEl.style.color = '';
    }

    document.querySelectorAll('.segment').forEach((seg) => {
        const segIndex = parseInt(seg.dataset.index);
        seg.classList.toggle('current-index', segIndex === state.currentIndex);
    });
}

// State for shoe type
let selectedShoeType = null;

// Initialize shoe type selector
function setupShoeTypeSelector() {
    const selector = document.getElementById('shoeTypeSelector');
    const options = selector.querySelectorAll('.shoe-type-option');

    options.forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected from all
            options.forEach(opt => opt.classList.remove('selected'));

            // Add selected to clicked
            option.classList.add('selected');
            selectedShoeType = option.dataset.type;

            // Hide error if present
            document.getElementById('shoeTypeError').style.display = 'none';
            option.classList.remove('error');
        });
    });
}

// Get selected shoe type
function getSelectedShoeType() {
    return selectedShoeType;
}

// Validate shoe type
function validateShoeType() {
    if (!selectedShoeType) {
        const selector = document.getElementById('shoeTypeSelector');
        const options = selector.querySelectorAll('.shoe-type-option');

        options.forEach(opt => opt.classList.add('error'));
        document.getElementById('shoeTypeError').style.display = 'block';

        // Remove error animation after it plays
        setTimeout(() => {
            options.forEach(opt => opt.classList.remove('error'));
        }, 500);

        return false;
    }
    return true;
}

// Reset shoe type selector
function resetShoeTypeSelector() {
    const selector = document.getElementById('shoeTypeSelector');
    const options = selector.querySelectorAll('.shoe-type-option');

    options.forEach(opt => opt.classList.remove('selected'));
    selectedShoeType = null;
    document.getElementById('shoeTypeError').style.display = 'none';
}

// Set shoe type selector value
function setShoeTypeSelector(type) {
    const selector = document.getElementById('shoeTypeSelector');
    const options = selector.querySelectorAll('.shoe-type-option');

    options.forEach(opt => {
        opt.classList.remove('selected');
        if (opt.dataset.type === type) {
            opt.classList.add('selected');
            selectedShoeType = type;
        }
    });
}






// Update form submission
document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (state.selectedIndex === null) {
        showToast('Please select a mould first', true);
        return;
    }

    // Validate shoe type selection
    if (!validateShoeType()) {
        showToast('Please select a shoe foot type (Left or Right)', true);
        return;
    }

    const safeSelectedIndex = validateIndex(state.selectedIndex);
    if (safeSelectedIndex !== state.selectedIndex) {
        showToast('Invalid mould selection', true);
        return;
    }

    const existingArticle = state.articles[state.selectedIndex] || {};
    const isNew = !existingArticle.id;

    // Create article with shoe_foot_type
    const article = {
        ...existingArticle,
        id: state.selectedIndex,
        name: document.getElementById('inputName').value,
        shoe_foot_type: selectedShoeType,  // Add shoe type
        y_cm: parseFloat(document.getElementById('inputOffset').value),
        description: document.getElementById('inputDesc').value
    };

    state.articles[state.selectedIndex] = article;

    generateRing();
    updateRotation();
    selectSegment(state.selectedIndex);

    const success = await saveToBackend();

    if (success) {
        showToast(isNew ? '✅ New mould added successfully!' : 'Changes saved successfully!', false);
    } else {
        showToast('Failed to save changes', true);
    }
});

document.getElementById('btnReset').addEventListener('click', () => {
    if (state.selectedIndex !== null) {
        selectSegment(state.selectedIndex);
    }
});

function applyBackendData(data) {
    const safeIndex = validateIndex(data.machine_current_index);

    if (safeIndex !== data.machine_current_index) {
        console.error(`Backend sent invalid index: ${data.machine_current_index}, using safe value: ${safeIndex}`);
        showToast(`Warning: Invalid index ${data.machine_current_index} received from backend`, true);
    }

    const previousSelection = state.selectedIndex;
    let articlesChanged = false;

    const newArticles = [];
    for (let i = 1; i <= state.totalArticles; i++) {
        const found = data.articles.find(a => a.id === i);
        if (found) {
            const oldArticle = state.articles[i];
            if (!oldArticle ||
                oldArticle.name !== found.name ||
                oldArticle.y_cm !== found.y_cm ||  // Changed from delta_y_cm to y_cm
                oldArticle.description !== found.description) {
                articlesChanged = true;
            }
            newArticles[i] = found; // Store full object including x_offset_cm, roll_deg
        } else {
            if (state.articles[i] != null) articlesChanged = true;
            newArticles[i] = null;
        }
    }

    if (articlesChanged) {
        state.articles = newArticles;
        generateRing();

        if (previousSelection !== null) {
            state.selectedIndex = previousSelection;
            const seg = document.querySelector(`.segment[data-index="${previousSelection}"]`);
            if (seg) seg.classList.add('selected');
        }
    }

    if (state.currentIndex !== safeIndex) {
        state.currentIndex = safeIndex;
        updateRotation();

        if (state.selectedIndex !== null) {
            const seg = document.querySelector(`.segment[data-index="${state.selectedIndex}"]`);
            if (seg) seg.classList.add('selected');
        }
    }

    state.isConnected = true;
    updateConnectionStatus();
}

async function fetchData() {
    try {
        const response = await fetch('/shoe-mould/articles');
        if (response.ok) {
            const data = await response.json();
            applyBackendData(data);
        }
    } catch (error) {
        console.log('Backend connection failed:', error);
        state.isConnected = false;
        updateConnectionStatus();
    }
}

let eventSource = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 2000;

function startSSE() {
    if (eventSource) {
        eventSource.close();
    }

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max SSE reconnection attempts reached. Falling back to polling.');
        showToast('Real-time connection failed. Switching to polling mode.', true);
        startPolling();
        return;
    }

    console.log(`Connecting to SSE... (attempt ${reconnectAttempts + 1})`);

    eventSource = new EventSource('/shoe-mould/watch');

    eventSource.onopen = () => {
        console.log('SSE connection established');
        state.sseConnected = true;
        reconnectAttempts = 0;
        updateConnectionStatus();
    };

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            applyBackendData(data);
        } catch (err) {
            console.error('Failed to parse SSE data:', err);
        }
    };

    eventSource.onerror = (err) => {
        console.error('SSE connection error:', err);
        state.sseConnected = false;
        state.isConnected = false;
        updateConnectionStatus();

        eventSource.close();
        reconnectAttempts++;

        const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), 30000);
        console.log(`Reconnecting in ${delay}ms...`);

        setTimeout(startSSE, delay);
    };
}

function startPolling() {
    console.log('Starting polling fallback...');
    fetchData();
    setInterval(fetchData, 1000);
}

// UPDATED: Send full article objects to preserve extra fields
async function saveToBackend() {
    try {
        // Collect all valid articles (including their extra fields)
        const validArticles = [];
        for (let i = 1; i <= state.totalArticles; i++) {
            if (state.articles[i] !== null && state.articles[i] !== undefined) {
                validArticles.push(state.articles[i]); // Send full object with x_offset_cm, roll_deg, etc.
            }
        }

        const response = await fetch('/shoe-mould/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                articles: validArticles,
                machine_current_index: state.currentIndex
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Save failed:', error);
        return false;
    }
}

async function updateBackend() {
    try {
        const safeIndex = validateIndex(state.currentIndex);

        const response = await fetch('/shoe-mould/current-index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: safeIndex })
        });
        return response.ok;
    } catch (error) {
        console.error('Update failed:', error);
        return false;
    }
}

function updateConnectionStatus() {
    const dot = document.getElementById('connDot');
    const text = document.getElementById('connText');

    if (state.sseConnected) {
        dot.classList.remove('disconnected');
        dot.style.background = '#10b981';
        text.textContent = 'Live (SSE)';
    } else if (state.isConnected) {
        dot.classList.remove('disconnected');
        dot.style.background = '#f59e0b';
        text.textContent = 'Polling Mode';
    } else {
        dot.classList.add('disconnected');
        dot.style.background = '#ef4444';
        text.textContent = 'Disconnected';
    }
}

function showToast(message, isError) {
    const toast = document.getElementById('toast');
    document.getElementById('toastMessage').textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

window.addEventListener('DOMContentLoaded', () => {
    initializeData();
    generateRing();
    updateRotation();
    setupDescriptionSync();
    setupShoeTypeSelector();

    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 500);

    fetchData();
    startSSE();
});