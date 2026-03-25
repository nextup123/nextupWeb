//ADDING POP UPs TO DISPLAY CNC OR ROBOT ERROR WHEN PRESS START - rocket//

// const listener1 = new ROSLIB.Topic({
//   ros: ros,
//   name: '/ros2_topic_1',
//   messageType: 'std_msgs/Bool'
// });

// const listener2 = new ROSLIB.Topic({
//   ros: ros,
//   name: '/ros2_topic_2',
//   messageType: 'std_msgs/Bool'
// });

// listener1.subscribe(function (message) {
//   updateBoolTopics('/ros2_topic_1', message.data);
// });

// listener2.subscribe(function (message) {
//   updateBoolTopics('/ros2_topic_2', message.data);
// });

// Function to update boolean values based on ROS2 messages
// function updateBoolTopics(topic, value) {
//   if (topic === '/ros2_topic_1') {
//     boolTopic1 = value;
//   } else if (topic === '/ros2_topic_2') {
//     boolTopic2 = value;
//   }
// }

// Get the modal and its elements
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');
const closeModal = document.querySelector('.close');

// Function to open the modal with a specific error message
function showErrorModal(message) {
  errorMessage.innerHTML = message + '<hr><p class="resolve-msg">⚠️ Resolve the above issues to <b>START</b> the Robot ⚠️</p>';
  errorModal.style.display = 'flex';
}

// Function to close the modal
function closeErrorModal() {
  errorModal.style.display = 'none';
}

// Close modal when the close button is clicked
closeModal.addEventListener('click', closeErrorModal);

// Close modal when clicking outside the modal
window.addEventListener('click', (event) => {
  if (event.target === errorModal) {
    closeErrorModal();
  }
});

// Modify Start Button Behavior
document.getElementById('startButton').addEventListener('click', function (event) {
  let errorMsg = '<h3>🚨 CRITICAL ERROR DETECTED 🚨</h3>';

  let hasError = false;

  // if (cnc1_fault_error) {
  //   errorMsg += '<p class="error-item">❌ <b>CNC FAULT ERROR:</b> Check CNC system</p>';
  //   hasError = true;
  // }
  // if (!cnc_id_od_status) {
  //   errorMsg += '<p class="error-item">❌ <b>CNC ID-OD ERROR:</b> Check CNC Chuck ID-OD</p>';
  //   hasError = true;
  // }
  // if (!cnc1auto_mode_error) {
  //   errorMsg += '<p class="error-item">❌ <b>CNC AUTOMODE NOT ENABLED:</b> Turn on Auto Mode</p>';
  //   hasError = true;
  // }

  // if (robotStatus) {
  //   errorMsg += '<p class="error-item">❌ <b>ROBOT IN ERROR STATE:</b> Press RESET button to fix, open Error Monitor section for more details. </p>';
  //   hasError = true;
  // }


  if (hasError) {
    event.preventDefault();
    showErrorModal(errorMsg);
  } else {
    publishStringMessage('/ui_commands', 'st8');


    setTimeout(() => {
      publishBoolMessage('/start_bt', true);
      // togglePause();
    }, 1000);
  }
});



document.getElementById('runOnceButton').addEventListener('click', function (event) {
  let errorMsg = '<h3>🚨 CRITICAL ERROR DETECTED 🚨</h3>';

  let hasError = false;

  // if (cnc_fault_error) {
  //   errorMsg += '<p class="error-item">❌ <b>CNC FAULT ERROR:</b> Check CNC system</p>';
  //   hasError = true;
  // }
  // if (!cnc_id_od_status) {
  //   errorMsg += '<p class="error-item">❌ <b>CNC ID-OD ERROR:</b> Check CNC Chuck ID-OD</p>';
  //   hasError = true;
  // }
  // if (!cncauto_mode_error) {
  //   errorMsg += '<p class="error-item">❌ <b>CNC AUTOMODE NOT ENABLED:</b> Turn on Auto Mode</p>';
  //   hasError = true;
  // }

  // if (robotStatus) {
  //   errorMsg += '<p class="error-item">❌ <b>ROBOT IN ERROR STATE:</b> Press RESET button to fix, open Error Monitor section for more details. </p>';
  //   hasError = true;
  // }


  if (hasError) {
    event.preventDefault();
    showErrorModal(errorMsg);
  } else {
    // publishStringMessage('/ui_commands', 'repeat1000000');
    publishBoolMessage('/start_bt', true);
    setTimeout(() => {
      publishBoolMessage('/reset_bt', true);
    }, 3000); // 3000 milliseconds = 3 seconds
  }
});

