// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoiYWNjcm9zcyIsImEiOiJjbTdjZjVuem4waTlyMmxvZHV6b2JtajkwIn0.tKfpq-UE5RaQBKcKgRr8KQ';

// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18 // Maximum allowed zoom
});

// Bike line Style
const paintLineStyle = {
    'line-color': 'green',
    'line-width': 3,
    'line-opacity': 0.4
}

// Declare circles globally to avoid scope issues
let circles = null;

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
}

// Function to update circle positions when the map moves/zooms
function updatePositions() {
    circles
      .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
      .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
}

map.on('load', () => { 
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'boston-bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: paintLineStyle
    });
    
    map.addLayer({
        id: 'cambridge-bike-lanes',
        type: 'line',
        source: 'cambridge_route',
        paint: paintLineStyle
    });

    // Load bike stations
    const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json"
    const svg = d3.select('#map').select('svg');
    let stations = []

    d3.json(jsonurl).then(jsonData => {
        console.log('Loaded JSON Data:', jsonData);  // Log to verify structure
        stations = jsonData.data.stations;
        console.log('Stations Array:', stations);
  
        // Append circles to the SVG for each station
        circles = svg.selectAll('circle')
          .data(stations)
          .enter()
          .append('circle')
          .attr('r', 5)               // Radius of the circle
          .attr('fill', 'steelblue')  // Circle fill color
          .attr('stroke', 'white')    // Circle border color
          .attr('stroke-width', 1)    // Circle border thickness
          .attr('opacity', 0.8);      // Circle opacity
  
      
          // Reposition markers on map interactions
          updatePositions();
          map.on('move', updatePositions);     // Update during map movement
          map.on('zoom', updatePositions);     // Update during zooming
          map.on('resize', updatePositions);   // Update on window resize
          map.on('moveend', updatePositions);  // Final adjustment after movement ends
      }).catch(error => {
        console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
      });
});