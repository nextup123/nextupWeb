function startTutorial() {
      introJs().setOptions({
        nextLabel: 'Next ',
        prevLabel: ' Back',
        skipLabel: 'Exit',
        doneLabel: 'Finish ',
        showProgress: true,
        showBullets: true,
        showStepNumbers: true,
        keyboardNavigation: true,
        tooltipPosition: 'auto',
        exitOnOverlayClick: false,
        disableInteraction: true,
        highlightClass: 'highlight-step',
        steps: [
          // Additional steps can be added here programmatically if needed
        ]
      }).oncomplete(function() {
        // Optional: Action to perform after tour completes
        console.log('Tour completed');
      }).onexit(function() {
        // Optional: Action to perform when user exits tour
        console.log('Tour exited');
      }).start();
    }
    
    // Add hover effects to all introjs elements
    document.addEventListener('DOMContentLoaded', function() {
      const elements = document.querySelectorAll('[data-intro]');
      elements.forEach(el => {
        el.style.transition = 'transform 0.2s ease';
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.02)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });
      });
    });