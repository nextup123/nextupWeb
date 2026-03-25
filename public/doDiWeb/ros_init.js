const ros = new ROSLIB.Ros({ url: 'ws://localhost:9090' });
const statusElem = document.getElementById('di_indicator_status');

ros.on('connection', () => {
    statusElem.textContent = 'Connected';
    statusElem.className = 'di-indicator-status connected';
});
ros.on('error', (err) => {
    statusElem.textContent = 'Error';
    statusElem.className = 'di-indicator-status error';
    console.error(err);
});
ros.on('close', () => {
    statusElem.textContent = 'Closed';
    statusElem.className = 'di-indicator-status closed';
});



// --- Subscriber for DO Topics ---
function subscribeToDOTopics() {
    for (let driver = 1; driver <= 6; driver++) {
        const doSub = new ROSLIB.Topic({
            ros,
            name: `/nextup_digital_output_controller_${driver}/commands`,
            messageType: 'nextup_joint_interfaces/NextupDigitalOutputs'
        });

        doSub.subscribe((msg) => {
            [1, 2, 3, 4].forEach((id) => {
                const field = `do${id}`;
                if (msg[field] && msg[field].length > 0) {
                    const state = !!msg[field][0];
                    const indicator = document.getElementById(`do_indicator_${driver}_${id}`);
                    const toggle = document.getElementById(`do_toggle_${driver}_${id}`);
                    if (indicator) {
                        indicator.classList.toggle('on', state);
                    }
                    if (toggle && !toggle.disabled) {
                        toggle.checked = state;
                    }
                }
            });
        });
    }
}

// --- Publish DO ---
function publishDO(driver, doId, state) {
    const topicName = `/nextup_digital_output_controller_${driver}/commands`;
    const digitalOutputTopic = new ROSLIB.Topic({
        ros,
        name: topicName,
        messageType: 'nextup_joint_interfaces/NextupDigitalOutputs'
    });
    const message = new ROSLIB.Message({
        do1: doId === 1 ? [state] : [],
        do2: doId === 2 ? [state] : [],
        do3: doId === 3 ? [state] : [],
        pi_p: doId === 4 ? [state] : []
    });
    digitalOutputTopic.publish(message);
}

// --- Toggle DO ---
function toggleDO(driver, doId) {
    const toggle = document.getElementById(`do_toggle_${driver}_${doId}`);
    const state = toggle.checked;
    publishDO(driver, doId, state);
}

// --- Build DI Table (8 x 6 grid) ---
const diTbody = document.getElementById('di_indicator_table_body');
const DI_ROWS = [
    'DI1',
    'DI2',
    'DI3',
    'DI4',
    'DI5',
    'DI6',
    'DI7',
    'DI8'
];

for (let di = 0; di < DI_ROWS.length; di++) {
    const row = document.createElement('tr');
    let html = `<td><b>${DI_ROWS[di]}</b></td>`;

    for (let drv = 1; drv <= 6; drv++) {
        const id = `di_indicator_${drv}_${di}`;
        html += `<td><div class="di-indicator-light" id="${id}"></div></td>`;
    }

    row.innerHTML = html;
    diTbody.appendChild(row);
}


// --- Subscriber for Digital Inputs ---
function subscribeToDITopic() {
    const sub = new ROSLIB.Topic({
        ros,
        name: '/nextup_digital_inputs',
        messageType: 'nextup_joint_interfaces/msg/NextupDigitalInputs'
    });

    sub.subscribe((msg) => {
        const jointCount = msg.name?.length || 0;   
        if (jointCount === 0) return;

        // Map rows → message arrays
        const diMap = [
            msg.di1,
            msg.di2,
            msg.di3,
            msg.di4,
            msg.di5,
            msg.sto1,
            msg.sto2,
            msg.edm
        ];

        for (let drv = 0; drv < jointCount; drv++) {
            for (let di = 0; di < diMap.length; di++) {
                const value = diMap[di]?.[drv];
                const indicator = document.getElementById(
                    `di_indicator_${drv + 1}_${di}`
                );

                if (!indicator || value === undefined) continue;

                indicator.classList.toggle('on', value === true);
            }
        }
    });
}

const allDiIndicators = [];

// Row order must match how the table was built
// 0: DI1, 1: DI2, 2: DI3, 3: DI4, 4: DI5, 5: STO1, 6: STO2, 7: EDM
const TOTAL_DI_ROWS = 8;
const TOTAL_DRIVERS = 6;

// Snake order: row-wise, driver-wise
for (let di = 0; di < TOTAL_DI_ROWS; di++) {
    for (let drv = 1; drv <= TOTAL_DRIVERS; drv++) {
        const el = document.getElementById(`di_indicator_${drv}_${di}`);
        if (el) {
            allDiIndicators.push(el);
        }
    }
}


// --- Boot Animation ---
function playBootAnimation(callback) {
    if (!allDiIndicators.length) {
        callback && callback();
        return;
    }

    const totalDuration = 1000; // 1 second
    const stepTime = totalDuration / allDiIndicators.length;

    allDiIndicators.forEach((ind, i) => {
        setTimeout(() => {
            ind.classList.add('on');

            setTimeout(() => {
                ind.classList.remove('on');
            }, stepTime * 0.8);

        }, i * stepTime);
    });

    // Run callback after animation finishes
    setTimeout(() => {
        callback && callback();
    }, totalDuration + 100);
}


// --- Start animation first, then subscribe ---
playBootAnimation(() => {
    subscribeToDITopic();
    subscribeToDOTopics();
});