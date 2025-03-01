

function boolControlledIndicator(boolTopicName, customMessageType, indicatorId) {
    const boolTopic = new ROSLIB.Topic({
        ros: ros,
        name: boolTopicName,
        messageType: customMessageType,
    });

    boolTopic.subscribe((message) => {

        document.getElementById(indicatorId).className = message.data
            ? 'indicator indicator-true'
            : 'indicator indicator-false';

    });
}
function nextupBoolControlledIndicator(boolTopicName, customMessageType, indicatorId, gpio) {
    const boolTopic = new ROSLIB.Topic({
        ros: ros,
        name: boolTopicName,
        messageType: customMessageType,
    });
    boolTopic.subscribe((message) => {
        if (gpio == 1) {
            do_reading = message.do1[0];
        }
        else if (gpio == 3) {
            do_reading = message.do3[0];
        }

        document.getElementById(indicatorId).className = do_reading
            ? 'indicator indicator-true'
            : 'indicator indicator-false';

    });
}


boolControlledIndicator('/camera_status', 'std_msgs/Bool', 'camera-indicator');
boolControlledIndicator('/digital_indicator_status', 'std_msgs/Bool', 'digital-indicator-indicator');

boolControlledIndicator('/led_two', 'std_msgs/Bool', 'spm2-led-op');

nextupBoolControlledIndicator('/nextup_digital_output_controller_1/commands',
    'nextup_joint_interfaces/msg/NextupDigitalOutputs',
    'gripper-one-indicator',
    1
);

nextupBoolControlledIndicator('/nextup_digital_output_controller_1/commands',
    'nextup_joint_interfaces/msg/NextupDigitalOutputs',
    'gripper-two-indicator',
    3
);

nextupBoolControlledIndicator('/nextup_digital_output_controller_4/commands',
    'nextup_joint_interfaces/msg/NextupDigitalOutputs',
    'cnc1-running-status-indicator',
    1
);

nextupBoolControlledIndicator('/nextup_digital_output_controller_4/commands',
    'nextup_joint_interfaces/msg/NextupDigitalOutputs',
    'cnc2-running-status-indicator',
    3
);

nextupBoolControlledIndicator('/nextup_digital_output_controller_5/commands',
    'nextup_joint_interfaces/msg/NextupDigitalOutputs',
    'pneumatic-indicator',
    1
);



const proximityListener = new ROSLIB.Topic({
    ros: ros,
    name: '/digital_input_bits',
    messageType: 'std_msgs/msg/Int32MultiArray'
});


let cnc1_fault_error = false;
let cnc1auto_mode_error = true;
let cnc_id_od_status = false;

proximityListener.subscribe((message) => {
    const capAvailability = message.data[0];

    const cnc1chuck = message.data[1];
    const cnc1running = message.data[2];
    const cnc1auto_mode = message.data[3];
    const cnc1_fault = message.data[4];

    // const cnc1door_feedback = message.data[5];
    const cnc1door_open = message.data[6];
    const cnc1door_close = message.data[7];
    const cnc1chuck_id_od = message.data[8];

    // const cnc2chuck = message.data[4];
    // const cnc2running = message.data[5];
    // const cnc2door = message.data[6];

    cnc1_fault_error = message.data[4];
    cnc1auto_mode_error = message.data[3];
    cnc_id_od_status = message.data[8];

    if (capAvailability === 0) {
        document.getElementById('cap-availability-indicator').className = 'indicator indicator-false';

    } else if (capAvailability === 1) {
        document.getElementById('cap-availability-indicator').className = 'indicator indicator-true';
    }


    if (cnc1chuck === 0) {
        document.getElementById('cnc1-chuck-status-indicator').className = 'indicator indicator-false';
    } else if (cnc1chuck === 1) {
        document.getElementById('cnc1-chuck-status-indicator').className = 'indicator indicator-true';
    }

    if (cnc1running === 0) {
        document.getElementById('cnc1-running-status-indicator').className = 'indicator indicator-false';
    } else if (cnc1running === 1) {
        document.getElementById('cnc1-running-status-indicator').className = 'indicator indicator-true';
    }

    if (cnc1door_open === 0 && cnc1door_close === 1) {
        document.getElementById('cnc1-door-status-indicator').className = 'indicator indicator-false';
    } else if (cnc1door_open === 1 && cnc1door_close === 0) {
        document.getElementById('cnc1-door-status-indicator').className = 'indicator indicator-true';
    }

    if (cnc1auto_mode === 0) {
        document.getElementById('cnc1-automode-status-indicator').className = 'indicator indicator-false';
    } else if (cnc1auto_mode === 1) {
        document.getElementById('cnc1-automode-status-indicator').className = 'indicator indicator-true';
    }

    if (cnc1_fault === 0) {
        document.getElementById('cnc1-fault-status-indicator').className = 'indicator indicator-true';
    } else if (cnc1_fault === 1) {
        document.getElementById('cnc1-fault-status-indicator').className = 'indicator indicator-false';
    }
    if (cnc1chuck_id_od === 0) {
        document.getElementById('cnc1-chuck-id_od-indicator').className = 'indicator indicator-false';
    } 
    else if (cnc1chuck_id_od === 1) {
        document.getElementById('cnc1-chuck-id_od-indicator').className = 'indicator indicator-true';
    }
    
    // if (cnc2chuck === 0) {
    //     document.getElementById('cnc2-chuck-status-indicator').className = 'indicator indicator-false';
    //   } else if (cnc2chuck === 1) {
    //     document.getElementById('cnc2-chuck-status-indicator').className = 'indicator indicator-true';
    //   }
    //   if (cnc2running === 0) {
    //     document.getElementById('cnc2-running-status-indicator').className = 'indicator indicator-false';
    //   } else if (cnc2running === 1) {
    //     document.getElementById('cnc2-running-status-indicator').className = 'indicator indicator-true';
    //   }
    //   if (cnc2door === 0) {
    //     document.getElementById('cnc2-door-status-indicator').className = 'indicator indicator-false';
    //   } else if (cnc2door === 1) {
    //     document.getElementById('cnc2-door-status-indicator').className = 'indicator indicator-true';
    //   }


});



//robot-error-status-indicator

// camera-indicator
// digital-indicator-indicator
// gripper-one-indicator
// gripper-two-indicator
// cap-availability-indicator
// pneumatic-indicator


// cnc1-chuck-status-indicator
// cnc1-running-status-indicator
// cnc1-door-status-indicator
// cnc1-fault-status-indicator
// cnc1-automode-status-indicator


// cnc2-chuck-status-indicator
// cnc2-running-status-indicator
// cnc2-door-status-indicator