// Shared location management functionality
window.LocationManager = {
  updateLocation: function(location) {
    // Save to localStorage
    localStorage.setItem('selectedLocation', location);
    
    // Update all tabs based on selected location
    const targetSuffix = location.toLowerCase();
    
    // Find all tab groups and update them
    const allTabGroups = document.querySelectorAll('.tabs');
    
    allTabGroups.forEach(tabGroup => {
      const buttons = tabGroup.querySelectorAll('.tab-button');
      const contents = tabGroup.parentElement.querySelectorAll('.tab-content');
      
      buttons.forEach(button => {
        const target = button.dataset.target;
        if (target && target.includes(targetSuffix)) {
          // Activate this button
          button.classList.add('tab-active');
          // Show corresponding content
          const content = document.querySelector(target);
          if (content) {
            content.classList.add('tab-active');
            content.style.display = 'block';
          }
        } else {
          // Deactivate other buttons
          button.classList.remove('tab-active');
          // Hide other content
          const content = document.querySelector(button.dataset.target);
          if (content) {
            content.classList.remove('tab-active');
            content.style.display = 'none';
          }
        }
      });
    });
    
    // Update footer selector if it exists
    const locationSelector = document.getElementById('location-selector');
    if (locationSelector) {
      locationSelector.value = location;
    }
  },
  
  getLocationFromTarget: function(target) {
    if (target && target.includes('lawrenceville')) {
      return 'Lawrenceville';
    } else if (target && target.includes('zelienople')) {
      return 'Zelienople';
    }
    return null;
  },
  
  initializeFromStorage: function() {
    const savedLocation = localStorage.getItem('selectedLocation') || 'Lawrenceville';
    this.updateLocation(savedLocation);
  }
}; 