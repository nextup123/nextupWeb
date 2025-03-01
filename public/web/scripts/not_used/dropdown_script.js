
// Create a ROS topic object for joint name publishing
var jointNamePublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/joint_name_spm',
    messageType: 'std_msgs/String'
});

// Function to publish the selected SPM
function publishJointName(jointName) {
    var message = new ROSLIB.Message({
        data: jointName
    });
    jointNamePublisher.publish(message);
    console.log("Published joint name:", jointName);
}

// Elements for dropdowns and display
const spmSelect = document.getElementById('spmSelect');
const selectedSpm = document.getElementById('selectedSpm');

const unitSelect = document.getElementById('unitSelect');
const selectedUnit = document.getElementById('selectedUnit');

// Function to update SPM options based on selected unit
function updateSpmOptions() {
    const unitValue = unitSelect.value;

    // Clear all existing options
    spmSelect.innerHTML = '';

    // Add a default "Select SPM" option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    defaultOption.textContent = 'Select SPM';
    spmSelect.appendChild(defaultOption);

    // Add appropriate options based on the selected unit
    if (unitValue === 'unit_1') {
        const spmOptions = ['joint_rs_1', 'joint_rc_1'];
        spmOptions.forEach(spm => {
            const option = document.createElement('option');
            option.value = spm;
            option.textContent = spm;
            spmSelect.appendChild(option);
        });
    } else if (unitValue === 'unit_2') {
        const spmOptions = ['joint_rs_2', 'joint_rc_2'];
        spmOptions.forEach(spm => {
            const option = document.createElement('option');
            option.value = spm;
            option.textContent = spm;
            spmSelect.appendChild(option);
        });
    }

    // Reset selected SPM text
    selectedSpm.textContent = 'Selected: None';
}

// Event listeners to update the SPM options when the unit changes
unitSelect.addEventListener('change', function() {
    console.log('Unit selected:', this.value);
    selectedUnit.textContent = 'Selected: ' + this.value;
    updateSpmOptions(); // Update SPM options based on the selected unit
});

// Log when the SPM selection changes and publish the joint name
spmSelect.addEventListener('change', function() {
    console.log('SPM selected:', this.value);
    selectedSpm.textContent = 'Selected: ' + this.value;
    publishJointName(this.value); // Publish the selected SPM
});

// Initial call to set the SPM options when the page loads
updateSpmOptions();
