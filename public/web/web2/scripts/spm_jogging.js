console.log("jogging..init..");

var initialPositionPublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/initial_position_spm',
    messageType: 'std_msgs/Bool'
})
var finalPositionPublisher = new ROSLIB.Topic({
    ros: ros,
    name: '/final_position_spm',
    messageType: 'std_msgs/Bool'
})

function publishInitialState() {
    // First part: Publish the initial state
    var msg = new ROSLIB.Message({
        data: true
    });

    initialPositionPublisher.publish(msg);
    console.log("Published InitialState: " + true);

    // Delay the second part by 200ms
    setTimeout(() => {
        const initalValue = initialPosition;
        const selectedValue = getSelectedOption();

        if (!selectedValue) {
            console.log("No option selected in the dropdown.");
            return;
        }

        let initialPositionParameterName;
        switch (selectedValue) {
            case 'joint_rs_1':
                initialPositionParameterName = 'rs_1_min_pos';
                break;
            case 'joint_rc_1':
                initialPositionParameterName = 'rc_1_min_pos';
                break;
            case 'joint_rs_2':
                initialPositionParameterName = 'rs_2_min_pos';
                break;
            case 'joint_rc_2':
                initialPositionParameterName = 'rc_2_min_pos';
                break;
            default:
                console.log("Unexpected dropdown value. No parameter updated.");
                return;
        }

        updateParameter(initialPositionParameterName, initalValue);
        console.log(`Updating ${initialPositionParameterName} to: ${initalValue}`);
    }, 200); 
}

function publishFinalState() {

    var msg = new ROSLIB.Message({
        data: true
    });

    finalPositionPublisher.publish(msg);
    console.log("Published FinalState : " + true);

    setTimeout(() => {
        const finalValue = finalPosition;
        // const dropdown = document.getElementById('spmSelect');
        // const selectedValue = dropdown.value;
        const selectedValue = getSelectedOption();

        if (!selectedValue) {
            console.log("No option selected in the dropdown.");
            return;
        }

        let finalPositionParameterName;
        switch (selectedValue) {
            case 'joint_rs_1':
                finalPositionParameterName = 'rs_1_max_pos';
                break;
            case 'joint_rc_1':
                finalPositionParameterName = 'rc_1_max_pos';
                break;
            case 'joint_rs_2':
                finalPositionParameterName = 'rs_2_max_pos';
                break;
            case 'joint_rc_2':
                finalPositionParameterName = 'rc_2_max_pos';
                break;
            default:
                console.log("Unexpected dropdown value. No parameter updated.");
                return;
        }

        updateParameter(finalPositionParameterName, finalValue);
        console.log(`Updating ${finalPositionParameterName} to: ${finalValue}`);
    }, 200);     
}
