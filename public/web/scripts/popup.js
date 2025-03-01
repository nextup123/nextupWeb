// Define the ROS 2 topic
const motionPlanningTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/motion_plan',
  messageType: 'std_msgs/String'
});

// Handle Plan button click
const planButton = document.getElementById('plan');
planButton.addEventListener('click', () => {
  // Create and publish the message
  const message = new ROSLIB.Message({
    data: 'plan' // The message to publish
  });
  motionPlanningTopic.publish(message);
  console.log('Published message:', message.data);
});


const cartesianButton = document.getElementById('cartesian');
cartesianButton.addEventListener('click', () => {
  const message = new ROSLIB.Message({
    data: 'c_plan'
  });
  motionPlanningTopic.publish(message);
  console.log('Published message:', message.data)
})
const jointButton = document.getElementById('joint');
jointButton.addEventListener('click', () => {
  const message = new ROSLIB.Message({
    data: 's_plan'
  });
  motionPlanningTopic.publish(message);
  console.log('Published message:', message.data)
})


// Hide popup when "Cartesian" button is clicked
cartesianButton.addEventListener('click', () => {
  const popup = document.getElementById('popup2');
  popup.style.display = 'none';
});

// Hide popup when "Joint" button is clicked
jointButton.addEventListener('click', () => {
  const popup = document.getElementById('popup2');
  popup.style.display = 'none';
});





document.addEventListener('DOMContentLoaded', function () {
  console.log('DOM fully loaded and parsed');


  // Define the ROS publisher
  const pathPublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/path_data',
    messageType: 'std_msgs/String',
  });

  // Save Path Functionality
  const savePathButton = document.getElementById('path');
  const popup3 = document.getElementById('popup3');
  const pathNameField = document.getElementById('name_path');
  const speedField = document.getElementById('speed');
  const accelerationField = 1;
  const waitField = document.getElementById('wait_time');
  const planSpaceCartesian = document.querySelector('input[value="1"]');
  const planSpaceJoint = document.querySelector('input[value="2"]');
  const pathSubmitButton = document.getElementById('path_submit');
  const pathCancelButton = document.getElementById('cancell');

  // Log elements to check if they are found
  console.log('savePathButton:', savePathButton);
  console.log('popup3:', popup3);
  console.log('pathNameField:', pathNameField);
  console.log('speedField:', speedField);
  console.log('accelerationField:', accelerationField);
  console.log('waitField:', waitField);


  if (savePathButton && popup3 && pathNameField && speedField && accelerationField && waitField) {
    console.log('All elements found in the DOM');

    // Show the Save Path popup when the button is clicked
    savePathButton.addEventListener('click', function () {
      console.log('Save Path button clicked');
      popup3.style.display = 'block';
      pathNameField.value = "";
      pathNameField.focus();
      console.log('popup3 display set to block');
    });

    // Handle Submit Button in Save Path Popup
    pathSubmitButton.addEventListener('click', async function (event) {
      event.preventDefault(); // Prevent form submission
      console.log('Submit button clicked');

      // Debug pathNameField
      console.log('pathNameField value before trim:', pathNameField.value);

      const name = pathNameField.value.trim();
      console.log('Name:', name);

      const speed = parseFloat(speedField.value);
      const acceleration = parseFloat(accelerationField);
      const wait = parseFloat(waitField.value);
      const plan_space = planSpaceCartesian.checked ? 'Cartesian' : 'Joint';

      // Log other input values
      console.log('Speed:', speed);
      console.log('Acceleration:', acceleration);
      console.log('Wait:', wait);
      console.log('Plan Space:', plan_space);

      // Validate the input
      if (!name || isNaN(speed) || isNaN(acceleration) || isNaN(wait)) {
        alert('Please fill all fields with valid values.');
        return;
      }

      try {
        // Send the data to the backend
        console.log('Sending data to backend...');
        const response = await fetch('http://localhost:3001/save-path', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, speed, acceleration, wait, plan_space }),
        });

        if (response.ok) {
          console.log('Path saved successfully');
          // Publish the name to the /path_data topic
          const pathMessage = new ROSLIB.Message({
            data: name,
          });
          pathPublisher.publish(pathMessage);
          console.log(`Published "${name}" to /path_data topic.`);
          // alert('Path saved successfully!');
        } else {
          console.error('Failed to save path');
          alert('Failed to save path.');
        }
      } catch (error) {
        console.error('Error:', error);
        alert('An error occurred while saving the path.');
      }

      // Clear the input fields and close the popup
      pathNameField.value = '';
      speedField.value = '';
      accelerationField.value = '';
      waitField.value = '';
      popup3.style.display = 'none';
      console.log('Popup closed and fields cleared');
    });

    // Handle Cancel Button in Save Path Popup
    pathCancelButton.addEventListener('click', function (event) {
      event.preventDefault(); // Prevent form submission
      console.log('Cancel button clicked');

      // Clear the input fields and close the popup
      pathNameField.value = '';
      speedField.value = '';
      accelerationField.value = '';
      waitField.value = '';
      popup3.style.display = 'none';
      console.log('Popup closed and fields cleared');
    });
  } else {
    console.error('One or more elements are missing in the DOM');
  }
});


const executeTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/ui_commands',
  messageType: 'std_msgs/String'
});
const executeLastTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/execute_last',
  messageType: 'std_msgs/String'
});
const deleteLastPointTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/delete_last_point',
  messageType: 'std_msgs/Bool'
});
const deleteLastPathTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/delete_last_path',
  messageType: 'std_msgs/Bool'
});



const deleteAllPointTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/delete_all_point',
  messageType: 'std_msgs/Bool'
});
const deleteAllPathTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/delete_all_path',
  messageType: 'std_msgs/Bool'
});


const deleteAllPointButton = document.getElementById('deleteAllPoint');
deleteAllPointButton.addEventListener('click', () => {

  const message = new ROSLIB.Message({
    data: true
  });

  deleteAllPointTopic.publish(message);

  console.log('Published message to /delete_all_point: true');
});

const deleteAllPathButton = document.getElementById('deleteAllPath');
deleteAllPathButton.addEventListener('click', () => {

  const message = new ROSLIB.Message({
    data: true
  });

  deleteAllPathTopic.publish(message);

  console.log('Published message to /delete_all_path: true');
});


// const executeSlowButton = document.getElementById('executeSlowButton');
// executeSlowButton.addEventListener('click', () => {
//   const messageContent = 'execute_slow';

//   const message = new ROSLIB.Message({
//     data: messageContent
//   });

//   executeTopic.publish(message);

//   console.log(`Published message: ${messageContent}`);
// });

const executeButton = document.getElementById('execute');
executeButton.addEventListener('click', () => {
  const messageContent = 'execute';

  const message = new ROSLIB.Message({
    data: messageContent
  });

  executeTopic.publish(message);

  console.log(`Published message: ${messageContent}`);
});
const executeLastButton = document.getElementById('executeLastButton');
executeLastButton.addEventListener('click', () => {
  const messageContent = 'execute_last';

  const message = new ROSLIB.Message({
    data: messageContent
  });

  executeLastTopic.publish(message);

  console.log(`Published message: ${messageContent}`);
});
const deleteLastPointButton = document.getElementById('deleteLastPoint');
deleteLastPointButton.addEventListener('click', () => {

  const message = new ROSLIB.Message({
    data: true
  });

  deleteLastPointTopic.publish(message);

  console.log('Published message to /delete_last_point: true');
});
const deleteLastPathButton = document.getElementById('deleteLastPath');
deleteLastPathButton.addEventListener('click', () => {

  const message = new ROSLIB.Message({
    data: true
  });

  deleteLastPathTopic.publish(message);

  console.log('Published message to /delete_last_path: true');
});

async function updateButtons() {
  try {
    const response = await fetch('http://localhost:3001/update-buttons'); // Correct URL
    const data = await response.json();

    // Update Point Segments
    document.getElementById('itemListPoint').innerHTML = data.pointButtons;

    // Update Path Segments
    document.getElementById('itemListPath').innerHTML = data.pathButtons;
  } catch (error) {
    console.error('Error updating buttons:', error);
  }
}

// Poll the server every 2 seconds
setInterval(updateButtons, 500);

// Initial call to load buttons
updateButtons();

// Subscribe to the /point_save_successfully topic
const pointSaveSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/point_save_successfully',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
pointSaveSuccessTopic.subscribe(function (message) {
  console.log('Received message on /point_save_successfully:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopup();
  }
});

