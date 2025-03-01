// const itemList = document.getElementById('itemList');
// const addButton = document.getElementById('add_path');
// let itemCount = 0;

// // Add Path with SweetAlert2 Prompt
// addButton.addEventListener('click', () => {
//     Swal.fire({
//         title: 'Enter Path Name',
//         input: 'text',
//         inputPlaceholder: 'Path name',
//         confirmButtonText: 'Submit',
//         showCancelButton: true,
//         inputValidator: (value) => {
//             return !value ? 'Please enter a path name!' : null;
//         }
//     }).then((result) => {
//         if (result.isConfirmed) {
//             const pathName = result.value || 'path'; // Default to "path" if empty
//             itemCount++;
//             const itemDiv = document.createElement('div');
//             itemDiv.classList.add('path-item');
//             itemDiv.textContent = `${itemCount} : ${pathName}`;
//             itemList.appendChild(itemDiv);
//         }
//     });
// });

// // Clear Last Path
// document.getElementById('clear_last').addEventListener('click', () => {
//     const items = itemList.getElementsByClassName('path-item');
//     if (items.length > 0) {
//         itemList.removeChild(items[items.length - 1]);
//         itemCount--; // Adjust item count when removing an item
//     }
// });

// // Clear All Paths
// document.getElementById('clear_all').addEventListener('click', () => {
//     itemList.innerHTML = ''; // Clear all items
//     itemCount = 0; // Reset item count
// });
