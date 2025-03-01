const menuContainer = document.querySelector('.menu-container');
const menuBox = document.querySelector('.menu-box');
const options = document.querySelectorAll('.option');
let selectedOption = null; // Variable to track the selected option

function toggleMenu() {
  if (menuContainer.classList.contains('active')) {
    resetMenu();
  } else {
    menuContainer.classList.add('active');
  }
}

function handleOption(option) {
  // Update button text
  menuBox.textContent = `Selected ${option}`;
  console.log(`Selected ${option}`);
  publishJointName(option);
  
  // Update the selectedOption variable
  selectedOption = option;

  // Reset options
  resetMenu();
}

function resetMenu() {
  menuContainer.classList.remove('active');
  // Reset button text if no option is selected
  if (!menuBox.textContent.startsWith('Selected')) {
    menuBox.textContent = 'Select SPM';
  }
}

// Function to get the currently selected option
function getSelectedOption() {
  return selectedOption;
}