// Function to show the popup
function showSuccessPopup() {
  const popup = document.getElementById('successPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}


// Subscribe to the /path_save_successfully topic
const pathSaveSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/path_save_successfully',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
pathSaveSuccessTopic.subscribe(function (message) {
  console.log('Received message on /path_save_successfully:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupPath();
  }
});

// Function to show the popup
function showSuccessPopupPath() {
  const popup = document.getElementById('pathsuccessPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}



// Subscribe to the /planning_successfully topic
const planSaveSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/planning_successful',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
planSaveSuccessTopic.subscribe(function (message) {
  console.log('Received message on /planning_successfully:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupPathPlan();
  }
});

// Function to show the popup
function showSuccessPopupPathPlan() {
  const popup = document.getElementById('plansuccessPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}


// Subscribe to the /delete_last_path_confirmation topic
const deleteLastPathSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/delete_last_path_confirmation',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
deleteLastPathSuccessTopic.subscribe(function (message) {
  console.log('Received message on /planning_successfully:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupDeleteLastPath();
  }
});

// Function to show the popup
function showSuccessPopupDeleteLastPath() {
  const popup = document.getElementById('deletelastpathsuccessPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}



// Subscribe to the /path_file_empty topic
const yamlFileEmptySuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/path_file_empty',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
yamlFileEmptySuccessTopic.subscribe(function (message) {
  console.log('Received message on /path_file_empty:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupYamlFileEmpty();
  }
});

// Function to show the popup
function showSuccessPopupYamlFileEmpty() {
  const popup = document.getElementById('pathfileemptysuccessPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}




// Subscribe to the /point_file_empty topic
const pointyamlFileEmptySuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/point_file_empty',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
pointyamlFileEmptySuccessTopic.subscribe(function (message) {
  console.log('Received message on /point_file_empty:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupPointYamlFileEmpty();
  }
});

// Function to show the popup
function showSuccessPopupPointYamlFileEmpty() {
  const popup = document.getElementById('pointfileemptysuccessPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}


// Subscribe to the /delete_last_point_confirmation topic
const deleteLastPointSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/delete_last_point_confirmation',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
deleteLastPointSuccessTopic.subscribe(function (message) {
  console.log('Received message on /delete_last_point_confirmation:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupDeleteLastPoint();
  }
});

// Function to show the popup
function showSuccessPopupDeleteLastPoint() {
  const popup = document.getElementById('deletelastpointsuccessPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}


// Subscribe to the /delete_all_path_confirmation topic
const deleteAllPathSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/delete_all_path_confirmation',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
deleteAllPathSuccessTopic.subscribe(function (message) {
  console.log('Received message on /delete_all_path_confirmation:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupDeleteAllPath();
  }
});

// Function to show the popup
function showSuccessPopupDeleteAllPath() {
  const popup = document.getElementById('deleteallpathsuccessPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}


// Subscribe to the /delete_all_point_confirmation topic
const deleteAllPointSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/delete_all_point_confirmation',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
deleteAllPointSuccessTopic.subscribe(function (message) {
  console.log('Received message on /delete_all_point_confirmation:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupDeleteAllPoint();
  }
});

// Function to show the popup
function showSuccessPopupDeleteAllPoint() {
  const popup = document.getElementById('deleteallpointsuccessPopup');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}



// Subscribe to the /yaml_points_check topic
const yamlPointsCheckSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/yaml_points_check',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
yamlPointsCheckSuccessTopic.subscribe(function (message) {
  console.log('Received message on /yaml_points_check:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupYamlChecksPoint();
  }
});

// Function to show the popup
function showSuccessPopupYamlChecksPoint() {
  const popup = document.getElementById('yamlpointscheck');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}




// Subscribe to the /plan_option_check topic
const planOptionCheckTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/plan_option',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
planOptionCheckTopic.subscribe(function (message) {
  console.log('Received message on /plan_option:', message.data);
  if (message.data === true) {
    // Show the success popup
    planOptionCheck();
  }
});

// Function to show the popup
function planOptionCheck() {
  const popup = document.getElementById('popup2');
  popup.style.display = 'block';
}


// Subscribe to the /planning_successfully topic
const planFailedSuccessTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/planning_successful',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
planFailedSuccessTopic.subscribe(function (message) {
  console.log('Received message on /planning_successfully:', message.data);
  if (message.data === false) {
    // Show the success popup
    showSuccessPopupPathFailed();
  }
});

// Function to show the popup
function showSuccessPopupPathFailed() {
  const popup = document.getElementById('planfail');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}


const inputs = document.querySelectorAll("#popup3 input");
const submitButton = document.getElementById("path_submit");

inputs.forEach(input => {
  input.addEventListener("input", () => {
    const allValid = Array.from(inputs).every(input => input.checkValidity());
    submitButton.disabled = !allValid;
  });
});





// Subscribe to the /on_successful_point topic
const wrongPositionPointTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/not_correct_position',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});

// Log subscription status
wrongPositionPointTopic.subscribe(function (message) {
  console.log('Received message on /not_correct_position:', message.data);
  if (message.data === false) {
    // Show the success popup
    showSuccessPopupPositionPointFailed();
  }
});

// Function to show the popup
function showSuccessPopupPositionPointFailed() {
  const popup = document.getElementById('jointpoint');

  // Ensure the popup is visible again before applying the animation
  popup.style.display = 'block'; // Show it again
  popup.classList.remove('show'); // Remove class to reset animation
  
  // Small timeout to ensure re-triggering
  setTimeout(() => {
    popup.classList.add('show'); // Add class to trigger animation
  }, 10);
}





// Subscribe to the /on_successful_point topic
const executeLastPathTopic = new ROSLIB.Topic({
  ros: ros,
  name: '/execute_last_success',
  messageType: 'std_msgs/Bool' // Assuming the topic publishes a Boolean message
});



//  Log subscription status
executeLastPathTopic.subscribe(function (message) {
  console.log('Received message on /execute_last_success:', message.data);
  if (message.data === true) {
    // Show the success popup
    showSuccessPopupExecuteLastPath();
  }
});

// Function to show the popup
function showSuccessPopupExecuteLastPath() {
  const popup = document.getElementById('executelast');
  popup.classList.add('show'); // Add 'show' class to trigger the transition

  // Hide the popup after 3 seconds (you can adjust this time)
  setTimeout(function () {
    popup.classList.remove('show'); // Remove the 'show' class to fade out
  }, 2000); // Popup will disappear after 3 seconds
}

