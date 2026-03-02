

const testingBtn = document.getElementById('mode-testing');
const lowBtn = document.getElementById('mode-low');
const highBtn = document.getElementById('mode-high');
const productionBtn = document.getElementById('mode-production');
const slider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const cncButtons = document.querySelectorAll('.cnc-btn');

let settings = {
  mode: 'testing',
  speed: 0.1,
  cnc: 'none'
};

// --- ROS Topics ---
const speedTopic = new ROSLIB.Topic({
  ros,
  name: '/dynamic_speed_scale',
  messageType: 'std_msgs/Float64'
});

const cncTopic = new ROSLIB.Topic({
  ros,
  name: '/select_cnc',
  messageType: 'std_msgs/String'
});

// --- ROS Publish Helpers ---
function publishSpeed(value) {
  const msg = new ROSLIB.Message({ data: parseFloat(value) });
  speedTopic.publish(msg);
  console.log(`📤 Published /dynamic_speed_scale: ${value.toFixed(2)}`);
}

function publishCNC(selection) {
  const msg = new ROSLIB.Message({ data: selection });
  cncTopic.publish(msg);
  console.log(`📤 Published /select_cnc: "${selection}"`);
}

// --- Load last settings from server ---
async function loadSettings() {
  try {
    const res = await fetch('/settings');
    const data = await res.json();
    settings = data;
    applySettings();

    // ✅ Publish loaded state to ROS on load
    publishSpeed(settings.speed);
    publishCNC(settings.cnc);
    console.log('Loaded settings:', data);
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

// --- Save settings to server ---
async function saveSettings() {
  try {
    const res = await fetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const result = await res.json();
    console.log(`💾 Settings saved: ${result.message}`);
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function applySettings() {

  // Reset all mode buttons
  [lowBtn, highBtn, productionBtn].forEach(b => b.classList.remove('active'));

  if (settings.mode === 'low_testing') {
    lowBtn.classList.add('active');

    slider.disabled = true;
    slider.min = 0.01;
    slider.max = 0.20;

    currentSpeedScale = 0.1;
  }

  else if (settings.mode === 'high_testing') {
    highBtn.classList.add('active');

    slider.disabled = false;
    slider.min = 0.50;
    slider.max = 0.90;

    currentSpeedScale = settings.speed;
  }

  else if (settings.mode === 'production') {
    productionBtn.classList.add('active');

    slider.disabled = true;

    currentSpeedScale = 0.0;
  }

  // UI sync
  slider.value = currentSpeedScale;
  speedValue.textContent = currentSpeedScale.toFixed(2);

  // ROS publish
  publishSpeed(currentSpeedScale);
}


// --- Mode handlers ---
lowBtn.addEventListener('click', () => {
  settings.mode = 'low_testing';
  settings.speed = 0.1;

  applySettings();
  saveSettings();

  console.log('🐢 Low Speed Testing | Speed = 0.10');
});

highBtn.addEventListener('click', () => {
  settings.mode = 'high_testing';

  if (settings.speed < 0.5) settings.speed = 0.5;

  applySettings();
  saveSettings();

  console.log(`🚀 High Speed Testing | Speed = ${settings.speed}`);
});


productionBtn.addEventListener('click', () => {
  settings.mode = 'production';
  settings.speed = 0.0;

  applySettings();
  saveSettings();

  console.log('🏭 Production | Backend default speed');
});


slider.addEventListener('input', () => {
  if (settings.mode !== 'high_testing') return;

  settings.speed = parseFloat(slider.value);
  currentSpeedScale = settings.speed;

  speedValue.textContent = currentSpeedScale.toFixed(2);

  saveSettings();
  publishSpeed(currentSpeedScale);

  console.log(`🎚️ High Speed Updated: ${currentSpeedScale}`);
});


// --- CNC buttons ---
cncButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    cncButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    settings.cnc = btn.textContent.trim();
    saveSettings();
    publishCNC(settings.cnc);
    console.log(`🧰 CNC Selected: ${settings.cnc}`);
  });
});

// --- Load and publish initial state ---
loadSettings();
