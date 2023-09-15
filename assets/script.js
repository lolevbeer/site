// let items = document.querySelectorAll("section, main");
// for (let i = 0; i < items.length; i++) {
//   items[i].style.background = randomColor({ luminosity: "light" });
// }

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

  e.target.scrollTimeout = setTimeout(function () {
    if (!timeOut) {
      window.Yscrolls++;
      if (window.Yscrolls >= 5) {
        document.body.classList.add('y-learned');
        localStorage.setItem('yLearned', 1);
      }
    }
  }, timeOut);
}

function scrollHandlerX(e) {
  let atSnappingPoint = e.target.scrollLeft % e.target.offsetWidth === 0;
  let timeOut = atSnappingPoint ? 0 : 150;

  clearTimeout(e.target.scrollTimeout);

  e.target.scrollTimeout = setTimeout(function () {
    if (!timeOut) {
      window.Xscrolls++;
      if (window.Xscrolls >= 4) {
        document.body.classList.add('x-learned');
        localStorage.setItem('xLearned', 1);
      }
    }
  }, timeOut);
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
