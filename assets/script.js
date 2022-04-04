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
      console.log(lastSlide);
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
    if (timeOut) {
      console.log("User scrolled X");
    }
  }, timeOut);
}

let sliders = document.getElementsByTagName("slider");
let main = document.getElementsByTagName("main");

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
    plugins: {
      legend: {
        display: false
      }
    },
    tooltips: {
      callbacks: {
        label: function (tooltipItem) {
          return tooltipItem.yLabel;
        }
      }
    }
  },
  data: {
    labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    datasets: [
      {
        data: [
          { x: 1, y: 1080 },
          { x: 2, y: 1055 },
          { x: 3, y: 1040 },
          { x: 4, y: 1035 },
          { x: 5, y: 1025 },
          { x: 6, y: 1020 },
          { x: 7, y: 1014 },
          { x: 8, y: 1012 },
          { x: 9, y: 1011 },
          { x: 10, y: 1010 }
        ]
      }
    ]
  }
});
var chart2 = new Chart(chart2, {
  type: "line",
  options: {
    scales: {
      xAxes: [
        {
          gridLines: {
            color: "rgba(0, 0, 0, 0)"
          }
        }
      ],
      yAxes: [
        {
          gridLines: {
            color: "rgba(0, 0, 0, 0)"
          }
        }
      ]
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
          { x: 1, y: 1070 },
          { x: 2, y: 1047 },
          { x: 3, y: 1020 },
          { x: 4, y: 1022 },
          { x: 5, y: 1020 },
          { x: 6, y: 1021 },
          { x: 7, y: 1010 },
          { x: 8, y: 1005 },
          { x: 9, y: 1003 },
          { x: 10, y: 1001 }
        ]
      }
    ]
  }
});
var chart3 = new Chart(chart3, {
  type: "line",
  options: {
    scales: {
      xAxes: [
        {
          gridLines: {
            color: "rgba(0, 0, 0, 0)"
          }
        }
      ],
      yAxes: [
        {
          gridLines: {
            color: "rgba(0, 0, 0, 0)"
          }
        }
      ]
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
          { x: 1, y: 1070 },
          { x: 2, y: 1047 },
          { x: 3, y: 1020 },
          { x: 4, y: 1022 },
          { x: 5, y: 1020 },
          { x: 6, y: 1021 },
          { x: 7, y: 1010 },
          { x: 8, y: 1005 },
          { x: 9, y: 1003 },
          { x: 10, y: 1001 }
        ]
      }
    ]
  }
});
