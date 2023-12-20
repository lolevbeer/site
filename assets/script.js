// Cached selectors for frequently accessed elements
const body = document.querySelector('body');
const main = document.querySelector('main');
const menuControl = document.querySelector('#menu-control');
const menuItems = document.querySelectorAll('.menu-item');
const sections = document.querySelectorAll('section[id]');

// Helper Functions
function toggleClass(element, className) {
  element.classList.toggle(className);
}

function addClass(element, className) {
  element.classList.add(className);
}

function removeClass(element, className) {
  element.classList.remove(className);
}

function isInMajorityView(el) {
  const rect = el.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  return rect.top <= windowHeight / 2 && rect.bottom >= windowHeight / 2;
}

// Menu Functions
function toggleMenu() {
  toggleClass(body, 'menu-open');
  if (window.innerWidth > 1000) {
    localStorage.setItem('menuOpen', body.classList.contains('menu-open') ? 'true' : 'false');
  }
}

function closeMenu() {
  if (window.innerWidth < 1000) {
    removeClass(body, 'menu-open');
  }
}

function initializeMenu() {
  if (window.innerWidth > 1000) {
    const savedMenuState = localStorage.getItem('menuOpen') || 'true';
    if (savedMenuState === 'true') {
      addClass(body, 'menu-open');
    }
  }
}

// Scroll Handlers
function scrollHandlerY(e) {
  let lastSlide = document.getElementsByClassName('last-slide')[0];
  let footerOffset = document.getElementById('footer').offsetHeight;
  let scrollTop = e.target.scrollTop;

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
}

// Date and Time Functions
function setActiveDays() {
  const currentDate = new Date();
  let day = currentDate.getDay();
  addClass(document.getElementById("day-" + day), "active");
}

function setActiveDates() {
  const elements = document.querySelectorAll('[data-date]');
  const formattedToday = `${new Date().toISOString().slice(0, 10)}`;

  elements.forEach(element => {
    if (element.getAttribute('data-date') === formattedToday) {
      addClass(element, 'active');
    }
  });
}

// Helper Function to get URL query parameter
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Function to add class to body based on URL query parameter
function addClassFromBodyQuery() {
  const className = getQueryParam('class');
  if (className) {
    addClass(body, className);
  }
}

// Initialize
function init() {
  initializeMenu();
  setActiveDays();
  setActiveDates();
  addClassFromBodyQuery(); // Add class to body based on URL query

  menuControl.addEventListener('click', toggleMenu);
  menuItems.forEach(item => item.addEventListener('click', closeMenu));
  main.addEventListener('scroll', scrollHandlerY, { passive: true });
  // Additional initialization as needed
}

document.addEventListener('DOMContentLoaded', init);
