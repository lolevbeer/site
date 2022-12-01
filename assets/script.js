let items = document.querySelectorAll("section, main");
for (let i = 0; i < items.length; i++) {
  items[i].style.background = randomColor({ luminosity: "light" });
}

function scrollHandlerY(e) {
  let atSnappingPoint = e.target.scrollTop % e.target.offsetHeight === 0;
  let timeOut = atSnappingPoint ? 0 : 150;
  let lastSlides = document.getElementsByClassName("last-slide");
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

main[0].addEventListener("scroll", scrollHandlerY);

for (slider of sliders) {
  slider.addEventListener("scroll", scrollHandlerX);
}

// Gets app height for sizing for search engines.
const appHeight = () => {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
  document.body.classList.add('height-rendered');
}
window.addEventListener('resize', appHeight);
window.addEventListener('orientationchange', appHeight);
appHeight();

const currentDate = new Date();
var openingDate = new Date('2022-12-2');
// Remove conditional wrap after opening.
if (currentDate.getTime() > openingDate.getTime()) {
  let day = currentDate.getDay();
  let currentDay = document.getElementById("day-" + day);
  currentDay.classList.add("active");
  // Remove this after opening.
  document.getElementById("not-open").remove();
}
