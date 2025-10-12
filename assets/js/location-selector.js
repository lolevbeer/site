document.addEventListener('DOMContentLoaded', function() {
  const locationSelector = document.getElementById('location-selector');
  
  if (!locationSelector) return; // Exit if selector doesn't exist on this page
  
  // Load saved location preference or default to Lawrenceville
  const savedLocation = localStorage.getItem('selectedLocation') || 'Lawrenceville';
  locationSelector.value = savedLocation;
  
  // Function to update location when ready
  function updateWhenReady() {
    if (window.LocationManager) {
      window.LocationManager.updateLocation(savedLocation);
    }
  }
  
  // Set initial state - try immediately and also wait for window load
  updateWhenReady();
  
  // Also try after window is fully loaded to catch any late-loading tabs
  window.addEventListener('load', updateWhenReady);
  
  // Listen for custom event when tabs are ready (fired by tab sections)
  document.addEventListener('tabsReady', updateWhenReady);
  
  // Listen for dropdown changes
  locationSelector.addEventListener('change', function() {
    if (window.LocationManager) {
      window.LocationManager.updateLocation(this.value);
    }
  });
}); 