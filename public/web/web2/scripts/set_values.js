document.getElementById("emergency-button").addEventListener("click", function () {
    const button = this;
    if (button.classList.contains("toggled")) {
        button.classList.remove("toggled");
        button.textContent = "EMERGENCY STOP";
        console.log("Emergency button released");
    } else {
        button.classList.add("toggled");
        button.textContent = "STOP PRESSED";
        console.log("Emergency button pressed");
    }
});

