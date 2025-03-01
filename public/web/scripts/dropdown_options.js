const inputField = document.getElementById('name_path');
const optionsList = document.getElementById('optionsList');
const hoverText = document.getElementById('hoverText');

// Show options list and position it beside the input field
function showOptions() {
    const rect = inputField.getBoundingClientRect();
    optionsList.style.left = `${rect.right + 10}px`; // Position to the right of the input field
    optionsList.style.top = `${rect.top}px`; // Align vertically with the input field
    optionsList.style.display = 'block';
}

// Hide options list when the mouse leaves the input or options
function hideOptions() {
        optionsList.style.display = 'none';
     
}

// Keep the options visible when hovering over the options list
function keepOptionsVisible() {
    optionsList.style.display = 'block';
}

// Show hover text for each option
function showText(text) {
    hoverText.textContent = text;
}

// Clear hover text when mouse leaves an option
function hideText() {
    hoverText.textContent = '';
}

// Set the input value when an option is selected
function selectOption(option) {
    inputField.value = option;
    hideOptions();
}