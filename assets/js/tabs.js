document.addEventListener('DOMContentLoaded', function() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // Initialize from localStorage if LocationManager is available
  if (window.LocationManager) {
    window.LocationManager.initializeFromStorage();
  }
  
  // Fire custom event to notify that tabs are ready
  document.dispatchEvent(new CustomEvent('tabsReady'));
  
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const targetTab = this.dataset.tab;
      const targetSelector = this.dataset.target || `#${targetTab}`;
      const parentTabs = this.closest('.tabs');
      
      // Check if this is a location-based tab
      if (window.LocationManager) {
        const clickedLocation = window.LocationManager.getLocationFromTarget(targetSelector);
        
        if (clickedLocation) {
          // Use the shared location logic
          window.LocationManager.updateLocation(clickedLocation);
          return; // Exit early, LocationManager handles everything
        }
      }
      
      // Fallback to original tab behavior for non-location tabs
      const relatedContents = parentTabs ? 
        parentTabs.parentElement.querySelectorAll('.tab-content') : 
        tabContents;
      
      // Remove active class from all buttons and content in this tab group
      const relatedButtons = parentTabs ? 
        parentTabs.querySelectorAll('.tab-button') : 
        tabButtons;
        
      relatedButtons.forEach(btn => btn.classList.remove('tab-active'));
      relatedContents.forEach(content => {
        content.classList.remove('tab-active');
        content.style.display = 'none';
      });
      
      // Add active class to clicked button and corresponding content
      this.classList.add('tab-active');
      const targetContent = document.querySelector(targetSelector);
      if (targetContent) {
        targetContent.classList.add('tab-active');
        targetContent.style.display = 'block';
      }
    });
  });
}); 