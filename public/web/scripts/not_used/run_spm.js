
const topic = new ROSLIB.Topic({
    ros: ros,
    name: '/run_spm',
    messageType: 'std_msgs/String'
});

const state = {
    spm1: false,
    spm2: false
};

function toggleSPM(spm) {
    const button = document.getElementById(`button${spm === 'spm_1' ? '1' : '2'}`);
    state[spm] = !state[spm];

    const message = new ROSLIB.Message({
        data: state[spm] ? `start_${spm}` : `stop_${spm}`
    });

    topic.publish(message);
    console.log(message);
    
    button.textContent = state[spm] ? `Stop ${spm.toUpperCase().replace('SPM', 'SPM ')}` : `Run ${spm.toUpperCase().replace('SPM', 'SPM ')}`;
}