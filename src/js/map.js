// Configuration constants
const CONFIG = {
  initialView: {
    zoom: 4,
    center: [18.5, 2.0], // Centered for better Africa view
  },
  sources: {
    baseMap: {
      url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      attribution:
        "© CartoDB, Internet Society, undersea cables courtesy Telegeography",
    },
    boundaries: {
      url: "https://d316kar6yg8hyq.cloudfront.net/Africa_Admin0.json",
    },
    fibreNetworks: {
      url: "https://d1oia3aqt3b077.cloudfront.net/ofds_spans_by_layer.json",
      attribution: "© OFDS",
    },
    nodes: {
      url: "https://ofds-demo.s3.us-east-1.amazonaws.com/ofds_nodes_combined.geojson",
    },
  },
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  legend: {
    title: "Fibre Networks",
  },
};

// Initialize the map and related components
class FibreNetworkMap {
  constructor() {
    this.initializePMTiles();
    this.initializeMap();
    this.setupEventListeners();
    this.setupControls();
    this.popup = this.createPopup();
  }

  initializePMTiles() {
    console.log("Initializing PMTiles protocol...");
    const protocol = new pmtiles.Protocol({ metadata: true });
    maplibregl.addProtocol("pmtiles", protocol.tile);
  }

  initializeMap() {
    console.log("Creating map...");
    this.map = new maplibregl.Map({
      container: "map",
      zoom: CONFIG.initialView.zoom,
      center: CONFIG.initialView.center,
      style: {
        version: 8,
        sources: {
          "base-boundaries": {
            type: "raster",
            tiles: [CONFIG.sources.baseMap.url],
            tileSize: 256,
            attribution: CONFIG.sources.baseMap.attribution,
          },
          "africa-boundaries": {
            type: "vector",
            url: CONFIG.sources.boundaries.url,
          },
          "fibre-networks": {
            type: "vector",
            url: CONFIG.sources.fibreNetworks.url,
            attribution: CONFIG.sources.fibreNetworks.attribution,
            minzoom: 0,
            maxzoom: 22,
            maxRequests: 10, // Limit concurrent requests
            tileSize: 512, // Use larger tiles to reduce number of requests
          },
        },
        glyphs: CONFIG.glyphs,
        layers: [
          {
            id: "base-map",
            type: "raster",
            source: "base-boundaries",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
    });
  }

  setupEventListeners() {
    this.map.on("error", this.handleMapError.bind(this));
    this.map.on("load", this.handleMapLoad.bind(this));
  }

  setupControls() {
    this.map.addControl(new maplibregl.NavigationControl(), "top-left");
    this.map.addControl(new maplibregl.ScaleControl(), "bottom-left");
    this.map.addControl(new maplibregl.FullscreenControl());
  }

  createPopup() {
    return new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: "300px",
      className: "custom-popup",
    });
  }

  handleMapError(e) {
    console.error("Map error:", e);
    if (e.error && e.error.status === 429) {
      console.warn(
        "Rate limit reached. Please wait before making more requests.",
      );
      setTimeout(() => {
        this.map.reload();
      }, 5000); // Wait 5 seconds before retrying
    }
  }

  handleMapLoad() {
    console.log("Map loaded event fired");
    this.addBoundariesLayer();
    this.addNodeLayers();
    this.loadNodeData();
    this.addFibreNetworkLayers();
    this.createLegend();
  }

  addBoundariesLayer() {
    this.map.addLayer({
      id: "africa-boundaries",
      source: "africa-boundaries",
      "source-layer": "Africa_Admin0",
      type: "line",
      paint: {
        "line-color": "#DDDDDD",
        "line-width": 1,
        "line-opacity": 0.4,
      },
      minzoom: 6,
    });
  }

  addNodeLayers() {
    // Add the GeoJSON source for nodes
    this.map.addSource("fibre-network-nodes-geojson", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    // Add the node points layer
    this.map.addLayer({
      id: "fibre-network-nodes-geojson",
      type: "circle",
      source: "fibre-network-nodes-geojson",
      minzoom: 5,
      paint: {
        "circle-color": "#DD0000",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          2,
          10,
          4,
          15,
          6,
        ],
        "circle-stroke-width": 1,
        "circle-stroke-color": "#FFFFFF",
        "circle-opacity": 0.8,
      },
    });

    // Add node labels
    this.map.addLayer({
      id: "fibre-network-node-labels",
      type: "symbol",
      source: "fibre-network-nodes-geojson",
      minzoom: 5,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 12,
        "text-anchor": "top",
        "text-offset": [0, 1],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#FFFFFF",
        "text-halo-color": "#000000",
        "text-halo-width": 1,
      },
    });
  }

  loadNodeData() {
    const nodesSource = this.map.getSource("fibre-network-nodes-geojson");
    if (nodesSource) {
      console.log("Loading nodes data...");
      nodesSource.setData(CONFIG.sources.nodes.url);
    }
  }

  getRandomColor() {
    return (
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")
    );
  }

  addFibreNetworkLayers() {
    const source = this.map.getSource("fibre-networks");
    if (!source || !source.vectorLayerIds) {
      console.error('Source "fibre-networks" not found or has no layers');
      return;
    }

    this.networkColors = {};
    source.vectorLayerIds.forEach((network) => {
      const color = this.getRandomColor();
      this.networkColors[network] = color;

      this.map.addLayer({
        id: `fibre-${network}`,
        type: "line",
        source: "fibre-networks",
        "source-layer": network,
        minzoom: 0,
        paint: {
          "line-color": color,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            1,
            5,
            2,
            10,
            3,
          ],
          "line-opacity": 0.8,
        },
      });
    });
  }

  createLegend() {
    const legend = document.createElement("div");
    legend.id = "legend";
    legend.className = "mapboxgl-ctrl mapboxgl-ctrl-group";
    Object.assign(legend.style, {
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      padding: "10px",
      borderRadius: "4px",
      maxHeight: "400px",
      overflowY: "auto",
      position: "absolute",
      bottom: "20px",
      right: "20px",
      zIndex: "1",
    });

    // Add legend title
    const title = document.createElement("h3");
    title.textContent = CONFIG.legend.title;
    title.style.margin = "0 0 10px 0";
    title.style.fontSize = "14px";
    legend.appendChild(title);

    // Add network entries
    Object.entries(this.networkColors).forEach(([network, color]) => {
      const legendItem = this.createLegendItem(network, color);
      legend.appendChild(legendItem);
    });

    // Add legend to map
    this.map.getContainer().appendChild(legend);
  }

  createLegendItem(network, color) {
    const item = document.createElement("div");
    Object.assign(item.style, {
      display: "flex",
      alignItems: "center",
      marginBottom: "5px",
      cursor: "pointer",
    });

    const swatch = document.createElement("div");
    Object.assign(swatch.style, {
      width: "20px",
      height: "20px",
      backgroundColor: color,
      marginRight: "10px",
      borderRadius: "4px",
    });

    const name = document.createElement("span");
    name.textContent = network.replace(/_/g, " ");
    name.style.fontSize = "12px";

    // Add toggle functionality
    item.addEventListener("click", () => {
      const layerId = `fibre-${network}`;
      const visibility = this.map.getLayoutProperty(layerId, "visibility");
      const newVisibility = visibility === "visible" ? "none" : "visible";

      this.map.setLayoutProperty(layerId, "visibility", newVisibility);
      item.style.opacity = newVisibility === "visible" ? "1" : "0.5";
    });

    item.appendChild(swatch);
    item.appendChild(name);
    return item;
  }
}

// Initialize the application when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new FibreNetworkMap();
});
