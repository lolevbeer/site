let items = document.querySelectorAll("section, main");
for (let i = 0; i < items.length; i++) {
  items[i].style.background = randomColor({ luminosity: "light" });
}

function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top == 0 &&
    rect.left == 0
  );
}

function scrollHandlerY(e) {
  let atSnappingPoint = e.target.scrollTop % e.target.offsetHeight === 0;
  let timeOut = atSnappingPoint ? 0 : 150;
  let lastSlides = document.getElementsByClassName("last-slide");
  let lastSlide = lastSlides[0];

  clearTimeout(e.target.scrollTimeout);

  e.target.scrollTimeout = setTimeout(function () {
    if (!timeOut) {
      window.Yscrolls++;
      if (window.Yscrolls >= 5) {
        document.body.classList.add('y-learned');
      }
      if (isInViewport(lastSlide)) {
        document.body.classList.add('dark');
      } else {
        document.body.classList.remove('dark');
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
      }
    }
  }, timeOut);
}

let sliders = document.getElementsByTagName("slider");
let main = document.getElementsByTagName("main");

window.Yscrolls = 0;
window.Xscrolls = 0;

main[0].addEventListener("scroll", scrollHandlerY);

for (slider of sliders) {
  slider.addEventListener("scroll", scrollHandlerX);
}

var chart1 = document.getElementById("chart-1");
var chart2 = document.getElementById("chart-2");
var chart3 = document.getElementById("chart-3");
var chart1 = new Chart(chart1, {
  type: "line",
  options: {
    animations: {
      tension: {
        duration: 1000,
        easing: 'linear',
        from: .5,
        to: 0,
        loop: true
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  },
  data: {
    labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    datasets: [
      {
        label: '',
        data: [
          { x: 1, y: 12 },
          { x: 2, y: 11.5 },
          { x: 3, y: 10 },
          { x: 4, y: 9 },
          { x: 5, y: 8 },
          { x: 6, y: 7.5 },
          { x: 7, y: 7.2 },
          { x: 8, y: 5 },
          { x: 9, y: 4.6 },
          { x: 10, y: 4.2 },
          { x: 11, y: 4.1 },
          { x: 12, y: 4.1 }
        ]
      }
    ]
  }
});
var chart2 = new Chart(chart2, {
  type: "line",
  options: {
    animations: {
      tension: {
        duration: 1000,
        easing: 'linear',
        from: .5,
        to: 0,
        loop: true
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  },
  data: {
    labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    datasets: [
      {
        data: [
          { x: 1, y: 11 },
          { x: 2, y: 10 },
          { x: 3, y: 8 },
          { x: 4, y: 7.5 },
          { x: 5, y: 5 },
          { x: 6, y: 4 },
          { x: 7, y: 3 },
          { x: 8, y: 3.5 },
          { x: 9, y: 2 },
          { x: 10, y: 2.1 }
        ]
      }
    ]
  }
});
var chart3 = new Chart(chart3, {
  type: "line",
  options: {
    animations: {
      tension: {
        duration: 1000,
        easing: 'linear',
        from: .5,
        to: 0,
        loop: true
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  },
  data: {
    labels: [1, 2, 3, 4],
    datasets: [
      {
        data: [
          { x: 1, y: 25 },
          { x: 2, y: 22.5 },
          { x: 3, y: 19.2 },
          { x: 4, y: 12 },
          // { x: 5, y: 9 },
          // { x: 6, y: 7.9 },
          // { x: 7, y: 7.5 },
          // { x: 8, y: 6.9 },
          // { x: 9, y: 6.3 },
          // { x: 10, y: 6.3 },
          // { x: 11, y: 6.3 },
          // { x: 12, y: 6.3 },
          // { x: 13, y: 6.3 }
        ]
      }
    ]
  }
});
