// Cached selectors for frequently accessed elements
const body = document.querySelector('body');
const main = document.querySelector('main');
const menuControl = document.querySelector('#menu-control');
const menuItems = document.querySelectorAll('.menu-item');
const sections = document.querySelectorAll('section[id]');

// Helper Functions
const toggleClass = (element, className) => element.classList.toggle(className);
const addClass = (element, className) => element.classList.add(className);
const removeClass = (element, className) => element.classList.remove(className);
const isInMajorityView = (el) => {
  const rect = el.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  return rect.top <= windowHeight / 2 && rect.bottom >= windowHeight / 2;
};

// Menu Functions
const toggleMenu = () => {
  toggleClass(body, 'menu-open');
  if (window.innerWidth > 1200) {
    localStorage.setItem('menuOpen', body.classList.contains('menu-open') ? 'true' : 'false');
  }
};

const closeMenu = () => {
  if (window.innerWidth < 1201) {
    removeClass(body, 'menu-open');
  }
};

const initializeMenu = () => {
  if (window.innerWidth > 1200) {
    const savedMenuState = localStorage.getItem('menuOpen') || 'true';
    if (savedMenuState === 'true') {
      addClass(body, 'menu-open');
    }
  }
};

// Scroll Handlers
const scrollHandlerY = (e) => {
  const lastSlide = document.getElementsByClassName('last-slide')[0];
  const footerOffset = document.getElementById('footer').offsetHeight;
  const scrollTop = e.target.scrollTop;

  if (scrollTop > lastSlide.offsetTop - footerOffset + 50) {
    addClass(body, 'dark');
  } else {
    removeClass(body, 'dark');
  }

  if (scrollTop > lastSlide.offsetTop - 10) {
    addClass(body, 'dark-social');
  } else {
    removeClass(body, 'dark-social');
  }

  sections.forEach(section => {
    if (isInMajorityView(section)) {
      localStorage.setItem('currentSection', section.id);
    }
  });
};

// Date and Time Functions
const setActiveDays = () => {
  // Get current day for Eastern Time (both Lawrenceville and Zelienople are in PA, Eastern Time)
  const currentDate = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const day = new Date(currentDate).getDay();
  
  // Add active class to the day element (this will affect both locations since they share day IDs)
  const dayElement = document.getElementById(`day-${day}`);
  if (dayElement) {
    addClass(dayElement, 'active');
  }
  
  // Since both locations are in the same timezone, we could also explicitly handle them
  // by selecting all elements with the day ID pattern, in case the structure changes
  const allDayElements = document.querySelectorAll(`[id="day-${day}"]`);
  allDayElements.forEach(element => {
    addClass(element, 'active');
  });
};

const setActiveDates = () => {
  const elements = document.querySelectorAll('[data-date]');
  let date = new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).split(',')[0]; // Splits at the comma, which separates date and time

  // The format from toLocaleString is MM/DD/YYYY, so we need to rearrange it
  let parts = date.split('/');
  let currentDate = `${parts[2]}-${parts[0]}-${parts[1]}`;
  
  elements.forEach(element => {
    if (element.getAttribute('data-date') === currentDate) {
      addClass(element, 'active');
    }
  });
};

// Helper Function to get URL query parameter
const getQueryParam = (param) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
};

// Function to add class to body based on URL query parameter
const addClassFromBodyQuery = () => {
  const className = getQueryParam('class');
  if (className) {
    addClass(body, className);
  }
};

// Initialize
const init = () => {
  initializeMenu();
  setActiveDays();
  setActiveDates();
  addClassFromBodyQuery(); // Add class to body based on URL query

  menuControl.addEventListener('click', toggleMenu);
  menuItems.forEach(item => item.addEventListener('click', closeMenu));
  main.addEventListener('scroll', scrollHandlerY, { passive: true });
};

document.addEventListener('DOMContentLoaded', init);
