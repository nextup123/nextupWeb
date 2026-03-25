console.log('safety init...');


document.addEventListener('DOMContentLoaded', function () {
    // Hardcoded password
    const SAFETY_PASSWORD = "123";

    // Elements
    const container = document.getElementById('securedContainer');
    const lockButton = document.getElementById('safetyLockButton');
    const authModal = document.getElementById('authModal');
    const authPassword = document.getElementById('authPassword');
    const confirmAuth = document.getElementById('confirmAuth');
    const cancelAuth = document.getElementById('cancelAuth');
    const closeModal = document.querySelector('.close-modal');
    const authError = document.getElementById('authError');

    // Initial state - locked
    let isLocked = true;
    updateLockState();

    // Toggle lock button click
    lockButton.addEventListener('click', function () {

        if (isLocked) {
            // If locked, show auth modal to unlock
            showAuthModal();
        } else {
            // If unlocked, show auth modal to lock
            showAuthModal(true);
        }
    });

    // Show authentication modal
    function showAuthModal(isLocking = false) {
        authModal.style.display = 'block';
        authPassword.value = '';
        authError.textContent = '';

        authPassword.focus();

        // Update modal text based on action
        const header = document.querySelector('.modal-header h3');
        const statusLight = document.querySelector('.status-light');

        if (isLocking) {
            header.textContent = "SYSTEM LOCK CONFIRMATION";
            document.querySelector('.modal-body p').textContent = "Confirm authorization to lock the system";
            statusLight.classList.remove('red');
            statusLight.classList.add('green');
        } else {
            header.textContent = "SYSTEM AUTHORIZATION";
            document.querySelector('.modal-body p').textContent = "Access to control parameters requires authentication";
            statusLight.classList.remove('green');
            statusLight.classList.add('red');
        }
    }

    // Close modal
    function closeAuthModal() {
        authModal.style.display = 'none';
    }

    // Event listeners for modal
    closeModal.addEventListener('click', closeAuthModal);
    cancelAuth.addEventListener('click', closeAuthModal);

    authPassword.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            confirmAuth.click(); // Trigger the authentication
        }
    });
    // Confirm authentication
    confirmAuth.addEventListener('click', function () {
        const enteredPassword = authPassword.value;

        if (enteredPassword === SAFETY_PASSWORD) {
            // Toggle lock state
            isLocked = !isLocked;
            updateLockState();
            closeAuthModal();
        } else {
            authError.textContent = "Invalid security code. Access denied.";
        }
    });

    // Update UI based on lock state
    function updateLockState() {
        if (isLocked) {
            container.classList.add('point-locked');
            lockButton.classList.remove('point-unlocked');
            lockButton.classList.add('point-locked');
        } else {
            container.classList.remove('point-locked');
            lockButton.classList.remove('point-locked');
            lockButton.classList.add('point-unlocked');
        }
    }

    // Close modal when clicking outside
    window.addEventListener('click', function (event) {
        if (event.target === authModal) {
            closeAuthModal();
        }
    });



    const safetyToggle = document.getElementById('safetyToggle');
    const containersToLock = document.querySelectorAll('.container-to-lock'); // Add this class to your containers

    safetyToggle.addEventListener('change', function () {
        const isSafe = this.checked;
        document.querySelector('.safety-toggle-label').textContent = `SAFE MODE: ${isSafe ? 'ON' : 'OFF'}`;

        containersToLock.forEach(container => {
            if (isSafe) {
                container.classList.add('locked-container');
            } else {
                container.classList.remove('locked-container');
            }
        });
    });

    // Initialize locked state
    containersToLock.forEach(container => {
        container.classList.add('locked-container');
    });
});

