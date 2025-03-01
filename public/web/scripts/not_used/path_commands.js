// const itemList = document.getElementById('itemList');
// // const addButton = document.getElementById('add_path');

// let itemCount = 0;

// // addButton.addEventListener('pointerdown', function() {
// //     Swal.fire({
// //         title: 'Enter Path Name',
// //         input: 'text',
// //         inputPlaceholder: 'Path name',
// //         confirmButtonText: 'Submit',
// //         showCancelButton: true,
// //         background: '#2b0119',
// //         color: '#ffffff',
// //         confirmButtonColor: '#ff8c00',
// //         inputValidator: (value) => {
// //             return !value ? 'Please enter a path name!' : null;
// //         }
// //     }).then((result) => {
// //         if (result.isConfirmed) {
// //             const pathName = result.value.trim() || 'path';
// //             const message = `add_path@${pathName}`;
// //             ros2Publish(message);

// //             // Increment the item count for a new path
// //             itemCount++;
            
// //             // Create a new button for the path
// //             const itemButton = document.createElement('button');
// //             itemButton.classList.add('path-item');
// //             itemButton.textContent = `${itemCount} : ${pathName}`;
            
// //             // Store path number and name in the button's dataset
// //             itemButton.dataset.pathNumber = itemCount;
// //             itemButton.dataset.pathName = pathName;

// //             // Add click event for the button
// //             itemButton.addEventListener('click', function() {
// //                 const pathNumber = itemButton.dataset.pathNumber;
// //                 const pathName = itemButton.dataset.pathName;
                
// //                 // SweetAlert asking if user wants to go to the selected path
// //                 Swal.fire({
// //                     title: `Do you wish to go to ${pathName} position?`,
// //                     showCancelButton: true,
// //                     confirmButtonText: 'Yes',
// //                     cancelButtonText: 'No',
// //                     background: '#2b0119',
// //                     color: '#ffffff',
// //                     confirmButtonColor: '#ff8c00',
// //                     cancelButtonColor: '#ff8c00'
// //                 }).then((result) => {
// //                     if (result.isConfirmed) {
// //                         // Publish message to /ui_commands with the exact path number and name
// //                         const message = `get_last_pose@${pathNumber}_${pathName}`;
// //                         ros2Publish(message);
// //                         Swal.fire({
// //                             title: 'Moving to position',
// //                             text: `You are now moving to ${pathName} position.`,
// //                             icon: 'success',
// //                             showConfirmButton: false,  // Hide confirm button
// //                             timer: 800  // Automatically close after 500ms
// //                         });
                        
// //                     } else {
// //                         Swal.fire({
// //                             title: 'Cancelled',
// //                             text: 'Movement to position cancelled.',
// //                             icon: 'info',
// //                             showConfirmButton: false, 
// //                             timer: 800  
// //                         });
// //                     }
// //                 });
// //             });

// //             // Append the new button to the list
// //             itemList.appendChild(itemButton);
// //         }
// //     });
// // });

// // Clear Last Path
// document.getElementById('clear_last').addEventListener('click', () => {
//     const items = itemList.getElementsByClassName('path-item');
//     if (items.length > 0) {
//         itemList.removeChild(items[items.length - 1]);
//         itemCount--;
//     }
// });

// // Clear All Paths
// document.getElementById('clear_all').addEventListener('click', () => {
//     itemList.innerHTML = '';
//     itemCount = 0;
// });

// document.getElementById('clear_last').addEventListener('pointerdown', function() {
//     ros2Publish(`clear_last`);
// });

// document.getElementById('clear_all').addEventListener('pointerdown', function() {
//     ros2Publish(`clear_all`);
// });
// document.getElementById('execute').addEventListener('pointerdown', function() {
//     ros2Publish(`execute`);
// });

// document.getElementById('repeat').addEventListener('pointerdown', function () {
//     Swal.fire({
//         title: 'Repeat Command',
//         input: 'number',
//         inputLabel: 'How many times do you want to repeat?',
//         inputPlaceholder: 'Enter a number',
//         showCancelButton: true,
//         confirmButtonText: 'Submit',
//         cancelButtonText: 'Cancel',
//         background: '#2b0119',
//         color: '#ffffff',
//         confirmButtonColor: '#ff8c00',
//         inputAttributes: {
//             min: 1,
//             style: 'text-align: center; color: teal;'
//         }
//     }).then((result) => {
//         if (result.isConfirmed && result.value) {
//             ros2Publish(`repeat${result.value}`);
//         } else if (result.dismiss === Swal.DismissReason.cancel) {
//             Swal.fire('Cancelled', 'Repeat command was cancelled.', 'info');
//         }
//     });
// });

// document.getElementById('default').addEventListener('pointerdown', function() {
//     ros2Publish(`default`);
// });
