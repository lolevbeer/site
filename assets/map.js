mapboxgl.accessToken = 'pk.eyJ1IjoibG9sZXYiLCJhIjoiY2xxOTZoeHZzMW5xeTJsbzNkaDAxZDczOCJ9.-R_YHGdryDe5ySuVaKTrEg'; // Replace with your Mapbox access token
var zipcodeMarker = null;

/**
 * Calculates distance.
 **/
function haversineDistance(coords1, coords2, isMiles) {
  function toRad(x) {
    return x * Math.PI / 180;
  }

  var lon1 = coords1[0];
  var lat1 = coords1[1];
  var lon2 = coords2[0];
  var lat2 = coords2[1];

  var R = 6371; // km
  var x1 = lat2 - lat1;
  var dLat = toRad(x1);
  var x2 = lon2 - lon1;
  var dLon = toRad(x2)
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;

  if(isMiles) d /= 1.60934;

  return d;
}


/**
 * Add a listing for each store to the sidebar.
 **/
function buildLocationList(places) {
  const listings = document.getElementById('listings');
  listings.innerHTML = ''; // Clear existing listings

  for (const place of places.features) {
    /* Add a new listing section to the sidebar. */
    const listings = document.getElementById('listings');
    const listing = listings.appendChild(document.createElement('div'));
    /* Assign a unique `id` to the listing. */
    listing.id = `listing-${place.properties.id}`;
    /* Assign the `item` class to each listing for styling. */
    listing.className = 'item';

    /* Add the link to the individual listing created above. */
    const link = listing.appendChild(document.createElement('a'));
    link.href = '#';
    link.className = 'title';
    link.id = `link-${place.properties.id}`;
    link.innerHTML = `${place.properties.Name}`;
    const details = link.appendChild(document.createElement('address'));
    details.innerHTML = `${place.properties.address}`;

    /**
     * Listen to the element and when it is clicked, do four things:
     * 1. Update the `currentFeature` to the store associated with the clicked link
     * 2. Fly to the point
     * 3. Close all other popups and display popup for clicked store
     * 4. Highlight listing in sidebar (and remove highlight for all other listings)
     **/
    link.addEventListener('click', function () {
      for (const feature of places.features) {
        if (this.id === `link-${feature.properties.id}`) {
          flyToStore(feature);
          createPopUp(feature);
        }
      }
      const activeItem = document.getElementsByClassName('active');
      if (activeItem[0]) {
        activeItem[0].classList.remove('active');
      }
      this.parentNode.classList.add('active');
    });
  }
}

/**
 * Use Mapbox GL JS's `flyTo` to move the camera smoothly
 * a given center point.
 **/
function flyToStore(currentFeature) {
  map.flyTo({
    center: currentFeature.geometry.coordinates,
    zoom: 15
  });
}

/**
 * Create a Mapbox GL JS `Popup`.
 **/
function createPopUp(currentFeature) {
  const popUps = document.getElementsByClassName('mapboxgl-popup');
  const googleMapLink = `https://www.google.com/maps/search/?api=1&query=${currentFeature.properties.Name} ${currentFeature.properties.address}`;
  if (popUps[0]) popUps[0].remove();
  const popup = new mapboxgl.Popup({ closeButton: false })
    .setLngLat(currentFeature.geometry.coordinates)
    .setHTML(`<h2>${currentFeature.properties.Name}</h2><p>${currentFeature.properties.address}</p><a class="button" target="_blank" href="${googleMapLink}">More info</a>`)
    .setMaxWidth('400px')
    .addTo(map);
}

/**
 * Use Mapbox GL JS's `flyTo` to move the camera smoothly
 * a given center point.
 **/
function flyToStore(currentFeature) {
  map.flyTo({
    center: currentFeature.geometry.coordinates,
    zoom: 15
  });
}

function sortLocationsByZipcode(zipcode) {
  const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${zipcode}.json?access_token=${mapboxgl.accessToken}`;
  const zipMsgBox = document.getElementById('zip-msg');
  let msg = '';
  fetch(geocodingUrl)
    .then(response => response.json())
    .then(data => {
      console.log(data)
      const resultsInUS = data.features.filter(feature =>
        feature.context && feature.context.some(ctx => ctx.text === "United States")
      );

      if (resultsInUS.length > 0) {
        const center = resultsInUS[0].center;
        // Remove the existing marker if it exists
        if (zipcodeMarker) {
          zipcodeMarker.remove();
        }
        msg = resultsInUS[0].place_name;
        // Create a new marker and add it to the map
        zipcodeMarker = new mapboxgl.Marker({ color: 'red' })
          .setLngLat(center)
          .addTo(map);

        // Fly the map to the zipcode location
        map.flyTo({
          center: center,
          zoom: 15
        });

        sortStoresByDistance(center);
      }
      else {
        msg = "Zipcode not found"; // Clear existing listings
      }
      console.log(msg)
      zipMsgBox.innerHTML = msg;
    }
  );
}

function sortStoresByDistance(center) {
  fetch('assets/processed_geo_data.json')
    .then(response => response.json())
    .then(data => {
      data.features.forEach(function(feature) {
        Object.assign(feature.properties, {
          distance: haversineDistance(center, feature.geometry.coordinates, true)
        });
      });

      data.features.sort(function(a, b) {
        return a.properties.distance - b.properties.distance;
      });

      buildLocationList(data); // Rebuild the location list based on sorted data
      map.getSource('places').setData(data);
    });
}


var map = new mapboxgl.Map({
  attributionControl: false,
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11', // Choose a style
  center: [-77.5, 40.440624], // Starting position [lng, lat]
  zoom: 6.5 // Starting zoom
}).addControl(new mapboxgl.AttributionControl({
  customAttribution: '<object id="mini-logo" data="/images/logo.svg" type="image/svg+xml"></object>LOLEV design team'
})).addControl(new mapboxgl.NavigationControl());

map.on('load', function() {
  // Load the GeoJSON data and add it as a source to the map
  map.addSource('places', {
    'type': 'geojson',
    'data': 'assets/processed_geo_data.json'
  });

  fetch('assets/processed_geo_data.json')
  .then(response => response.json())
  .then(data => {
    buildLocationList(data);
  });

  // Add a layer showing the places
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
        'marker'
      ],
      'icon-allow-overlap': true,
      'icon-size': 1.25 // Adjust the size as needed
    }
  });

  // When a click event occurs on a feature in the places layer, open a popup at the location of the feature
  map.on('click', 'places', function(e) {
    var clickedFeature = e.features[0];
    createPopUp(clickedFeature);
  });
});

document.getElementById('zipcode-input').addEventListener('keypress', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sortLocationsByZipcode(this.value);
  }
});

document.getElementById('zipcode-button').addEventListener('click', function() {
  const zipcode = document.getElementById('zipcode-input').value;
  sortLocationsByZipcode(zipcode);
});
