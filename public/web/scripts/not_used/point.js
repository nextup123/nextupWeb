// /home/shivam/web_moveit_v1/yaml/points_data.yaml

const express = require('express');
const fs = require('fs');
const yaml = require('yaml');
const path = require('path');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// File path for the YAML file
const filePath = '/home/shivam/web_moveit_v1/yaml/points_data.yaml';

// Initialize the YAML file with `points:` if it doesn't exist
if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, 'points:\n');
}

// Endpoint to save YAML data
app.post('/save-point', (req, res) => {
    try {
        const yamlData = req.body.yamlData;

        if (!yamlData) {
            return res.status(400).send('YAML data is required.');
        }

        // Read the existing YAML file
        const existingData = fs.readFileSync(filePath, 'utf8');
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

        // Add the new entry to the `points` array
        parsedData.points.push(newEntry);

        // Write the updated data back to the YAML file
        try {
            fs.writeFileSync(filePath, yaml.stringify(parsedData));
            res.send('Data saved successfully!');
        } catch (writeError) {
            console.error('Error writing to YAML file:', writeError);
            res.status(500).send('Error writing to YAML file.');
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).send('Internal server error.');
    }
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join('/home/shivam/web_moveit_v1/web/index.html'));
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});