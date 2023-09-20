// let items = document.querySelectorAll("section, main");
// for (let i = 0; i < items.length; i++) {
//   items[i].style.background = randomColor({ luminosity: "light" });
// }

// Function to toggle the "menu-open" class on the body element
function toggleMenu() {
  // Get the body element
  const body = document.querySelector('body');

  // Toggle the "menu-open" class
  body.classList.toggle('menu-open');

  // Check if the body has the "menu-open" class and save the state to local storage
  // Only save to local storage if the viewport width is exactly 1000px
  // if (window.innerWidth > 1000) {
    if (body.classList.contains('menu-open')) {
      localStorage.setItem('menuOpen', 'true');
    } else {
      localStorage.setItem('menuOpen', 'false');
    }
  // }
}

// Function to close the menu on devices smaller than 1000px
function closeMenu() {
  if (window.innerWidth < 1000) {
    document.querySelector('body').classList.remove('menu-open');
  }
}

// Function to initialize the menu based on local storage
function initializeMenu() {
  // Only read from local storage if the viewport width is greater than 1000px
  // if (window.innerWidth > 1000) {
    // Get the saved menu state from local storage
    const savedMenuState = localStorage.getItem('menuOpen');

    // If the saved state is "true", add the "menu-open" class to the body
    if (savedMenuState === 'true') {
      document.querySelector('body').classList.add('menu-open');
    }
  // }
}

// Initialize the menu when the page loads
document.addEventListener('DOMContentLoaded', function() {
  initializeMenu();

  // Attach event listeners to close the menu when menu items are clicked
  const menuItems = document.querySelectorAll('.menu-item');
  menuItems.forEach(function(menuItem) {
    menuItem.addEventListener('click', closeMenu);
  });
});

// Attach the toggleMenu function to the click event of the element with ID "menu-control"
document.querySelector('#menu-control').addEventListener('click', toggleMenu);

// Initialize Intersection Observer
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    // Get the ID of the target element
    const id = entry.target.getAttribute('id');

    // Find the corresponding menu item
    const menuItem = document.querySelector(`.menu-item[href="#${id}"]`);

    // If the target element is in view, add the "active" class to the menu item
    if (entry.isIntersecting) {
      menuItem.classList.add('active');
    } else {
      menuItem.classList.remove('active');
    }
  });
}, {
  // Define the options for the Intersection Observer
  root: null,
  rootMargin: '0px',
  threshold: 0.5 // Adjust the threshold as needed
});

// Get all the target elements and observe them
document.querySelectorAll('.menu a').forEach((section) => {
  console.log(this)
  observer.observe(section);
});

function scrollHandlerY(e) {
  let atSnappingPoint = e.target.scrollTop % e.target.offsetHeight === 0;
  let timeOut = atSnappingPoint ? 0 : 150;
  let lastSlides = document.getElementsByClassName('last-slide');
  let lastSlide = lastSlides[0];

  if (e.target.scrollTop > lastSlide.offsetTop - 10) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  clearTimeout(e.target.scrollTimeout);
}

function scrollHandlerX(e) {
  let atSnappingPoint = e.target.scrollLeft % e.target.offsetWidth === 0;
  let timeOut = atSnappingPoint ? 0 : 150;

  clearTimeout(e.target.scrollTimeout);

}

if (localStorage.getItem('yLearned') == 1) {
  document.body.classList.add('y-learned');
}
if (localStorage.getItem('xLearned') == 1) {
  document.body.classList.add('x-learned');
}

let sliders = document.getElementsByTagName("slider");
let main = document.getElementsByTagName("main");

window.Yscrolls = 0;
window.Xscrolls = 0;

main[0].addEventListener("scroll", scrollHandlerY, {passive: true});

for (slider of sliders) {
  slider.addEventListener("scroll", scrollHandlerX, {passive: true});
}

// Gets app height for sizing for search engines.
const appHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
  document.body.classList.add('height-rendered');
}
window.addEventListener('resize', appHeight, {passive: true});
window.addEventListener('orientationchange', appHeight, {passive: true});
appHeight();

// Days open.
const currentDate = new Date();
// Remove conditional wrap after opening.
let day = currentDate.getDay();
let currentDay = document.getElementById("day-" + day);
currentDay.classList.add("active");

// Find all HTML elements with a "data-date" attribute
const elements = document.querySelectorAll('[data-date]');

// Loop through each element
elements.forEach(element => {
  // Get the value of the "data-date" attribute
  const dateValue = element.getAttribute('data-date');

  // Compare the "data-date" attribute value with today's date
  if (dateValue === `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`) {
    // Add the "active" class if the dates match
    element.classList.add('active');
  }
});