function togglePlayPause() {
  const button = document.getElementById('playPauseButton');


  if (button.classList.contains('play')) {

    let errorMsg = '<h3>🚨 CRITICAL ERROR DETECTED 🚨</h3>';

    let hasError = false;

    // if (cnc1_fault_error) {
    //   errorMsg += '<p class="error-item">❌ <b>CNC FAULT ERROR:</b> Check CNC system</p>';
    //   hasError = true;
    // }
    // if (!cnc_id_od_status) {
    //   errorMsg += '<p class="error-item">❌ <b>CNC ID-OD ERROR:</b> Check CNC Chuck ID-OD</p>';
    //   hasError = true;
    // }
    // if (!cnc1auto_mode_error) {
    //   errorMsg += '<p class="error-item">❌ <b>CNC AUTOMODE NOT ENABLED:</b> Turn on Auto Mode</p>';
    //   hasError = true;
    // }

    // if (robotStatus) {
    //   errorMsg += '<p class="error-item">❌ <b>ROBOT IN ERROR STATE:</b> Press RESET button to fix, open Error Monitor section for more details. </p>';
    //   hasError = true;
    // }

    if (hasError) {
      event.preventDefault();
      showErrorModal(errorMsg);
    } else {
      publishBoolMessage('/pause', false);
      button.classList.remove('play');
      button.classList.add('pause');
      button.textContent = "PAUSE";
      // disableButton('0100');
    }

  } else {
    publishBoolMessage('/pause', true);
    button.classList.remove('pause');
    button.classList.add('play');
    button.textContent = "PLAY";
    // disableButton('0110');
  }
}

//ADDING POP UPs TO DISPLAY CNC OR ROBOT ERROR WHEN PRESS START - rocket//


//subsciption to total operation counter -rocket//
const totalCounterListener = new ROSLIB.Topic({
  ros: ros,
  name: '/total_operation_counter',
  messageType: 'std_msgs/msg/Int32'
});
const totalOperationCounterDiv = document.getElementById('total-operation-conter');
totalOperationCounterDiv.textContent = "000";
totalCounterListener.subscribe((message) => {
  totalOperationCounterDiv.textContent = message.data;
});

function showResetConfirmationPopup() {
  // Display the popup
  const popup = document.getElementById('reset-confirmation-popup');
  popup.style.display = 'flex';
}

function closeResetPopup() {
  // Hide the popup
  const popup = document.getElementById('reset-confirmation-popup');
  popup.style.display = 'none';
}

function confirmReset() {
  // Publish the message and close the popup
  publishBoolMessage('/reset_total_operation_counter', true);
  closeResetPopup();
  console.log('Total counter reset message published.');
}

//subsciption to total operation counter -rocket//


// Define the ROS 2 topic


const popupTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/popup_commands',
  messageType: 'std_msgs/String' // Assuming the topic publishes a Boolean message
});

// Log subscription status
popupTopic.subscribe(function (message) {
  console.log('Received message on /popup_commands:', message.data);

  if (message.data === "start") {
    // Show the success popup
    showSuccessPopupStartRobotSuccess();
    disableButton('0100');
    togglePause();
  }
  else if (message.data === "play") {
    // Show the success popup
    showSuccessPopupPlayRobotSuccess();
    disableButton('0100');
  }
  else if (message.data === "pause") {
    // Show the success popup
    showSuccessPopupPauseRobotSuccess();
    disableButton('0110');
    togglePlay();
  }
  else if (message.data === "home") {
    // Show the success popup
    showSuccessPopupHomeRobotSuccess();
    disableButton('1001');
  }
  else if (message.data === "exit") {
    // Show the success popup
    showSuccessPopupExitRobotSuccess();
    disableButton('1001');
  }
  else if (message.data === "reset") {
    // Show the success popup
    showSuccessPopupResetRobotSuccess();
  }
  else if (message.data === "completed") {
    // Show the success popup
    showSuccessPopupResetRobotSuccess();
    disableButton('1001');
  }

});






// Function to show the popup
function showSuccessPopupStartRobotSuccess() {
  const popup = document.getElementById('startrobot');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}





// Function to show the popup
function showSuccessPopupPlayRobotSuccess() {
  const popup = document.getElementById('playrobot');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}





// Function to show the popup
function showSuccessPopupExitRobotSuccess() {
  const popup = document.getElementById('exitrobot');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}







// Function to show the popup
function showSuccessPopupHomeRobotSuccess() {
  const popup = document.getElementById('homingrobot');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}








// Function to show the popup
function showSuccessPopupResetRobotSuccess() {
  const popup = document.getElementById('resetrobot');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}





// Function to show the popup
function showSuccessPopupPauseRobotSuccess() {
  const popup = document.getElementById('pauserobot');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}





