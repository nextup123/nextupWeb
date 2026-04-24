// script/robot_control.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof ros === 'undefined' || !ros) {
    console.error('❌ ROS connection not found. Make sure script.js initializes it first.');
    return;
  }

  // ==============================
  // Helper Function
  // ==============================
  function publishBoolMessage(topicName, value) {
    const topic = new ROSLIB.Topic({
      ros,
      name: topicName,
      messageType: 'std_msgs/Bool'
    });

    const message = new ROSLIB.Message({ data: value });
    topic.publish(message);
    console.log(`📤 Published ${topicName}: ${value}`);
  }

  function publishRosString(topicName, messageData) {
    const topic = new ROSLIB.Topic({
      ros: ros,
      name: topicName,
      messageType: 'std_msgs/String'
    });
    const message = new ROSLIB.Message({
      data: messageData
    });
    topic.publish(message);
    console.log(`Published to ${topicName}: ${messageData}`);
  }

  // ==============================
  // Button Elements
  // ==============================
  const startBtn = document.getElementById('start-btn');
  const exitBtn = document.getElementById('exit-btn');
  const runonceBtn = document.getElementById('runonce-btn');

  if (!startBtn || !exitBtn || !runonceBtn) {
    console.error('❌ One or more control buttons not found');
    return;
  }

  setTimeout(() => {
    startBtn.classList.add('btn-disabled');
    runonceBtn.classList.add('btn-disabled');
  }, 1500);
  // ==============================
  // Enable / Disable Buttons
  // ==============================
  function setStartButtonsEnabled(enabled) {
    [startBtn, runonceBtn].forEach(btn => {
      btn.disabled = !enabled;

      if (enabled) {
        btn.classList.remove('btn-disabled');
      } else {
        btn.classList.add('btn-disabled');
      }
    });

    // console.log(
    //   enabled
    //     ? '🟢 START & RUN ONCE enabled'
    //     : '🔴 START & RUN ONCE disabled'
    // );
  }

  // ==============================
  // ROS Subscriber
  // ==============================
  const startBtActiveSub = new ROSLIB.Topic({
    ros,
    name: '/control_start_bt_active',
    messageType: 'std_msgs/Bool'
  });

  startBtActiveSub.subscribe(msg => {
    setStartButtonsEnabled(msg.data);
  });

  function publishSpeedBeforeStart() {
    console.log(`⚡ Publishing speed before start: ${currentSpeedScale}`);
    publishSpeed(currentSpeedScale);
  }

  // ==============================
  // Button Handlers
  // ==============================
  startBtn.addEventListener('click', () => {
    if (startBtn.disabled) return;

    const { allowed, issues } = canRobotStart();

    if (!allowed) {
      console.warn('🚫 Start blocked:', issues);
      showStartBlockedModal(issues);
      return;
    }

    console.log('▶️ START clicked...');

    publishRosString('/change_mode', '8');
    publishSpeedBeforeStart();
    setTimeout(() => {
      publishBoolMessage('/control_start_bt', true);
    }, 750);
  });


  runonceBtn.addEventListener('click', () => {
    if (runonceBtn.disabled) return;

    const { allowed, issues } = canRobotStart();

    if (!allowed) {
      console.warn('🚫 Run-once blocked:', issues);
      showStartBlockedModal(issues);
      return;
    }

    console.log('🔁 RUN ONCE clicked...');

    publishRosString('/change_mode', '8');
    publishSpeedBeforeStart();

    setTimeout(() => {
      publishBoolMessage('/control_start_bt', true);

      setTimeout(() => {
        publishBoolMessage('/control_reset_bt', true);
      }, 3000);
    }, 750);
  });


  exitBtn.addEventListener('click', () => {
    console.log('🛑 EXIT clicked...');
    publishBoolMessage('/control_reset_bt', true);
  });


  const processToggle = document.querySelector('.process-toggle');
  const processIndicator = document.querySelector('.process-status-indicator');

  let processState = 'stopped'; // local mirror (authoritative = ROS)


  const processControlPub = new ROSLIB.Topic({
    ros,
    name: '/control_process_control_bt',
    messageType: 'std_msgs/String'
  });

  const processStatusSub = new ROSLIB.Topic({
    ros,
    name: '/control_process_control_bt_status',
    messageType: 'std_msgs/String'
  });
  processStatusSub.subscribe(msg => {
    if (!msg?.data) return;

    const firstWord = msg.data.trim().split(/\s+/)[0].toLowerCase();

    if (firstWord === 'running') {
      processState = 'running';

      processToggle.classList.add('active');
      processIndicator.classList.add('running');

    } else if (firstWord === 'stopped') {
      processState = 'stopped';

      // Toggle OFF
      processToggle.classList.remove('active');
      processIndicator.classList.remove('running');
    }
  });
////////////////////////////////////////////////////////////////////////////////////
  const failedNodeSubscriber = new ROSLIB.Topic({
    ros: ros,
    name: '/bt_failed_node',
    messageType: 'std_msgs/msg/String'
  });



  failedNodeSubscriber.subscribe(function (message) {
    const data = message.data.toLowerCase();
    console.log("==============>", data);
  });
////////////////////////////////////////////////////////////////////////////////////


  processToggle.addEventListener('click', () => {
    if (processState === 'running') {
      // Optimistic UI + state
      processState = 'stopped';

      processToggle.classList.remove('active');
      setTimeout(() => {
        startBtn.classList.add('btn-disabled');
        runonceBtn.classList.add('btn-disabled');
      }, 1000);

      // processIndicator.classList.remove('running');

      processControlPub.publish({ data: 'stop' });
    }
    else if (processState === 'stopped') {
      // Optimistic UI + state
      processState = 'running';

      processToggle.classList.add('active');
      // processIndicator.classList.add('running');

      processControlPub.publish({ data: 'start' });
    }
  });
});


