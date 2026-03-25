 // DOM elements
        const path_testing_modal = document.getElementById('path_testing_modal');
        const path_testing_btn = document.getElementById('path_testing_btn');
        const path_testing_close = document.getElementsByClassName('path_testing_close')[0];
        const path_testing_pathList = document.getElementById('path_testing_pathList');
        const path_testing_restartBtn = document.getElementById('path_testing_restartBtn');
        const path_testing_runNextBtn = document.getElementById('path_testing_runNextBtn');
        const path_testing_nextPathName = document.getElementById('path_testing_nextPathName');
        const path_testing_statusIndicator = document.getElementById('path_testing_statusIndicator');
        const path_testing_statusText = document.getElementById('path_testing_statusText');
        const path_testing_velocityInput = document.getElementById('path_testing_velocityInput');
        const path_testing_alertPopup = document.getElementById('path_testing_alertPopup');
        const path_testing_alertMessage = document.getElementById('path_testing_alertMessage');
        const path_testing_alertOkBtn = document.getElementById('path_testing_alertOkBtn');

        // ROS Topics (unchanged as requested)
        const startCommandPub = new ROSLIB.Topic({
            ros: ros,
            name: '/path_testing_start_command',
            messageType: 'std_msgs/Bool'
        });

        const runNextPathPub = new ROSLIB.Topic({
            ros: ros,
            name: '/path_testing_run_next_path',
            messageType: 'std_msgs/Bool'
        });

        const velocityPub = new ROSLIB.Topic({
            ros: ros,
            name: '/path_testing_velocity',
            messageType: 'std_msgs/Float32'
        });

        const pathNamesSub = new ROSLIB.Topic({
            ros: ros,
            name: '/read_paths_from_yaml_file',
            messageType: 'std_msgs/String'
        });

        const nextPathNameSub = new ROSLIB.Topic({
            ros: ros,
            name: '/path_testing_next_path_name',
            messageType: 'std_msgs/String'
        });

        const runningStatusSub = new ROSLIB.Topic({
            ros: ros,
            name: '/running_path_status',
            messageType: 'std_msgs/String'
        });

        // State variables
        let path_testing_paths = [];
        let path_testing_currentRunningPath = null;
        let path_testing_isPathRunning = false;
        let path_testing_pathNamesSubscriptionActive = false;

        // Show alert function
        function path_testing_showAlert(message) {
            path_testing_alertMessage.textContent = message;
            path_testing_alertPopup.style.display = 'block';
        }

        path_testing_alertOkBtn.onclick = function () {
            path_testing_alertPopup.style.display = 'none';
        };

        // Event listeners
        path_testing_btn.onclick = function () {
            path_testing_modal.style.display = 'block';
            // Send start command when opening modal
            startCommandPub.publish(new ROSLIB.Message({ data: true }));

            // Subscribe to path names only when needed
            if (!path_testing_pathNamesSubscriptionActive) {
                pathNamesSub.subscribe(path_testing_pathNamesCallback);
                path_testing_pathNamesSubscriptionActive = true;
            }
        };

        path_testing_close.onclick = function () {
            path_testing_modal.style.display = 'none';
        };

        window.onclick = function (event) {
            if (event.target === path_testing_modal) {
                path_testing_modal.style.display = 'none';
            }
        };

        path_testing_restartBtn.onclick = function () {
            // Send restart command
            startCommandPub.publish(new ROSLIB.Message({ data: true }));
            path_testing_statusText.textContent = 'Restarting...';
            path_testing_statusIndicator.className = 'path_testing_status-indicator path_testing_status-idle';

            // Resubscribe to get fresh path names
            pathNamesSub.unsubscribe();
            pathNamesSub.subscribe(path_testing_pathNamesCallback);
        };

        path_testing_runNextBtn.onclick = function () {
            if (path_testing_isPathRunning) {
                path_testing_showAlert("Please wait for the current path to complete");
                return;
            }

            if (path_testing_nextPathName.textContent === "completed" ||
                path_testing_nextPathName.textContent === "-") {
                path_testing_showAlert("All paths completed. Please restart the sequence.");
                return;
            }

            // Publish current velocity first
            velocityPub.publish(new ROSLIB.Message({
                data: parseFloat(path_testing_velocityInput.value) || 1.0
            }));

            // Then send run next command
            runNextPathPub.publish(new ROSLIB.Message({ data: true }));
            path_testing_isPathRunning = true;
            path_testing_statusText.textContent = 'Running path...';
            path_testing_statusIndicator.className = 'path_testing_status-indicator path_testing_status-running';
        };

        path_testing_velocityInput.addEventListener('change', () => {
            velocityPub.publish(new ROSLIB.Message({
                data: parseFloat(path_testing_velocityInput.value) || 1.0
            }));
        });

        // ROS Subscribers callbacks
        function path_testing_pathNamesCallback(message) {
            // Unsubscribe after first message to avoid continuous updates
            pathNamesSub.unsubscribe();
            path_testing_pathNamesSubscriptionActive = false;

            // Parse comma-separated paths
            path_testing_paths = message.data.split(', ').filter(path => path.trim() !== '');

            // Update path count
            document.getElementById('path_testing_pathCount').textContent = `Total paths: ${path_testing_paths.length}`;
            // Clear existing paths
            path_testing_pathList.innerHTML = '';

            // Create path items
            path_testing_paths.forEach((path, index) => {
                const pathItem = document.createElement('div');
                pathItem.className = 'path_testing_path-item';
                pathItem.id = `path_testing_path-${path}`;  // Use path name as ID
                pathItem.textContent = path;
                pathItem.title = path;  // Show full path on hover

                path_testing_pathList.appendChild(pathItem);
            });

            // Resubscribe to status updates to maintain current state
            runningStatusSub.subscribe(path_testing_runningStatusCallback);
        }

        function path_testing_runningStatusCallback(message) {
            const [status, pathName] = message.data.split(',');

            if (!pathName) return;

            // First remove all status classes from all paths
            document.querySelectorAll('.path_testing_path-item').forEach(item => {
                item.classList.remove('running', 'completed');
            });

            // Then apply the appropriate class to the current path
            const pathElement = document.getElementById(`path_testing_path-${pathName}`);
            if (pathElement) {
                if (status === 'running') {
                    pathElement.classList.add('running');
                    path_testing_isPathRunning = true;
                    path_testing_currentRunningPath = pathName;
                    path_testing_statusText.textContent = `Running: ${pathName}`;
                    path_testing_statusIndicator.className = 'path_testing_status-indicator path_testing_status-running';
                }
                else if (status === 'completed') {
                    pathElement.classList.add('completed');
                    path_testing_isPathRunning = false;
                    path_testing_currentRunningPath = null;
                    path_testing_statusText.textContent = 'Completed';
                    path_testing_statusIndicator.className = 'path_testing_status-indicator path_testing_status-idle';
                }
            }
        }

        nextPathNameSub.subscribe((message) => {
            path_testing_nextPathName.textContent = message.data || '-';
        });