const express = require("express");
const path = require("path");
console.log("errorJsonRoutes.js");

const router = express.Router();

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "../public/error-handling/errors/errors.json"));
});


module.exports = router;
