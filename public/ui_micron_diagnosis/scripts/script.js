const yearSelect = document.getElementById("year");
const monthSelect = document.getElementById("month");
const dateSelect = document.getElementById("date");
const loadFileBtn = document.getElementById("load-file");
const table = document.getElementById("data-table");
const socket = io();

async function fetchLogsStructure() {
    const res = await fetch("/ui_micron_diagnosis/logs-structure");
    const data = await res.json();
    yearSelect.innerHTML = '<option value="">Select Year</option>';
    data.forEach(({ year, months }) => {
        const option = document.createElement("option");
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
}

async function fetchMonths() {
    const year = yearSelect.value;
    if (!year) return;
    const res = await fetch(`/ui_micron_diagnosis/logs/${year}/`);
    const months = await res.json();
    monthSelect.innerHTML = '<option value="">Select Month</option>';
    months.forEach(month => {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = month;
        monthSelect.appendChild(option);
    });
}

async function fetchDates() {
    const year = yearSelect.value;
    const month = monthSelect.value;
    if (!year || !month) return;
    const res = await fetch(`/ui_micron_diagnosis/logs/${year}/${month}`);
    const dates = await res.json();
    dateSelect.innerHTML = '<option value="">Select Date</option>';
    dates.forEach(date => {
        const option = document.createElement("option");
        option.value = date;
        option.textContent = date;
        dateSelect.appendChild(option);
    });
}

async function loadFile() {
    const year = yearSelect.value;
    const month = monthSelect.value;
    const date = dateSelect.value;
    if (!year || !month || !date) return showAlert("Please select a valid file");

    loadFileBtn.disabled = true;
    loadFileBtn.textContent = "Loading...";

    try {
        const res = await fetch(`/ui_micron_diagnosis/logs/${year}/${month}/${date}`);
        const data = await res.json();
        updateTable(data);
    } catch (error) {
        console.error("Error loading file:", error);
        showAlert("Failed to load file. Please try again.");
    } finally {
        loadFileBtn.disabled = false;
        loadFileBtn.textContent = "Load Data";
    }
}
function updateTable(data) {
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (data.length > 0) {
        const headers = Object.keys(data[0]);
        const headerRow = document.createElement("tr");
        headers.forEach(header => {
            const th = document.createElement("th");
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        data.forEach(row => {
            const rowEl = document.createElement("tr");
            headers.forEach(header => {
                const td = document.createElement("td");
                const value = `${row[header]}` || "";

                // Handle Image URL as a clickable link
                if (header === "Image URL" && value && value !== "NA" && value !== "na") {
                    const link = document.createElement("a");
                    link.href = "#";
                    link.textContent = "View Image";
                    link.addEventListener("click", () => openImageModal(`/images/${value}`));
                    td.appendChild(link);
                }
                // Add color to DI Reading Status and Image Status
                else if (header === "DI Reading Status" || header === "Image Status") {
                    td.textContent = value;
                    if (value === "OK" || value === "ok") {
                        td.style.color = "green"; // Green for OK
                        td.style.fontWeight = "bold";
                    } else if (value === "NOT OK" || value === "not ok") {
                        td.style.color = "red"; // Red for NOT OK
                        td.style.fontWeight = "bold";
                    }
                } else {
                    td.textContent = value;
                }

                rowEl.appendChild(td);
            });
            tbody.prepend(rowEl); // Prepend rows to show new data at the top
        });
    }
}
const modal = document.getElementById("image-modal");
const modalImage = document.getElementById("modal-image");
// Function to open the modal and display the image
function openImageModal(imageUrl) {
    modal.style.display = "block"; // Show the modal
    modalImage.src = imageUrl; // Set the source of the image
}

// When the user clicks the close button, close the modal
const closeModalBtn = document.getElementById("close-modal");
closeModalBtn.addEventListener("click", () => {
    modal.style.display = "none"; // Hide the modal
});

// When the user clicks anywhere outside of the modal, close it
window.addEventListener("click", (event) => {
    if (event.target === modal) {
        modal.style.display = "none"; // Hide the modal
    }
});




const liveViewBtn = document.getElementById("live-view");
let liveViewActive = false; // To keep track of whether live view is active
let liveViewInterval = null; // To store the interval ID

// Function to fetch today's file and update the table
async function fetchAndUpdateCurrentFile() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.toLocaleString("default", { month: "long" });
    const date = today.getDate();

    try {
        const filePath = `/ui_micron_diagnosis/logs/${year}/${month}/${date}-${month}-${year}.xlsx`;
        const res = await fetch(filePath);
        if (res.ok) {
            const data = await res.json();
            updateTable(data);
        } else {
            showAlert(`The file for ${date} ${month} ${year} is not ready to display.`);
        }
    } catch (error) {
        console.error("Error loading today's file:", error);
        showAlert("An error occurred while loading the file. Please try again later.");
    }
}


yearSelect.addEventListener("change", fetchMonths);
monthSelect.addEventListener("change", fetchDates);
loadFileBtn.addEventListener("click", loadFile);
// liveViewBtn.addEventListener("click", startLiveView);

fetchLogsStructure();

document.addEventListener("DOMContentLoaded", async () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.toLocaleString("default", { month: "long" }); // e.g., "January"
    const date = today.getDate();

    try {
        const filePath = `/ui_micron_diagnosis/logs/${year}/${month}/${date}-${month}-${year}.xlsx`;
        const res = await fetch(filePath);
        if (res.ok) {
            const data = await res.json();
            updateTable(data);
        } else {
            showAlert(`The file for ${date} ${month} ${year} is not ready to display.`);
        }
    } catch (error) {
        console.error("Error loading initial file:", error);
        showAlert("An error occurred while loading the initial file. Please try again later.");
    }
});

function showAlert(message) {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.className = "alert-overlay";

    // Create alert box
    const alertBox = document.createElement("div");
    alertBox.className = "alert-box";
    alertBox.textContent = message;

    // Create close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "OK";
    closeBtn.className = "alert-close-btn";
    closeBtn.addEventListener("click", () => {
        document.body.removeChild(overlay); // Remove overlay
        document.body.removeChild(alertBox); // Remove alert box
    });

    // Append close button to alert box
    alertBox.appendChild(closeBtn);

    // Append overlay and alert box to the body
    document.body.appendChild(overlay);
    document.body.appendChild(alertBox);

    setTimeout(() => {
        document.body.removeChild(overlay);
        document.body.removeChild(alertBox);
    }, 3000); // Close after 3 seconds
}


async function populatePendriveDropdown() {
    const pendriveSelect = document.getElementById('pendrive-select');

    try {
        const response = await fetch('/ui_micron_diagnosis/list-pendrives');
        const pendrives = await response.json();

        pendriveSelect.innerHTML = '<option value="">Select Pendrive</option>';
        if (pendrives.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "No pendrives found";
            pendriveSelect.appendChild(option);
        } else {
            pendrives.forEach(pendrive => {
                const option = document.createElement('option');
                option.value = `/media/rocket/${pendrive}`; // Manually construct the path
                option.textContent = pendrive;
                pendriveSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error fetching pendrives:', error);
        showAlert('Failed to fetch pendrives. Please try again.');
    }
}

document.getElementById('copy-data').addEventListener('click', async () => {
    const year = yearSelect.value;
    const month = monthSelect.value;
    const date = dateSelect.value;
    const pendrivePath = document.getElementById('pendrive-select').value;
    const copyScope = document.querySelector('input[name="copy-scope"]:checked').value;

    if (!pendrivePath) {
        return showAlert("Please select a pendrive.");
    }

    try {
        const logsPath = '/home/rocket/github/nextupWeb/public/ui_micron_diagnosis/logs'
        let sourcePath;
        if (copyScope === 'file') {
            if (!year || !month || !date) {
                return showAlert("Please select a valid file to copy.");
            }
            sourcePath = `${logsPath}/${year}/${month}/${date}`; // Full absolute path
        } else if (copyScope === 'month') {
            if (!year || !month) {
                return showAlert("Please select a valid month to copy.");
            }
            sourcePath = `${logsPath}/${year}/${month}`; // Full absolute path
        } else if (copyScope === 'year') {
            if (!year) {
                return showAlert("Please select a valid year to copy.");
            }
            sourcePath = `${logsPath}/${year}`; // Full absolute path
        }

        console.log("Source Path:", sourcePath); // Debugging: Log the source path

        const response = await fetch('/ui_micron_diagnosis/copy-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourceFilePath: sourcePath, pendrivePath }),
        });
        const result = await response.json();
        showAlert(result.message);
    } catch (error) {
        console.error('Error copying data:', error);
        showAlert('Failed to copy data. Please try again.');
    }
});

document.getElementById('refresh-pendrives').addEventListener('click', populatePendriveDropdown);
// Populate pendrive dropdown when the page loads
document.addEventListener('DOMContentLoaded', populatePendriveDropdown);



// Function to update the digital clock
function updateClock() {
    const now = new Date();

    // Format the time (HH:MM:SS)
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const time = `${hours}:${minutes}:${seconds}`;

    // Format the day (e.g., Monday)
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const day = days[now.getDay()];

    // Format the date (DD:MM:YYYY)
    const date = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = now.getFullYear();
    const formattedDate = `${date}:${month}:${year}`;

    // Combine everything into the desired format
    const clockText = `${time} | ${day} | ${formattedDate}`;

    // Update the clock element
    const clockElement = document.getElementById('digital-clock');
    if (clockElement) {
        clockElement.textContent = clockText;
    }
}

// Update the clock every second
setInterval(updateClock, 1000);

// Initialize the clock immediately
updateClock();



// Initialize ROS connection
const ros = new ROSLIB.Ros({
    url: 'ws://localhost:9090' // Replace with your Rosbridge server URL
});

const connectionStatus = document.getElementById('connection-status');
const dot = connectionStatus.querySelector('.dot');

ros.on('connection', () => {
    dot.classList.add('connected');
    dot.classList.remove('disconnected');
});

ros.on('error', () => {
    dot.classList.remove('connected');
    dot.classList.add('disconnected');
});

ros.on('close', () => {
    dot.classList.remove('connected');
    dot.classList.add('disconnected');
});
// Initialize the topic
const dataTopic = new ROSLIB.Topic({
    ros: ros,
    name: '/data_topic',
    messageType: 'std_msgs/msg/String'
});

// Function to handle incoming messages
const handleDataMessage = (message) => {
    console.log('Received message:', message.data);

    // Add a 200ms delay before fetching the file
    setTimeout(() => {
        fetchAndUpdateCurrentFile().catch(error => {
            console.error("Error fetching data:", error);
        });
    }, 500); // 200ms delay
};

// Live View Button Logic
liveViewBtn.addEventListener("click", () => {
    liveViewActive = !liveViewActive; // Toggle the state of live view

    if (liveViewActive) {
        // Start live updates
        liveViewBtn.innerHTML = '<i class="fas fa-circle"></i> LIVE VIEW RUNNING';
        liveViewBtn.style.backgroundColor = "#4CAF50"; // Green for active
        liveViewBtn.classList.add('active');

        // Subscribe to the topic
        dataTopic.subscribe(handleDataMessage);

        // Immediately fetch the first update
        fetchAndUpdateCurrentFile();

    } else {
        // Stop live updates
        liveViewBtn.innerHTML = '<i class="fas fa-circle"></i> LIVE VIEW STOPPED';
        liveViewBtn.style.backgroundColor = "#f44336"; // Red for inactive
        liveViewBtn.classList.remove('active');

        // Unsubscribe from the topic
        dataTopic.unsubscribe(handleDataMessage);
    }
});
