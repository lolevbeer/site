mapboxgl.accessToken = 'pk.eyJ1IjoibG9sZXYiLCJhIjoiY2xxOTZoeHZzMW5xeTJsbzNkaDAxZDczOCJ9.-R_YHGdryDe5ySuVaKTrEg';

const map = new mapboxgl.Map({
  attributionControl: false,
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [-77.5, 40.440624],
  zoom: 6.5
});

map.addControl(new mapboxgl.AttributionControl({
  customAttribution: '<object id="mini-logo" data="/images/logo.svg" type="image/svg+xml"></object>LOLEV design team'
}));

map.addControl(new mapboxgl.NavigationControl());

let zipcodeMarker = null;

/**
 * Calculates distance.
 **/
function haversineDistance(coords1, coords2, isMiles) {
  function toRad(x) {
    return x * Math.PI / 180;
  }

  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;

  const R = 6371; // km
  const x1 = lat2 - lat1;
  const dLat = toRad(x1);
  const x2 = lon2 - lon1;
  const dLon = toRad(x2);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  let d = R * c;

  if (isMiles) d /= 1.60934;

  return d;
}

/**
 * Add a listing for each store to the sidebar.
 **/
function buildLocationList(places) {
  const listings = document.getElementById('listings');
  listings.innerHTML = ''; // Clear existing listings

  for (const place of places.features) {
    const listing = document.createElement('div');
    listing.id = `listing-${place.properties.id}`;
    listing.className = 'item';

    const link = document.createElement('a');
    link.href = '#';
    link.className = 'title';
    link.id = `link-${place.properties.id}`;
    link.innerHTML = `${place.properties.Name}`;

    link.addEventListener('click', function () {
      const activeItem = document.querySelector('.active');
      if (activeItem) {
        activeItem.classList.remove('active');
      }
      this.parentNode.classList.add('active');
      const feature = places.features.find(f => `link-${f.properties.id}` === this.id);
      flyToStore(feature);
      createPopUp(feature);
    });

    listing.appendChild(link);
    listings.appendChild(listing);
  }
}

/**
 * Use Mapbox GL JS's `flyTo` to move the camera smoothly
 * a given center point.
 **/
function flyToStore(currentFeature) {
  map.flyTo({
    center: currentFeature.geometry.coordinates,
    zoom: 1
  });
}

/**
 * Create a Mapbox GL JS `Popup`.
 **/
function createPopUp(currentFeature) {
  const popUps = document.getElementsByClassName('mapboxgl-popup');
  const googleMapLink = `https://www.google.com/maps/search/?api=1&query=${currentFeature.properties.Name} ${currentFeature.properties.address}`;
  if (popUps[0]) popUps[0].remove();
  new mapboxgl.Popup({ closeButton: false })
    .setLngLat(currentFeature.geometry.coordinates)
    .setHTML(`<h2>${currentFeature.properties.Name}</h2><p>${currentFeature.properties.address}</p><a class="button" target="_blank" href="${googleMapLink}">More info</a>`)
    .setMaxWidth('400px')
    .addTo(map);
}

/**
 * Sorts a list of stores by their distance from a given center point.
 * @param {*} center 
 */
function sortStoresByDistance(center) {
  fetch('assets/processed_geo_data.json')
    .then(response => response.json())
    .then(data => {
      data.features.forEach(feature => {
        feature.properties.distance = haversineDistance(center, feature.geometry.coordinates, true);
      });

      data.features.sort((a, b) => a.properties.distance - b.properties.distance);

      buildLocationList(data);
      map.getSource('places').setData(data);
    });
}

/**
 * Sorts a list of stores by their distance from a given center point.
 * @param {*} zipcode 
 */
function sortLocationsByZipcode(zipcode) {
  const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${zipcode}.json?access_token=${mapboxgl.accessToken}`;
  const zipMsgBox = document.getElementById('zip-msg');
  let msg = '';
  fetch(geocodingUrl)
    .then(response => response.json())
    .then(data => {
      const resultsInUS = data.features.filter(feature =>
        feature.context && feature.context.some(ctx => ctx.text === "United States")
      );

      if (resultsInUS.length > 0) {
        const center = resultsInUS[0].center;
        if (zipcodeMarker) {
          zipcodeMarker.remove();
        }
        msg = resultsInUS[0].place_name;
        zipcodeMarker = new mapboxgl.Marker({ color: 'red' })
          .setLngLat(center)
          .addTo(map);

        map.flyTo({
          center: center,
          zoom: 10
        });

        sortStoresByDistance(center);
      }
      else {
        msg = "Zipcode not found";
      }
      zipMsgBox.innerHTML = msg;
    });
}

/**
 * Change the zoom level of the map based on the window size.
 */
function adjustMapZoomForWindowSize() {
  const newZoomLevel = window.innerWidth < 600 ? 5.5 : 6.5;
  map.setZoom(newZoomLevel);
}

map.on('load', function () {
  map.addSource('places', {
    'type': 'geojson',
    'data': 'assets/processed_geo_data.json'
  });

  fetch('assets/processed_geo_data.json')
    .then(response => response.json())
    .then(buildLocationList);

  map.addLayer({
    'id': 'places',
    'type': 'symbol',
    'source': 'places',
    'layout': {
      'icon-image': [
        'match',
        ['get', 'customerType'],
        'Restaurant', 'restaurant',
        'Bar', 'beer',
        'Grocery', 'grocery',
        'Six Pack Shop', 'alcohol-shop',
        'marker'
      ],
      'icon-allow-overlap': true,
    }
  });

  map.addLayer({
    'id': 'places-labels',
    'type': 'symbol',
    'source': 'places',
    'minzoom': 6, // Set the minimum zoom level for text labels
    'layout': {
      'text-field': ['get', 'Name'],
      'text-size': 12,
      'text-anchor': 'top',
      'text-offset': [0, 1.5]
    },
    'paint': {
      'text-color': '#FFFFFF'
    }
  });

  adjustMapZoomForWindowSize();

  map.on('click', 'places', function (e) {
    createPopUp(e.features[0]);
  });
});

document.getElementById('zipcode-input').addEventListener('keypress', function (event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sortLocationsByZipcode(this.value);
  }
});

document.getElementById('zipcode-button').addEventListener('click', function () {
  sortLocationsByZipcode(document.getElementById('zipcode-input').value);
});

window.addEventListener('resize', adjustMapZoomForWindowSize);
