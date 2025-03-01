const labelBox = document.querySelector('.label-box');
const loadingBar = document.querySelector('.loading-bar');
const unitButtons = document.querySelectorAll('.unit-button');

function initHoming(unit) {
  labelBox.querySelector('span').textContent = `${unit} homing init.`;

  loadingBar.style.width = '100%';

  const button = document.querySelector(`.unit-button.${unit.toLowerCase().replace(' ', '')}`);
  button.classList.add('loading');

  unitButtons.forEach(btn => btn.style.pointerEvents = 'none');
  
  setTimeout(() => {
    labelBox.querySelector('span').textContent = 'HOMING';
    loadingBar.style.width = '0%';  // Reset loading bar
    button.classList.remove('loading');
    unitButtons.forEach(btn => btn.style.pointerEvents = 'auto');
  }, 1000);
}


console.log("homming..init..");



// // Create a ROS topic object
// var homingStatusPublisher = new ROSLIB.Topic({
//   ros: ros,
//   name: '/do_homing_spm',
//   messageType: 'std_msgs/String'
// });

// // Function to publish the homing status
// function publishHomingStatus(status) {
//   var message = new ROSLIB.Message({ data: status });
//   homingStatusPublisher.publish(message);
//   console.log("Published:", status);
// }

// // Function to handle homing actions
// function handleHomingAction(status) {
//   publishHomingStatus(status);
// }
// // Add event listeners for the buttons
// document.getElementById('homing-unit-1').addEventListener('click', () => publishHomingStatus("SPM1"));
// // document.getElementById('homing-unit-1').addEventListener('click', () => publishHomingStatus("BOTH"));
// document.getElementById('homing-unit-2').addEventListener('click', () => publishHomingStatus("SPM2"));


