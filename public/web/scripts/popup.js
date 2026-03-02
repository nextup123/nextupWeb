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
  
  // for plan space
  const cartesianButton = document.getElementById('cartesian');
  const jointButton = document.getElementById('joint');
  const cartesianRadio = document.getElementById('cartesianradio');
  const jointRadio = document.getElementById('jointradio');
  const savePathButton = document.getElementById('path');
  
  let selectedValue = null; // Default koi bhi select nahi
  
  // Selection function
  function selectOption(selected, unselected, value) {
      if (selectedValue === value) return;
  
      selected.classList.add('selected');
      unselected.classList.remove('selected');
      selectedValue = value;
  
      storeValue(selectedValue);
  }
  
  // Store in localStorage
  function storeValue(value) {
      localStorage.setItem('selectedPlanSpace', value);
      console.log('Selected Value:', value === 1 ? 'Cartesian' : 'Joint');
  }
  
  // Restore selection only if value exists
  function restoreSelectedPlanSpace() {
      const storedValue = localStorage.getItem('selectedPlanSpace');
  
      if (storedValue) {
          if (storedValue === '1') {
              selectOption(cartesianRadio, jointRadio, 1);
          } else if (storedValue === '2') {
              selectOption(jointRadio, cartesianRadio, 2);
          }
      }
  }
  
  // Button click events
  cartesianButton.addEventListener('click', function () {
      selectOption(cartesianRadio, jointRadio, 1);
  });
  
  jointButton.addEventListener('click', function () {
      selectOption(jointRadio, cartesianRadio, 2);
  });

 
  // Restore selection when Save Path button is clicked
  savePathButton.addEventListener('click', function () {
      restoreSelectedPlanSpace();
  });
  
  //
  // Save Path Functionality
  //const savePathButton = document.getElementById('path');
  const popup3 = document.getElementById('popup3');
  const pathNameField = document.getElementById('name_path');
  const speedField = document.getElementById('speed');
  const accelerationField = 1;
  const waitField = document.getElementById('wait_time');
  //const planSpaceCartesian = document.querySelector('input[value="1"]');
  //const planSpaceJoint = document.querySelector('input[value="2"]');
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
     // const plan_space = planSpaceCartesian.checked ? 'Cartesian' : 'Joint';
     const plan_space = selectedValue === 1 ? 'Cartesian' : 'Joint';

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
      speedField.value = '1';
      accelerationField.value = '';
      waitField.value = '0';
      popup3.style.display = 'none';
      console.log('Popup closed and fields cleared');
    });

    // Handle Cancel Button in Save Path Popup
    pathCancelButton.addEventListener('click', function (event) {
      event.preventDefault(); // Prevent form submission
      console.log('Cancel button clicked');

      // Clear the input fields and close the popup
      pathNameField.value = '';
      speedField.value = '1';
      accelerationField.value = '';
      waitField.value = '0';
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

// async function updateButtons() {
//   try {
//     const response = await fetch('http://localhost:3001/update-buttons'); // Correct URL
//     const data = await response.json();

//     // Update Point Segments
//     document.getElementById('itemListPoint').innerHTML = data.pointButtons;

//     // Update Path Segments
//     document.getElementById('itemListPath').innerHTML = data.pathButtons;
//   } catch (error) {
//     console.error('Error updating buttons:', error);
//   }
// }

// Poll the server every 2 seconds
setInterval(updateButtons, 500);

// Initial call to load buttons
updateButtons();


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

//function for add default value one in velocity

function handleVelocityInput(input) {
  let value = parseFloat(input.value);
  
  // Allow input to be empty, otherwise validate it
  if (input.value === "") return;

  // Check if the value is within the range 0.1 to 1.5
  if (isNaN(value) || value < 0.1) {
      input.value = 0.1; // Set minimum value to 0.1
  } else if (value > 1.5) {
      input.value = 1.5; // Set maximum value to 1.5
  }
}

// If the user leaves the field empty, reset it to 1
function resetIfEmpty(input) {
  if (input.value.trim() === "") {
      input.value = 1;
  }
}


// function for disable -ve value in wait_time and default ZERO

document.getElementById("wait_time").addEventListener("keydown", function (event) {
  // Prevent negative values
  if (event.key === "-") {
      event.preventDefault();
  }
});

function handleWaitTime(input) {
  let value = input.value;

  // Allow user to delete the value and enter a new one
  if (value === "") return;

  // If the entered value is not a number, reset to 0
  if (isNaN(value) || parseFloat(value) < 0) {
      input.value = 0;
  }
}

// If the user leaves the field empty, reset it to 0
function resetIfEmpty(input) {
  if (input.value.trim() === "") {
      input.value = 0;
  }
}

/* function close popup plan */
function closePopup(){
  document.getElementById("popup2").style.display = "none";
}



