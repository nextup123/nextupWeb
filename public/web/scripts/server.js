// const express = require('express');
// const fs = require('fs');
// const yaml = require('yaml');
// const path = require('path');
// const cors = require('cors');

// const app = express();
// const port = 3000;

// // Enable CORS for all routes
// app.use(cors());

// // Middleware to parse JSON bodies
// app.use(express.json());

// // File paths for the YAML files
// const pointFilePath = '/home/nextup/point_yaml.yaml';
// const pathFilePath = '/home/nextup/path_yaml.yaml';

// // Initialize the YAML files if they don't exist
// if (!fs.existsSync(pointFilePath)) {
//     fs.writeFileSync(pointFilePath, 'points:\n');
// }
// if (!fs.existsSync(pathFilePath)) {
//     fs.writeFileSync(pathFilePath, 'paths:\n');
// }

// // Helper function to generate a unique ID
// function generateUniqueId() {
//     return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
// }

// // Endpoint to save point data
// app.post('/save-point', (req, res) => {
//     try {
//         const yamlData = req.body.yamlData;

//         if (!yamlData) {
//             return res.status(400).send('YAML data is required.');
//         }

//         // Read the existing YAML file
//         const existingData = fs.readFileSync(pointFilePath, 'utf8');
//         let parsedData;

//         try {
//             parsedData = yaml.parse(existingData);
//         } catch (parseError) {
//             console.error('Error parsing YAML file:', parseError);
//             return res.status(500).send('Error parsing YAML file.');
//         }

//         // If the file is empty or invalid, initialize `parsedData` with `points: []`
//         if (!parsedData || typeof parsedData !== 'object') {
//             parsedData = { points: [] };
//         }

//         // Ensure the root key `points` exists
//         if (!parsedData.points) {
//             parsedData.points = [];
//         }

//         // Parse the new entry as an object
//         let newEntry;
//         try {
//             // Parse the YAML string into an object
//             newEntry = yaml.parse(yamlData);
//             // Ensure the new entry is an object, not an array
//             if (Array.isArray(newEntry)) {
//                 newEntry = newEntry[0]; // Take the first element if it's an array
//             }
//         } catch (entryError) {
//             console.error('Error parsing new YAML entry:', entryError);
//             return res.status(400).send('Invalid YAML data.');
//         }

//         // Add a unique ID to the new entry
//         newEntry.id = generateUniqueId();

//         // Add the new entry to the `points` array
//         parsedData.points.push(newEntry);

//         // Write the updated data back to the YAML file
//         try {
//             fs.writeFileSync(pointFilePath, yaml.stringify(parsedData));
//             res.send('Point saved successfully!');
//         } catch (writeError) {
//             console.error('Error writing to YAML file:', writeError);
//             res.status(500).send('Error writing to YAML file.');
//         }
//     } catch (error) {
//         console.error('Unexpected error:', error);
//         res.status(500).send('Internal server error.');
//     }
// });

// // Endpoint to save path data
// app.post('/save-path', (req, res) => {
//     try {
//         const { name, speed, acceleration, wait, plan_space } = req.body;

//         if (!name || !speed || !acceleration || !wait || !plan_space) {
//             return res.status(400).send('All fields are required.');
//         }

//         // Generate a unique ID for the path
//         const id = generateUniqueId();

//         // Create the path data
//         const pathData = {
//             name,
//             speed,
//             acceleration,
//             wait,
//             id,
//             type: 'path',
//             plan_space,
//         };

//         // Read the existing YAML file
//         const existingData = fs.readFileSync(pathFilePath, 'utf8');
//         let parsedData;

//         try {
//             parsedData = yaml.parse(existingData);
//         } catch (parseError) {
//             console.error('Error parsing YAML file:', parseError);
//             return res.status(500).send('Error parsing YAML file.');
//         }

//         // If the file is empty or invalid, initialize `parsedData` with `paths: []`
//         if (!parsedData || typeof parsedData !== 'object') {
//             parsedData = { paths: [] };
//         }

//         // Ensure the root key `paths` exists
//         if (!parsedData.paths) {
//             parsedData.paths = [];
//         }

//         // Add the new path data to the `paths` array
//         parsedData.paths.push(pathData);

//         // Write the updated data back to the YAML file
//         try {
//             fs.writeFileSync(pathFilePath, yaml.stringify(parsedData));
//             res.send('Path saved successfully!');
//         } catch (writeError) {
//             console.error('Error writing to YAML file:', writeError);
//             res.status(500).send('Error writing to YAML file.');
//         }
//     } catch (error) {
//         console.error('Unexpected error:', error);
//         res.status(500).send('Internal server error.');
//     }
// });

// // Serve the HTML file
// app.get('/', (req, res) => {
//     res.sendFile(path.join('/home/nextup/nextup/src/web_moveit_v1/web/index.html'));
// });

// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:3000`);
// });



const express = require('express');
const fs = require('fs');
const yaml = require('yaml');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

// Enable CORS for all routes
app.use(cors());

// Middleware to parse JSON bodies
app.use(express.json());

// File paths for the YAML files
const pointFilePath = `/home/nextup/point_yaml.yaml`;
const pathFilePath = `/home/nextup/path_yaml.yaml`;

// Initialize the YAML files if they don't exist
if (!fs.existsSync(pointFilePath)) {
    fs.writeFileSync(pointFilePath, 'points:\n');
    console.log('Created point_yaml.yaml file.');
}
if (!fs.existsSync(pathFilePath)) {
    fs.writeFileSync(pathFilePath, 'paths:\n');
    console.log('Created path_yaml.yaml file.');
}

