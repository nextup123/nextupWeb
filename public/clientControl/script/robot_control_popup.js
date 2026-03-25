/**************************************************************
 * CNC START GATE LOGIC + TEST OVERRIDE
 **************************************************************/

/* ===================== DEBUG ===================== */
/* No continuous logs by design */
const DEBUG_CNC_START = false;
const logOnce = (...args) => DEBUG_CNC_START && console.log('[CNC-START]', ...args);

/* ===================== REAL STATES (FROM ROS) ===================== */

let cncFaultActive = false;   // driver 2, di3
let cncAutoMode   = false;    // driver 2, di4
// allJointsOp comes from joint_status.js (already global)

/* ===================== OVERRIDE STATES ===================== */

let useOverride = false;

let overrideAllJointsOp   = true;
let overrideCncFault      = false;
let overrideCncAutoMode   = true;

/* ===================== ROS SUBSCRIPTION ===================== */

const sub = new ROSLIB.Topic({
  ros,
  name: '/nextup_digital_inputs',
  messageType: 'nextup_joint_interfaces/msg/NextupDigitalInputs'
});

let lastUpdateTime = 0;
const UPDATE_INTERVAL_MS = 500; // 2 Hz

sub.subscribe((msg) => {
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL_MS) return;
  lastUpdateTime = now;

  if (!msg || !msg.di3 || !msg.di4) return;

  const drvIdx = 1; // driver 2

  const faultRaw = msg.di3[drvIdx];
  const autoRaw  = msg.di4[drvIdx];

  if (faultRaw !== undefined) cncFaultActive = Boolean(faultRaw);
  if (autoRaw  !== undefined) cncAutoMode   = Boolean(autoRaw);
});

/* ===================== EFFECTIVE STATE RESOLUTION ===================== */

function getEffectiveStates() {
  return {
    jointsOp:   useOverride ? overrideAllJointsOp : allJointsOp,
    cncFault:  useOverride ? overrideCncFault     : cncFaultActive,
    cncAuto:   useOverride ? overrideCncAutoMode  : cncAutoMode
  };
}

/* ===================== START VALIDATION ===================== */

function canRobotStart() {
  const { jointsOp, cncFault, cncAuto } = getEffectiveStates();
  const issues = [];

  if (!jointsOp) {
    issues.push('One or more robot joints are NOT operational');
  }

  if (cncFault) {
    issues.push('CNC alarm / fault is active');
  }

  if (!cncAuto) {
    issues.push('CNC is NOT in AUTO mode');
  }

  return {
    allowed: issues.length === 0,
    issues
  };
}

/* ===================== START BLOCKED MODAL ===================== */

function showStartBlockedModal(issues) {
  const modal = document.getElementById('start-blocked-modal');
  const list  = document.getElementById('start-blocked-list');

  list.innerHTML = '';
  issues.forEach(issue => {
    const li = document.createElement('li');
    li.textContent = issue;
    list.appendChild(li);
  });

  modal.classList.add('show');
}

function closeStartBlockedModal() {
  document.getElementById('start-blocked-modal')?.classList.remove('show');
}

/* ===================== OVERRIDE SETTINGS MODAL ===================== */

function openOverrideModal() {
  document.getElementById('override-modal')?.classList.add('show');

  document.getElementById('override-enable').checked = useOverride;
  document.getElementById('override-joints').checked = overrideAllJointsOp;
  document.getElementById('override-fault').checked  = overrideCncFault;
  document.getElementById('override-auto').checked   = overrideCncAutoMode;
}

function closeOverrideModal() {
  document.getElementById('override-modal')?.classList.remove('show');
}

function applyOverrides() {
  useOverride = document.getElementById('override-enable').checked;
  overrideAllJointsOp = document.getElementById('override-joints').checked;
  overrideCncFault    = document.getElementById('override-fault').checked;
  overrideCncAutoMode = document.getElementById('override-auto').checked;

  closeOverrideModal();
}
