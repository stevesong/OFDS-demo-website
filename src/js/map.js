// Initialize the PMTiles protocol
let protocol = new pmtiles.Protocol({ metadata: true });
maplibregl.addProtocol("pmtiles", protocol.tile);

// Initialize the map
const map = new maplibregl.Map({
    container: "map",
    zoom: 4,  // Zoomed out to see most of Africa
    center: [18.5, 2.0],  // Centered slightly adjusted for better Africa view
    style: {
        version: 8,
        sources: {
            // Add a minimal base map with country borders and land colors
            "base-boundaries": {
                type: "raster",
                tiles: [
                    "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
                ],
                tileSize: 256,
                attribution: '© CartoDB, Internet Society, undersea cables courtesy Telegeography'
            },
            // Add Africa country outlines
            "africa-boundaries": {
                type: "vector",
                url: "https://d316kar6yg8hyq.cloudfront.net/Africa_Admin0.json"
            },
            // Add the TileJSON source for fibre networks
            "fibre-networks": {
                type: "vector",
                url: "https://d1oia3aqt3b077.cloudfront.net/ofds_spans_by_layer.json",
                attribution: '© OFDS',
                minzoom: 0,  
                maxzoom: 22,
                maxRequests: 10,  // Limit concurrent requests
                tileSize: 512     // Use larger tiles to reduce number of requests
            },
            // Add the TileJSON source for fibre network nodes
            "fibre-network-nodes": {
                type: "vector",
                url: "https://d1oia3aqt3b077.cloudfront.net/ofds_nodes_combined.json",
                attribution: '© OFDS',
                minzoom: 0,
                maxzoom: 22
            }
        },
        // Add glyphs property for text rendering
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        layers: [
            // Base map with land and water
            {
                id: "base-map",
                type: "raster",
                source: "base-boundaries",
                minzoom: 0,
                maxzoom: 22
            }
        ]
    }
});

// Add error handling for tile loading
map.on('error', (e) => {
    if (e.error && e.error.status === 429) {
        console.warn('Rate limit reached. Please wait before making more requests.');
        // Optionally implement a backoff strategy
        setTimeout(() => {
            map.reload();
        }, 5000); // Wait 5 seconds before retrying
    }
});

// Add map controls
map.addControl(new maplibregl.NavigationControl(), 'top-left');
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

// Add a fullscreen control
map.addControl(new maplibregl.FullscreenControl());

// Create a popup for network information
const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: '300px',
    className: 'custom-popup'
});

// Function to generate a random color
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

// When the map loads, add the layers
map.on('load', () => {
    console.log('Map loaded');
    
    // Add country boundaries layer
    map.addLayer({
        id: 'africa-boundaries',
        source: 'africa-boundaries',
        'source-layer': 'Africa_Admin0',
        type: 'line',
        paint: {
            'line-color': '#DDDDDD',
            'line-width': 1,
            'line-opacity': 0.4
        },
        minzoom: 6  // Only show country boundaries when zoomed to level 5 or higher
    });
    // Create legend container
    const legend = document.createElement('div');
    legend.id = 'legend';
    legend.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
    legend.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    legend.style.padding = '10px';
    legend.style.borderRadius = '4px';
    legend.style.maxHeight = '400px';
    legend.style.overflowY = 'auto';
    legend.style.position = 'absolute';
    legend.style.bottom = '20px';
    legend.style.right = '20px';
    legend.style.zIndex = '1';

    // Add legend title
    const title = document.createElement('h3');
    title.textContent = 'Fibre Networks';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '14px';
    legend.appendChild(title);

    // Get the source layers from the PMTiles source
    const source = map.getSource('fibre-networks');
    if (source) {
        // Get all available source layers
        const sourceLayers = source.vectorLayerIds;

        // Add layers for each source layer
        sourceLayers.forEach(network => {
            const color = getRandomColor();
            
            // Add the network line layer
            map.addLayer({
                id: `fibre-${network}`,
                type: 'line',
                source: 'fibre-networks',
                'source-layer': network,
                minzoom: 0,
                maxzoom: 22,
                layout: {
                    'visibility': 'visible'
                },
                paint: {
                    'line-color': color,
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        0, 1,
                        5, 2,
                        10, 3
                    ],
                    'line-opacity': 0.8
                }
            });

            // Add network to legend
            const legendItem = document.createElement('div');
            legendItem.style.display = 'flex';
            legendItem.style.alignItems = 'center';
            legendItem.style.marginBottom = '5px';
            legendItem.style.cursor = 'pointer';

            // Add color swatch
            const colorSwatch = document.createElement('div');
            colorSwatch.style.width = '20px';
            colorSwatch.style.height = '20px';
            colorSwatch.style.backgroundColor = color;
            colorSwatch.style.marginRight = '10px';
            colorSwatch.style.borderRadius = '4px';

            // Add network name
            const networkName = document.createElement('span');
            networkName.textContent = network.replace(/_/g, ' ');
            networkName.style.fontSize = '12px';

            // Add toggle functionality
            legendItem.addEventListener('click', () => {
                const visibility = map.getLayoutProperty(`fibre-${network}`, 'visibility');
                if (visibility === 'visible') {
                    map.setLayoutProperty(`fibre-${network}`, 'visibility', 'none');
                    map.setLayoutProperty(`fibre-${network}-nodes`, 'visibility', 'none');
                    legendItem.style.opacity = '0.5';
                } else {
                    map.setLayoutProperty(`fibre-${network}`, 'visibility', 'visible');
                    map.setLayoutProperty(`fibre-${network}-nodes`, 'visibility', 'visible');
                    legendItem.style.opacity = '1';
                }
            });

            legendItem.appendChild(colorSwatch);
            legendItem.appendChild(networkName);
            legend.appendChild(legendItem);
        });

        // Add legend to map
        map.getContainer().appendChild(legend);
    } else {
        console.error('Source "fibre-networks" not found');
    }
}); 