// Helper function to generate a unique ID
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Function to read YAML file and extract names
function readYamlFile(filePath, rootKey) {
    try {
        const fileData = fs.readFileSync(filePath, 'utf8');
        const parsedData = yaml.parse(fileData);

        if (!parsedData || !parsedData[rootKey]) {
            console.log(`No data found in ${filePath} for key: ${rootKey}`);
            return [];
        }

        return parsedData[rootKey].map(item => item.name);
    } catch (error) {
        console.error(`Error reading or parsing ${filePath}:`, error);
        return [];
    }
}

// Function to generate HTML for buttons
// function generateButtons(names, color) {
//     return names.map(name => `<button style="background-color: ${color}; margin: 5px; padding: 10px; border: none; border-radius: 5px;">${name}</button>`).join('');
// }

// Function to generate HTML for buttons with onclick functionality
function generatePointButtons(names, color) {
    return names
        .map(
            name => `
                <button 
                    style="background-color: ${color}; margin: 5px; padding: 10px; border: none; border-radius: 5px; color: white;" 
                    onclick="handleButtonClick('${name}')">
                    ${name}
                </button>
            `
        )
        .join('');
}

function generatePathButtons(names, color) {
    return names
        .map(
            name => `
                <button 
                    style="background-color: ${color}; margin: 5px; padding: 10px; border: none; border-radius: 5px;">
                    ${name}
                </button>
            `
        )
        .join('');
}

// Endpoint to save point data
app.post('/save-point', (req, res) => {
    try {
        const yamlData = req.body.yamlData;

        if (!yamlData) {
            return res.status(400).send('YAML data is required.');
        }

        // Read the existing YAML file
        const existingData = fs.readFileSync(pointFilePath, 'utf8');
        let parsedData;

        try {
            parsedData = yaml.parse(existingData);
        } catch (parseError) {
            console.error('Error parsing YAML file:', parseError);
            return res.status(500).send('Error parsing YAML file.');
        }

        // If the file is empty or invalid, initialize `parsedData` with `points: []`
        if (!parsedData || typeof parsedData !== 'object') {
            parsedData = { points: [] };
        }

        // Ensure the root key `points` exists
        if (!parsedData.points) {
            parsedData.points = [];
        }

        // Parse the new entry as an object
        let newEntry;
        try {
            // Parse the YAML string into an object
            newEntry = yaml.parse(yamlData);
            // Ensure the new entry is an object, not an array
            if (Array.isArray(newEntry)) {
                newEntry = newEntry[0]; // Take the first element if it's an array
            }
        } catch (entryError) {
            console.error('Error parsing new YAML entry:', entryError);
            return res.status(400).send('Invalid YAML data.');
        }

        // Add a unique ID to the new entry
        newEntry.id = generateUniqueId();

        // Add the new entry to the `points` array
        parsedData.points.push(newEntry);

        // Write the updated data back to the YAML file
        try {
            fs.writeFileSync(pointFilePath, yaml.stringify(parsedData));
            console.log('Point saved successfully:', newEntry);
            res.send('Point saved successfully!');
        } catch (writeError) {
            console.error('Error writing to YAML file:', writeError);
            res.status(500).send('Error writing to YAML file.');
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal server error.');
    }
});

// Endpoint to save path data
app.post('/save-path', (req, res) => {
    try {
        const { name, speed, acceleration, wait, plan_space } = req.body;

        if (!name || !speed || !acceleration || wait === undefined || wait === '' || wait === null || !plan_space) {
            return res.status(400).send('All fields are required.');
        }

        // Generate a unique ID for the path
        const id = generateUniqueId();

        // Create the path data
        const pathData = {
            name,
            speed,
            acceleration,
            wait,
            id,
            type: 'path',
            plan_space,
        };

        // Read the existing YAML file
        const existingData = fs.readFileSync(pathFilePath, 'utf8');
        let parsedData;

        try {
            parsedData = yaml.parse(existingData);
        } catch (parseError) {
            console.error('Error parsing YAML file:', parseError);
            return res.status(500).send('Error parsing YAML file.');
        }

        // If the file is empty or invalid, initialize `parsedData` with `paths: []`
        if (!parsedData || typeof parsedData !== 'object') {
            parsedData = { paths: [] };
        }

        // Ensure the root key `paths` exists
        if (!parsedData.paths) {
            parsedData.paths = [];
        }

        // Add the new path data to the `paths` array
        parsedData.paths.push(pathData);

        // Write the updated data back to the YAML file
        try {
            fs.writeFileSync(pathFilePath, yaml.stringify(parsedData));
            console.log('Path saved successfully:', pathData);
            res.send('Path saved successfully!');
        } catch (writeError) {
            console.error('Error writing to YAML file:', writeError);
            res.status(500).send('Error writing to YAML file.');
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal server error.');
    }
});

// Endpoint to serve updated button HTML
app.get('/update-buttons', (req, res) => {
    try {
        // Read point and path names from YAML files
        const pointNames = readYamlFile(pointFilePath, 'points');
        const pathNames = readYamlFile(pathFilePath, 'paths');

        console.log('Point names:', pointNames);
        console.log('Path names:', pathNames);

        // Generate button HTML
        const pointButtons = generatePointButtons(pointNames, '#3498db'); // Blue for points
        const pathButtons = generatePathButtons(pathNames, '#2ecc71'); // Green for paths

        // Send the button HTML as JSON
        res.json({
            pointButtons,
            pathButtons,
        });
    } catch (error) {
        console.error('Error updating buttons:', error);
        res.status(500).send('Internal server error.');
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join('/home/rocket/MicronRobot/src/web_moveit_v1/web/index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
