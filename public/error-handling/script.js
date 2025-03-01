document.addEventListener('DOMContentLoaded', function () {
    const ros = new ROSLIB.Ros({
        url: 'ws://localhost:9090'
    });

    const errorSubscriber = new ROSLIB.Topic({
        ros: ros,
        name: '/error_code',
        messageType: 'std_msgs/Int32MultiArray'
    });

    const logsListener = new ROSLIB.Topic({
        ros: ros,
        name: '/logs_topic',
        messageType: 'std_msgs/String'
    });

    let errorData = [];
    let currentErrors = [];
    let isTerminalPaused = false;
    let pausedLogs = [];

    // Fetch error data
    fetch('/error-handling/errors/')
        .then(response => response.json())
        .then(data => {
            errorData = data;
            console.log('Loaded error data:', errorData);
        })
        .catch(error => {
            console.error('Error loading error data:', error);
        });

    // Handle error messages
    errorSubscriber.subscribe(debounce(function (message) {
        console.log('Received error codes:', message.data);

        const errorCodes = message.data;
        const newErrors = [];

        errorCodes.forEach((code, index) => {
            if (code !== 0) {
                const error = getErrorInfo(code);
                newErrors.push({
                    joint: index + 1,
                    ...error
                });
            }
        });

        if (!areErrorsEqual(newErrors, currentErrors)) {
            currentErrors = newErrors;
            updateErrorTable(currentErrors);
        }
    }, 100));

    // Handle terminal logs
    logsListener.subscribe((message) => {
        const timestamp = getCurrentTimestamp(); // Capture timestamp at arrival
        const logEntry = {
            time: timestamp,
            data: message.data
        };

        if (isTerminalPaused) {
            pausedLogs.push(logEntry); // Store logs with timestamp
        } else {
            displayLog(logEntry);
        }
    });

    // Function to display a log message
    function displayLog(logEntry) {
        const terminalDisplay = document.getElementById('terminal-display');
        const logLine = document.createElement('div');
        logLine.innerHTML = `<span class='timestamp'>${logEntry.time}</span> ${logEntry.data}`;
        terminalDisplay.appendChild(logLine);
        terminalDisplay.scrollTop = terminalDisplay.scrollHeight;
    }

    // Function to get current time in HH:MM:SS format
    function getCurrentTimestamp() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    // Clear terminal button
    document.getElementById('clear-terminal').addEventListener('click', () => {
        document.getElementById('terminal-display').innerHTML = '';
    });

    // Pause terminal button
    document.getElementById('pause-terminal').addEventListener('click', () => {
        isTerminalPaused = true;
        document.getElementById('pause-terminal').disabled = true;
        document.getElementById('play-terminal').disabled = false;
    });

    // Play terminal button
    document.getElementById('play-terminal').addEventListener('click', () => {
        isTerminalPaused = false;
        document.getElementById('pause-terminal').disabled = false;
        document.getElementById('play-terminal').disabled = true;

        // Flush paused logs to the terminal with timestamps
        pausedLogs.forEach(logEntry => displayLog(logEntry));
        pausedLogs = [];
    });

    // Helper functions
    function getErrorInfo(errorCode) {
        return errorData.find(e => e.error === errorCode.toString()) || {
            error_code: "Unknown",
            error_Content: "No content available",
            error_Cause: ["No cause available"],
            error_Diagnosis: ["No diagnosis available"],
            error_Solution: ["No solution available"]
        };
    }

    let errorTimestamps = {}; // Stores timestamps for each error
    let previousErrors = {}; // Tracks previous error states

    function updateErrorTable(errors) {
        const tableBody = document.querySelector('#error-table tbody');
        const noErrorsRow = document.getElementById('no-errors-row');
        tableBody.innerHTML = '';

        // If there are no errors, reset previousErrors and show "No Errors Available"
        if (errors.length === 0) {
            previousErrors = {}; // Clear previous errors
            errorTimestamps = {}; // Reset timestamps
            if (noErrorsRow) noErrorsRow.style.display = 'table-row';
            return;
        }

        if (noErrorsRow) noErrorsRow.style.display = 'none';

        const currentErrors = {}; // Track active errors

        errors.forEach(error => {
            const errorKey = `${error.joint}-${error.error_code}`;

            // Reset timestamp if the error was previously gone and now reappears
            if (!previousErrors[errorKey]) {
                errorTimestamps[errorKey] = getCurrentTimestamp();
            }

            currentErrors[errorKey] = true; // Mark error as active

            const row = document.createElement('tr');
            row.classList.add('expandable-row');
            row.innerHTML = `
                <td>${error.joint}</td>
                <td>${error.error_code}</td>
                <td>${error.error_Content}</td>
                <td>${errorTimestamps[errorKey]}</td> 
                <td class="actions">
                    <button class="btn expand-btn">Expand</button>
                </td>
            `;

            const expandableContent = document.createElement('tr');
            expandableContent.classList.add('expandable-content');
            expandableContent.innerHTML = `
                <td colspan="5">
                    <table class="nested-table">
                        <thead>
                            <tr>
                                <th>Cause</th>
                                <th>Diagnosis</th>
                                <th>Solution</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${error.error_Cause.map((cause, index) => `
                                <tr>
                                    <td>${cause}</td>
                                    <td>${error.error_Diagnosis[index] || '/'}</td>
                                    <td>${error.error_Solution[index] || '/'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </td>
            `;

            const expandBtn = row.querySelector('.expand-btn');
            expandBtn.addEventListener('click', () => {
                const isExpanded = expandableContent.classList.toggle('show');
                expandBtn.textContent = isExpanded ? "Collapse" : "Expand";
            });

            tableBody.appendChild(row);
            tableBody.appendChild(expandableContent);
        });

        // Remove timestamps of errors that no longer exist
        Object.keys(errorTimestamps).forEach(key => {
            if (!currentErrors[key]) {
                delete errorTimestamps[key];
            }
        });

        // Update previousErrors to match current errors
        previousErrors = currentErrors;
    }

    // Function to get current time in HH:MM:SS format
    function getCurrentTimestamp() {
        const now = new Date();
        return now.toLocaleTimeString(); // Format: HH:MM:SS
    }



    function areErrorsEqual(errors1, errors2) {
        if (errors1.length !== errors2.length) return false;
        const errorSet1 = new Set(errors1.map(e => `${e.error_code}-${e.joint}`));
        const errorSet2 = new Set(errors2.map(e => `${e.error_code}-${e.joint}`));
        return errorSet1.size === errorSet2.size && [...errorSet1].every(e => errorSet2.has(e));
    }

    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function updateClock() {
        const clockElement = document.getElementById('digital-clock');
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0'); // 24-hour format
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }


    setInterval(updateClock, 1000);
    updateClock(); // Initialize immediately

});
