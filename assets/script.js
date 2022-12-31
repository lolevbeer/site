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

// Days open.
const currentDate = new Date();
var openingDate = new Date('2022-12-2');
// Remove conditional wrap after opening.
let day = currentDate.getDay();
let currentDay = document.getElementById("day-" + day);
currentDay.classList.add("active");


// Food schedule.
// let curr = new Date();
// let firstday = new Date(curr.setDate(curr.getDate() - curr.getDay()));
// let lastday = new Date(curr.setDate(curr.getDate() - curr.getDay()+7));
// let foodEvents = document.getElementsByClassName("food-event");
// for (var i = 0; i < foodEvents.length; i++) {
//    let foodEvent = foodEvents.item(i);
//    if (i != 0) {
//      let foodEventDate = foodEvent.dataset.date + "/23";
//      let foodEventDateObj = new Date(foodEventDate);
//      if (foodEventDateObj.getTime() > lastday.getTime()) {
//        foodEvent.classList.add("blur");
//      }
//    }
// }
