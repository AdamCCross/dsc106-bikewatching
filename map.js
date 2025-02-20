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

// Declare globally to avoid scope issues
let circles = null;
let timeFilter = -1;
const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');
let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];
var trips = []
let stations = []

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

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
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
    
    const tripsURL = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv"
    d3.csv(tripsURL).then(data => {
        trips = data.map(trip => ({
            ...trip,
            started_at: new Date(trip.start_time),
            ended_at: new Date(trip.ended_at),
        }));

        const departures = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.start_station_id,
        );

        // Create a map of arrivals
        const arrivals = d3.rollup(
            trips,
            (v) => v.length,
            (d) => d.end_station_id // Group by end_station_id
        );

        // Add traffic data (departures and arrivals) to stations
        stations = stations.map((station) => {
            let id = station.short_name;
            station.arrivals = arrivals.get(id) ?? 0;
            station.departures = departures.get(id) ?? 0;
            station.totalTraffic = station.arrivals + station.departures; // Compute total traffic
            return station;
        });

        // Update the radius scale for circles based on traffic data
        const radiusScale = d3
          .scaleSqrt()
          .domain([0, d3.max(stations, (d) => d.totalTraffic)])
          .range([0, 25]);

        // Update circle sizes based on total traffic
        circles
            .attr('r', d => radiusScale(d.totalTraffic)) // Adjust circle size based on total traffic
            .each(function(d) {
                // Add <title> for browser tooltips
                d3.select(this).select('title').remove(); // Remove old title
                d3.select(this)
                  .append('title')
                  .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                });
        console.log("Trips:", trips)
        function updateTimeDisplay() {
            timeFilter = Number(timeSlider.value);  // Get slider value
          
            if (timeFilter === -1) {
              selectedTime.textContent = '';  // Clear time display
              anyTimeLabel.style.display = 'block';  // Show "(any time)"
            } else {
              selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
              anyTimeLabel.style.display = 'none';  // Hide "(any time)"
            }
          
            // Trigger filtering logic which will be implemented in the next step
            filterTripsbyTime();
        }
        
        function minutesSinceMidnight(date) {
            return date.getHours() * 60 + date.getMinutes();
        }
        
        function filterTripsbyTime() {
            filteredTrips = timeFilter === -1
                ? trips
                : trips.filter((trip) => {
                    const startedMinutes = minutesSinceMidnight(trip.started_at);
                    const endedMinutes = minutesSinceMidnight(trip.ended_at);
                    return (
                      Math.abs(startedMinutes - timeFilter) <= 60 ||
                      Math.abs(endedMinutes - timeFilter) <= 60
                    );
                  });
        
            filteredDepartures = d3.rollup(
                filteredTrips,
                (v) => v.length,
                (d) => d.start_station_id,
            );
        
            // Create a map of arrivals
            filteredArrivals = d3.rollup(
                filteredTrips,
                (v) => v.length,
                (d) => d.end_station_id // Group by end_station_id
            );
            
            filteredStations = stations.map((station) => {
                station = { ...station };
                let id = station.short_name;
                station.arrivals = filteredArrivals.get(id) ?? 0;
                station.departures = filteredDepartures.get(id) ?? 0;
                station.totalTraffic = station.arrivals + station.departures; // Compute total traffic
                return station;
            });
        
            // Update the radius scale for circles based on traffic data
            const radiusScale = d3
                .scaleSqrt()
                .domain([0, d3.max(filteredStations, (d) => d.totalTraffic)])
                .range([0, 25]);
        
            // Update circle sizes based on total traffic
            circles
                .data(filteredStations)
                .attr('r', d => radiusScale(d.totalTraffic)) // Adjust circle size based on total traffic
                .each(function(d) {
                    // Add <title> for browser tooltips
                    d3.select(this).select('title').remove(); // Remove old title
                    d3.select(this)
                        .append('title')
                        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                    });
          
                // we need to update the station data here explained in the next couple paragraphs
        }
        updateTimeDisplay();
        timeSlider.addEventListener('input', updateTimeDisplay);
    }).catch(error => {
    console.error('Error loading CSV:', error);  // Handle errors if CSV loading fails
    });
});