/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This file defines the main `gdm-map-app` LitElement component.
 * This component is responsible for:
 * - Rendering the user interface, including the Google Photorealistic 3D Map,
 *   chat messages area, and user input field.
 * - Managing the state of the chat (e.g., idle, generating, thinking).
 * - Handling user input and sending messages to the Gemini AI model.
 * - Processing responses from the AI, including displaying text and handling
 *   function calls (tool usage) related to map interactions.
 * - Integrating with the Google Maps JavaScript API to load and control the map,
 *   display markers, polylines for routes, and geocode locations.
 * - Providing the `handleMapQuery` method, which is called by the MCP server
 *   (via index.tsx) to update the map based on AI tool invocations.
 */

// Google Maps JS API Loader: Used to load the Google Maps JavaScript API.
import { Loader } from "@googlemaps/js-api-loader";
import hljs from "highlight.js";
import { html, LitElement, PropertyValueMap } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

import { MapParams } from "./mcp_maps_server";
import {
  GEOSPATIAL_FEATURES,
  GeoFeature,
  LatLng,
  SOUTH_GOBI_CENTER,
  getOverlapZones,
  filterFeatures,
  checkFrictionOverlaps,
} from "./geospatial_layers";

/** Markdown formatting function with syntax hilighting */
export const marked = new Marked(
  markedHighlight({
    async: true,
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code, lang, info) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  }),
);

const ICON_BUSY = html`
  <svg
    class="rotating"
    xmlns="http://www.w3.org/2000/svg"
    height="24px"
    viewBox="0 -960 960 960"
    width="24px"
    fill="currentColor">
    <path
      d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-155.5t86-127Q252-817 325-848.5T480-880q17 0 28.5 11.5T520-840q0 17-11.5 28.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480q0 82-31.5 155t-86 127.5q-54.5 54.5-127 86T480-80Z" />
  </svg>
`;

/**
 * Chat state enum to manage the current state of the chat interface.
 */
export enum ChatState {
  IDLE,
  GENERATING,
  THINKING,
  EXECUTING,
}

/**
 * Chat tab enum to manage the current selected tab in the chat interface.
 */
enum ChatTab {
  GEMINI,
  GEOSPATIAL,
}

/**
 * Chat role enum to manage the current role of the message.
 */
export enum ChatRole {
  USER,
  ASSISTANT,
  SYSTEM,
}

// Google Maps API Key: Use a Vite environment variable instead of embedding the key.
// This key is essential for loading and using Google Maps services.
// Ensure this key is configured with access to the "Maps JavaScript API",
// "Geocoding API", and the "Directions API".
const USER_PROVIDED_GOOGLE_MAPS_API_KEY: string =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const EXAMPLE_PROMPTS = [
  "Уул уурхайн ашиглалтын лиценз болон тусгай хамгаалалттай бүсүүдийг харуулах",
  "Ямар уул уурхайн лиценз тусгай хамгаалалттай газартай давхцаж байна вэ?",
  "Оюу толгой зэс-алтны ордын байгаль орчны эрсдэлийн төлөв ямар байна?",
  "Бүх давхаргыг идэвхжүүлээд Өмнөговь руу очих",
  "Оюут улаан ордын нөөцийн цамхаг руу очих",
  "Таван толгойн нүүрсний ордын нөөцийг харуулах",
  "Усны ай сав газрын давхаргыг унтраах",
  "Байгаль орчны эрсдэлтэй давхцлуудыг газрын зураг дээр тодруулах",
  "Хайгуулын бүх талбайг шүүж харах",
  "Баян говийн маргаантай хайгуулын талбайн мэдээлэл",
];

/**
 * MapApp component for Photorealistic 3D Maps.
 */
@customElement("gdm-map-app")
export class MapApp extends LitElement {
  @query("#anchor") anchor?: HTMLDivElement;
  // Google Maps: Reference to the <gmp-map-3d> DOM element where the map is rendered.
  @query("#mapContainer") mapContainerElement?: HTMLElement; // Will be <gmp-map-3d>
  @query("#messageInput") messageInputElement?: HTMLInputElement;

  @state() chatState = ChatState.IDLE;
  @state() isRunning = true;
  @state() selectedChatTab = ChatTab.GEMINI;
  @state() inputMessage = "";
  @state() messages: HTMLElement[] = [];
  @state() mapInitialized = false;
  @state() mapError = "";

  // Geospatial Workspace States (Updated support for all Mongolia GIS layers)
  @state() activeLayers = {
    mining: true, // Уул уурхайн лиценз
    exploration: true, // Хайгуулын талбай
    reserves: true, // Ордын нөөц
    protected: true, // Тусгай хамгаалалттай бүс
    watershed: true, // Усны ай сав
    company: true, // Компани / обьект
    admin: true, // Аймаг, сумын хил
    road: true, // Замын сүлжээ
    risk: true, // Байгаль орчны эрсдэл (pulsing overlap overlay)
    resourceReserve: true, // Resource Reserve Visualization Layer
  };
  @state() filterQuery = "";
  @state() isOverlapActive = true;
  @state() selectedFeatureId = "";
  @state() blinkState = false;
  @state() systemLogs: string[] = [
    "Газар зүйн мэдээллийн нэгдсэн систем бэлэн болов.",
    "Говийн бүсийн байгаль орчны үнэлгээний матриц ачаалагдлаа.",
    "Давхцал болон эрсдэлийн хяналтын систем идэвхтэй байна.",
  ];

  // Google Maps: Instance of the Google Maps 3D map.
  private map?: any;
  // Google Maps: Instance of the Google Maps Geocoding service.
  private geocoder?: any;
  // Google Maps: Instance of the current map marker (Marker3DElement).
  private marker?: any;

  // Google Maps: References to 3D map element constructors.
  private Map3DElement?: any;
  private Marker3DElement?: any;
  private Polyline3DElement?: any;
  private Polygon3DElement?: any; // Added for GIS Layers

  // References for GIS rendered assets which we must flush and update
  private drawnElements: any[] = [];
  private overlapPolygons: any[] = [];
  private blinkInterval?: any;

  // Google Maps: Instance of the Google Maps Directions service.
  private directionsService?: any;
  // Google Maps: Instance of the current route polyline.
  private routePolyline?: any;
  // Google Maps: Markers for origin and destination of a route.
  private originMarker?: any;
  private destinationMarker?: any;

  sendMessageHandler?: CallableFunction;

  constructor() {
    super();
    // Set initial input from a random example prompt
    this.setNewRandomPrompt();
  }

  createRenderRoot() {
    return this;
  }

  protected firstUpdated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>,
  ): void {
    // Google Maps: Load the map when the component is first updated.
    this.loadMap();

    // Start overlap flashing outline animation interval
    this.blinkInterval = setInterval(() => {
      this.blinkState = !this.blinkState;
      this.overlapPolygons.forEach((poly) => {
        try {
          if (poly) {
            poly.strokeColor = this.blinkState
              ? "rgba(239, 68, 68, 0.95)"
              : "rgba(255, 255, 255, 0.9)";
            poly.strokeWidth = this.blinkState ? 6 : 3;
          }
        } catch (err) {
          // ignore transient errors
        }
      });
    }, 600);
  }

  disconnectedCallback() {
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
    }
    super.disconnectedCallback();
  }

  /**
   * Sets the input message to a new random prompt from EXAMPLE_PROMPTS.
   */
  private setNewRandomPrompt() {
    if (EXAMPLE_PROMPTS.length > 0) {
      this.inputMessage =
        EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
    }
  }

  /**
   * Google Maps: Loads the Google Maps JavaScript API using the JS API Loader.
   * It initializes necessary map services like Geocoding and Directions,
   * and imports 3D map elements (Map3DElement, Marker3DElement, Polyline3DElement).
   * Handles API key validation and error reporting.
   */
  async loadMap() {
    const isApiKeyPlaceholder =
      USER_PROVIDED_GOOGLE_MAPS_API_KEY === "" ||
      USER_PROVIDED_GOOGLE_MAPS_API_KEY === "";

    if (isApiKeyPlaceholder) {
      this.mapError = `Google Maps API Key is not configured correctly.
Please edit the map_app.ts file and replace the placeholder value for
USER_PROVIDED_GOOGLE_MAPS_API_KEY with your actual API key.
You can find this constant near the top of the map_app.ts file.`;
      console.error(this.mapError);
      this.requestUpdate();
      return;
    }

    const loader = new Loader({
      apiKey: USER_PROVIDED_GOOGLE_MAPS_API_KEY,
      version: "beta", // Using 'beta' for Photorealistic 3D Maps features
      libraries: ["geocoding", "routes", "geometry"], // Request necessary libraries
    });

    try {
      await loader.load();
      // Google Maps: Import 3D map specific library elements.
      const maps3dLibrary = await (window as any).google.maps.importLibrary(
        "maps3d",
      );
      this.Map3DElement = maps3dLibrary.Map3DElement;
      this.Marker3DElement = maps3dLibrary.Marker3DElement;
      this.Polyline3DElement = maps3dLibrary.Polyline3DElement;
      this.Polygon3DElement = maps3dLibrary.Polygon3DElement; // Loaded Polygon3D

      if ((window as any).google && (window as any).google.maps) {
        // Google Maps: Initialize the DirectionsService.
        this.directionsService = new (
          window as any
        ).google.maps.DirectionsService();
      } else {
        console.error("DirectionsService not loaded.");
      }

      // Google Maps: Initialize the map itself.
      this.initializeMap();
      this.mapInitialized = true;
      this.mapError = "";
    } catch (error) {
      console.error("Error loading Google Maps API:", error);
      this.mapError =
        "Could not load Google Maps. Check console for details and ensure API key is correct. If using 3D features, ensure any necessary Map ID is correctly configured if required programmatically.";
      this.mapInitialized = false;
    }
    this.requestUpdate();
  }

  /**
   * Google Maps: Initializes the map instance and the Geocoder service.
   * This is called after the Google Maps API has been successfully loaded.
   */
  initializeMap() {
    if (!this.mapContainerElement || !this.Map3DElement) {
      console.error("Map container or Map3DElement class not ready.");
      return;
    }
    // Google Maps: Assign the <gmp-map-3d> element to the map property.
    this.map = this.mapContainerElement;
    if ((window as any).google && (window as any).google.maps) {
      // Google Maps: Initialize the Geocoder.
      this.geocoder = new (window as any).google.maps.Geocoder();
    } else {
      console.error("Geocoder not loaded.");
    }

    // Auto focus onto South Gobi and render our custom layer shapes
    setTimeout(() => {
      this.handleZoomToFeature("south_gobi");
      this.renderGeospatialLayers();
    }, 1200);
  }

  setChatState(state: ChatState) {
    this.chatState = state;
  }

  /**
   * Google Maps: Clears existing map elements like markers and polylines
   * before adding new ones. This ensures the map doesn't get cluttered with
   * old search results or routes.
   */
  private _clearMapElements() {
    if (this.marker) {
      this.marker.remove();
      this.marker = undefined;
    }
    if (this.routePolyline) {
      this.routePolyline.remove();
      this.routePolyline = undefined;
    }
    if (this.originMarker) {
      this.originMarker.remove();
      this.originMarker = undefined;
    }
    if (this.destinationMarker) {
      this.destinationMarker.remove();
      this.destinationMarker = undefined;
    }
  }

  /**
   * Google Maps: Handles viewing a specific location on the map.
   * It uses the Geocoding service to find coordinates for the `locationQuery`,
   * then flies the camera to that location and places a 3D marker.
   * @param locationQuery The string query for the location (e.g., "Eiffel Tower").
   */
  private async _handleViewLocation(locationQuery: string) {
    if (
      !this.mapInitialized ||
      !this.map ||
      !this.geocoder ||
      !this.Marker3DElement
    ) {
      if (!this.mapError) {
        const { textElement } = this.addMessage("error", "Processing error...");
        textElement.innerHTML = await marked.parse(
          "Map is not ready to display locations. Please check configuration.",
        );
      }
      console.warn(
        "Map not initialized, geocoder or Marker3DElement not available, cannot render query.",
      );
      return;
    }
    this._clearMapElements(); // Google Maps: Clear previous elements.

    // Google Maps: Use Geocoding service to find the location.
    this.geocoder.geocode(
      { address: locationQuery },
      async (results: any, status: string) => {
        if (status === "OK" && results && results[0] && this.map) {
          const location = results[0].geometry.location;

          // Google Maps: Define camera options and fly to the location.
          const cameraOptions = {
            center: { lat: location.lat(), lng: location.lng(), altitude: 0 },
            heading: 0,
            tilt: 67.5,
            range: 2000, // Distance from the target in meters
          };
          (this.map as any).flyCameraTo({
            endCamera: cameraOptions,
            durationMillis: 1500,
          });

          // Google Maps: Create and add a 3D marker to the map.
          this.marker = new this.Marker3DElement();
          this.marker.position = {
            lat: location.lat(),
            lng: location.lng(),
            altitude: 0,
          };
          const label =
            locationQuery.length > 30
              ? locationQuery.substring(0, 27) + "..."
              : locationQuery;
          this.marker.label = label;
          (this.map as any).appendChild(this.marker);
        } else {
          console.error(
            `Geocode was not successful for "${locationQuery}". Reason: ${status}`,
          );
          const rawErrorMessage = `Could not find location: ${locationQuery}. Reason: ${status}`;
          const { textElement } = this.addMessage(
            "error",
            "Processing error...",
          );
          textElement.innerHTML = await marked.parse(rawErrorMessage);
        }
      },
    );
  }

  /**
   * Google Maps: Handles displaying directions between an origin and destination.
   * It uses the DirectionsService to calculate the route, then draws a 3D polyline
   * for the route and places 3D markers at the origin and destination.
   * The camera is adjusted to fit the entire route.
   * @param originQuery The starting point for directions.
   * @param destinationQuery The ending point for directions.
   */
  private async _handleDirections(
    originQuery: string,
    destinationQuery: string,
  ) {
    if (
      !this.mapInitialized ||
      !this.map ||
      !this.directionsService ||
      !this.Marker3DElement ||
      !this.Polyline3DElement
    ) {
      if (!this.mapError) {
        const { textElement } = this.addMessage("error", "Processing error...");
        textElement.innerHTML = await marked.parse(
          "Map is not ready for directions. Please check configuration.",
        );
      }
      console.warn(
        "Map not initialized or DirectionsService/3D elements not available, cannot render directions.",
      );
      return;
    }
    this._clearMapElements(); // Google Maps: Clear previous elements.

    // Google Maps: Use DirectionsService to get the route.
    this.directionsService.route(
      {
        origin: originQuery,
        destination: destinationQuery,
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
      },
      async (response: any, status: string) => {
        if (
          status === "OK" &&
          response &&
          response.routes &&
          response.routes.length > 0
        ) {
          const route = response.routes[0];

          // Google Maps: Draw the route polyline using Polyline3DElement.
          if (route.overview_path && this.Polyline3DElement) {
            const pathCoordinates = route.overview_path.map((p: any) => ({
              lat: p.lat(),
              lng: p.lng(),
              altitude: 5,
            })); // Add slight altitude
            this.routePolyline = new this.Polyline3DElement();
            this.routePolyline.coordinates = pathCoordinates;
            this.routePolyline.strokeColor = "blue";
            this.routePolyline.strokeWidth = 10;
            (this.map as any).appendChild(this.routePolyline);
          }

          // Google Maps: Add marker for the origin.
          if (
            route.legs &&
            route.legs[0] &&
            route.legs[0].start_location &&
            this.Marker3DElement
          ) {
            const originLocation = route.legs[0].start_location;
            this.originMarker = new this.Marker3DElement();
            this.originMarker.position = {
              lat: originLocation.lat(),
              lng: originLocation.lng(),
              altitude: 0,
            };
            this.originMarker.label = "Origin";
            this.originMarker.style = {
              color: { r: 0, g: 128, b: 0, a: 1 }, // Green
            };
            (this.map as any).appendChild(this.originMarker);
          }

          // Google Maps: Add marker for the destination.
          if (
            route.legs &&
            route.legs[0] &&
            route.legs[0].end_location &&
            this.Marker3DElement
          ) {
            const destinationLocation = route.legs[0].end_location;
            this.destinationMarker = new this.Marker3DElement();
            this.destinationMarker.position = {
              lat: destinationLocation.lat(),
              lng: destinationLocation.lng(),
              altitude: 0,
            };
            this.destinationMarker.label = "Destination";
            this.destinationMarker.style = {
              color: { r: 255, g: 0, b: 0, a: 1 }, // Red
            };
            (this.map as any).appendChild(this.destinationMarker);
          }

          // Google Maps: Adjust camera to fit the route bounds.
          if (route.bounds) {
            const bounds = route.bounds;
            const center = bounds.getCenter();
            let range = 10000; // Default range

            // Calculate a more appropriate range based on the route's diagonal distance
            if (
              (window as any).google.maps.geometry &&
              (window as any).google.maps.geometry.spherical
            ) {
              const spherical = (window as any).google.maps.geometry.spherical;
              const ne = bounds.getNorthEast();
              const sw = bounds.getSouthWest();
              const diagonalDistance = spherical.computeDistanceBetween(ne, sw);
              range = diagonalDistance * 1.7; // Multiplier to ensure bounds are visible
            } else {
              console.warn(
                "google.maps.geometry.spherical not available for range calculation. Using fallback range.",
              );
            }

            range = Math.max(range, 2000); // Ensure a minimum sensible range

            const cameraOptions = {
              center: { lat: center.lat(), lng: center.lng(), altitude: 0 },
              heading: 0,
              tilt: 45, // Tilt for better 3D perspective of the route
              range: range,
            };
            (this.map as any).flyCameraTo({
              endCamera: cameraOptions,
              durationMillis: 2000,
            });
          }
        } else {
          console.error(
            `Directions request failed. Origin: "${originQuery}", Destination: "${destinationQuery}". Status: ${status}. Response:`,
            response,
          );
          const rawErrorMessage = `Could not get directions from "${originQuery}" to "${destinationQuery}". Reason: ${status}`;
          const { textElement } = this.addMessage(
            "error",
            "Processing error...",
          );
          textElement.innerHTML = await marked.parse(rawErrorMessage);
        }
      },
    );
  }

  /**
   * Google Maps: This function is the primary interface for the MCP server (via index.tsx)
   * to trigger updates on the Google Map. When the AI model uses a map-related tool
   * (e.g., view location, get directions), the MCP server processes this request
   * and calls this function with the appropriate parameters.
   *
   * Based on the `params` received, this function will:
   * - If `params.location` is present, call `_handleViewLocation` to show a specific place.
   * - If `params.origin` and `params.destination` are present, call `_handleDirections`
   *   to display a route.
   * - If only `params.destination` is present (as a fallback), it will treat it as a location to view.
   *
   * This mechanism allows the AI's tool usage to be directly reflected on the map UI.
   * @param params An object containing parameters for the map query, like
   *               `location`, `origin`, or `destination`.
   */
  /**
   * Appends an informational operational log to the running workspace status bar.
   */
  addSystemNotification(text: string) {
    const timestamp = new Date().toLocaleTimeString();
    this.systemLogs = [`[${timestamp}] ${text}`, ...this.systemLogs].slice(
      0,
      50,
    );
    this.requestUpdate();
  }

  /**
   * Real-time layered rendering engine. Generates, styles, and maps point/polygon assets.
   */
  renderGeospatialLayers() {
    if (!this.map || !this.mapInitialized) {
      console.warn("Map is not fully initialized. Layer rendering postponed.");
      return;
    }

    // 1. Remove all old vector elements from the 3D canvas
    this.drawnElements.forEach((el) => {
      try {
        if (el) el.remove();
      } catch (err) {
        console.warn("Error clearing element:", err);
      }
    });
    this.drawnElements = [];
    this.overlapPolygons = [];

    // 2. Triage features by query
    let featuresToRender = GEOSPATIAL_FEATURES;
    if (this.filterQuery.trim().length > 0) {
      featuresToRender = filterFeatures(this.filterQuery);
    }

    // 3. Map vectors to map element constructors
    featuresToRender.forEach((feat) => {
      // Check if feature type layer visibility is enabled
      let isVisible = (this.activeLayers as any)[feat.type];
      if (feat.type === "reserves" || feat.type === "exploration") {
        isVisible = isVisible && this.activeLayers.resourceReserve;
      }
      if (!isVisible) return;

      if (feat.type === "company") {
        if (!this.Marker3DElement) return;
        const markerInst = new this.Marker3DElement();
        markerInst.position = feat.coordinates[0];
        markerInst.label = feat.name;

        // Glowing orange points for companies
        markerInst.style = {
          color: { r: 249, g: 115, b: 22, a: 1 },
        };

        this.map.appendChild(markerInst);
        this.drawnElements.push(markerInst);
      } else if (feat.type === "road") {
        if (!this.Polyline3DElement) return;
        const polyline = new this.Polyline3DElement();
        polyline.coordinates = feat.coordinates;
        polyline.strokeColor = "rgba(100, 116, 139, 0.85)"; // Slate Grey
        polyline.strokeWidth = 5;
        this.map.appendChild(polyline);
        this.drawnElements.push(polyline);
      } else if (feat.type === "reserves") {
        // Visual Metaphor Rule (NOT REAL SCALE):
        // Low reserves -> flat / small extrusion
        // Medium reserves -> medium 3D tower
        // High reserves -> tall glowing tower structures
        // Height formula: height = log(reserveValue) * 350
        if (!this.Polygon3DElement) return;
        const center = feat.coordinates[0];
        const d = 0.007; // width size of the 3D tower
        const val = feat.properties.reserveValue || 1000000;
        const towerHeight = Math.log(val) * 350;

        const towerCoords = [
          { lat: center.lat + d, lng: center.lng + d, altitude: towerHeight },
          { lat: center.lat + d, lng: center.lng - d, altitude: towerHeight },
          { lat: center.lat - d, lng: center.lng - d, altitude: towerHeight },
          { lat: center.lat - d, lng: center.lng + d, altitude: towerHeight },
          { lat: center.lat + d, lng: center.lng + d, altitude: towerHeight },
        ];

        const polyInst = new this.Polygon3DElement();
        polyInst.outerCoordinates = towerCoords;
        polyInst.extruded = true;
        polyInst.strokeWidth = 3;

        if (feat.properties.reserveGrade === "High") {
          polyInst.fillColor = "rgba(245, 158, 11, 0.85)"; // Tall Glowing gold tower
          polyInst.strokeColor = "rgba(255, 255, 255, 0.95)";
          polyInst.strokeWidth = 4;
        } else if (feat.properties.reserveGrade === "Medium") {
          polyInst.fillColor = "rgba(217, 119, 6, 0.65)"; // Medium orange tower
          polyInst.strokeColor = "rgba(245, 158, 11, 0.85)";
        } else {
          polyInst.fillColor = "rgba(180, 83, 9, 0.4)"; // Low/flat amber tower
          polyInst.strokeColor = "rgba(180, 83, 9, 0.7)";
        }

        this.map.appendChild(polyInst);
        this.drawnElements.push(polyInst);
      } else {
        if (!this.Polygon3DElement) return;
        const polyInst = new this.Polygon3DElement();
        polyInst.outerCoordinates = feat.coordinates;
        polyInst.strokeWidth = 3;
        polyInst.extruded = feat.type === "mining";

        switch (feat.type) {
          case "mining":
            polyInst.fillColor = "rgba(239, 68, 68, 0.35)"; // Red, extruded 3D
            polyInst.strokeColor = "rgba(220, 38, 38, 0.85)";
            polyInst.strokeWidth = 4;
            break;
          case "exploration":
            polyInst.fillColor = "rgba(6, 182, 212, 0.2)"; // Translucent blue
            // Animated scan effect: changing stroke visibility, color, or thickness
            polyInst.strokeColor = this.blinkState
              ? "rgba(34, 211, 238, 0.95)"
              : "rgba(14, 116, 144, 0.6)";
            polyInst.strokeWidth = this.blinkState ? 4 : 2;
            break;
          case "protected":
            polyInst.fillColor = "rgba(34, 197, 94, 0.25)"; // Green transparent
            polyInst.strokeColor = "rgba(22, 163, 74, 0.85)";
            break;
          case "watershed":
            polyInst.fillColor = "rgba(59, 130, 246, 0.25)"; // Hydrological blue
            polyInst.strokeColor = "rgba(37, 99, 235, 0.85)";
            break;
          case "admin":
            polyInst.fillColor = "rgba(156, 163, 175, 0.05)"; // grey boundaries
            polyInst.strokeColor = "rgba(107, 114, 128, 0.6)";
            break;
          case "risk":
            // High ecological risk zone: Pulsing/flashing red overlay
            polyInst.fillColor = this.blinkState
              ? "rgba(239, 68, 68, 0.55)"
              : "rgba(239, 68, 68, 0.25)";
            polyInst.strokeColor = "rgba(185, 28, 28, 0.95)";
            polyInst.strokeWidth = 5;
            this.overlapPolygons.push(polyInst);
            break;
        }

        this.map.appendChild(polyInst);
        this.drawnElements.push(polyInst);
      }
    });

    this.requestUpdate();
  }

  /**
   * Centers the fly camera onto South Gobi or specific polygon nodes. Clamped to Mongolia.
   */
  handleZoomToFeature(featureId: string) {
    if (!this.map || !this.mapInitialized) {
      console.warn("Camera pan failed: map is offline.");
      return;
    }

    const cleanedId = featureId.toLowerCase().trim();

    if (cleanedId === "south_gobi" || cleanedId === "south gobi") {
      const cameraOptions = {
        center: { lat: 43.45, lng: 105.45, altitude: 0 },
        heading: 0,
        tilt: 45,
        range: 160000, // Zoom height in meters (160km view)
      };
      (this.map as any).flyCameraTo({
        endCamera: cameraOptions,
        durationMillis: 2200,
      });
      this.selectedFeatureId = "";
      this.addSystemNotification(
        "Нисэх камер: Хан Алтайн говь, Өмнөговь аймгийн хяналтын зурваст төвлөрлөө.",
      );
      return;
    }

    const feature = GEOSPATIAL_FEATURES.find(
      (f) => f.id === featureId || f.id.toLowerCase() === cleanedId,
    );
    if (feature) {
      // Compute central gravity coordinate
      let centerLat = 0;
      let centerLng = 0;
      if (feature.coordinates.length > 0) {
        feature.coordinates.forEach((c) => {
          centerLat += c.lat;
          centerLng += c.lng;
        });
        centerLat /= feature.coordinates.length;
        centerLng /= feature.coordinates.length;
      }

      const isPoint =
        feature.type === "company" || feature.coordinates.length === 1;
      const cameraOptions = {
        center: { lat: centerLat, lng: centerLng, altitude: 0 },
        heading: 320,
        tilt: 55, // Perspective view
        range: isPoint ? 9000 : 38000, // Zoom closer for markers
      };

      (this.map as any).flyCameraTo({
        endCamera: cameraOptions,
        durationMillis: 2200,
      });

      this.selectedFeatureId = feature.id;
      this.addSystemNotification(
        `Нисэх камер: Харах өнцөг шилжсэн: ${feature.name}`,
      );
    } else {
      // Fuzzy search in names
      const fuzzy = GEOSPATIAL_FEATURES.find((f) =>
        f.name.toLowerCase().includes(cleanedId),
      );
      if (fuzzy) {
        this.handleZoomToFeature(fuzzy.id);
      } else {
        this.addSystemNotification(
          `Мэдээлэл: "${featureId}" нэртэй обьектын координат системд олдсонгүй.`,
        );
      }
    }
  }

  /**
   * Updates map layers after user clicks manual visibility checkboxes.
   */
  toggleLayerManual(type: keyof typeof this.activeLayers) {
    this.activeLayers = {
      ...this.activeLayers,
      [type]: !this.activeLayers[type],
    };

    // Sync overlap active macro state
    if (type === "risk") {
      this.isOverlapActive = this.activeLayers.risk;
    }

    const statusStr = this.activeLayers[type] ? "АСААВ" : "УНТРААВ";
    this.addSystemNotification(
      `Шууд үйлдэл: Давхарга [${type}] төлөвийг ${statusStr} болгов.`,
    );
    this.renderGeospatialLayers();
  }

  /**
   * Filters attributes on typing queries.
   */
  handleFilterInput(q: string) {
    this.filterQuery = q;
    this.renderGeospatialLayers();
    this.addSystemNotification(`Шүүлтүүр: Хайлтын түлхүүр үг -> "${q}"`);
  }

  /**
   * Resets visibility toggles.
   */
  resetFilter() {
    this.activeLayers = {
      mining: true,
      exploration: true,
      reserves: true,
      protected: true,
      watershed: true,
      company: true,
      admin: true,
      road: true,
      risk: true,
    };
    this.filterQuery = "";
    this.isOverlapActive = true;
    this.renderGeospatialLayers();
    this.addSystemNotification(
      "Хяналтын самбар: Бүх давхаргуудын анхны утгыг сэргээв.",
    );
  }

  /**
   * Handles action macros.
   */
  handleFilterClear() {
    this.handleFilterInput("");
  }

  handleQuickMacro(action: string) {
    switch (action) {
      case "zoom_south_gobi":
        this.handleZoomToFeature("south_gobi");
        break;
      case "toggle_overlaps":
        this.isOverlapActive = !this.isOverlapActive;
        this.activeLayers = {
          ...this.activeLayers,
          risk: this.isOverlapActive,
        };
        this.addSystemNotification(
          `Макро үйлдэл: Эрсдэлт давхцлуудын анимейшн лугшилт: ${this.isOverlapActive ? "Асаалттай" : "Унтраатай"}`,
        );
        this.renderGeospatialLayers();
        break;
      case "show_all":
        this.activeLayers = {
          mining: true,
          exploration: true,
          reserves: true,
          protected: true,
          watershed: true,
          company: true,
          admin: true,
          road: true,
          risk: true,
        };
        this.isOverlapActive = true;
        this.addSystemNotification(
          "Макро үйлдэл: Газрын зургийн бүх вектор давхаргыг идэвхжүүлэв.",
        );
        this.renderGeospatialLayers();
        break;
      case "clear_all":
        this.activeLayers = {
          mining: false,
          exploration: false,
          reserves: false,
          protected: false,
          watershed: false,
          company: false,
          admin: false,
          road: false,
          risk: false,
        };
        this.isOverlapActive = false;
        this.addSystemNotification(
          "Макро үйлдэл: Газрын зургийн бүх давхаргыг нуув.",
        );
        this.renderGeospatialLayers();
        break;
    }
  }

  /**
   * Primary interface for MCP server to interactively trigger actions.
   */
  async handleMapQuery(params: MapParams) {
    console.log("handleMapQuery params:", params);
    this.addSystemNotification(`MCP Tool requested: ${JSON.stringify(params)}`);

    // 1. Zoom/Pan camera to specific features
    if (params.zoomFeatureId) {
      this.handleZoomToFeature(params.zoomFeatureId);
    }

    // 2. Toggle specific layer visibility
    if (params.layerId) {
      const lid = params.layerId as keyof typeof this.activeLayers | "all";
      const visible =
        params.layerVisible !== undefined ? params.layerVisible : true;
      if (lid === "all") {
        this.activeLayers = {
          mining: visible,
          exploration: visible,
          reserves: visible,
          protected: visible,
          watershed: visible,
          company: visible,
          admin: visible,
          road: visible,
          risk: visible,
        };
      } else if (this.activeLayers[lid] !== undefined) {
        this.activeLayers = {
          ...this.activeLayers,
          [lid]: visible,
        };
        if (lid === "risk") {
          this.isOverlapActive = visible;
        }
      }
      this.renderGeospatialLayers();
    }

    // 3. Toggle friction conflicts map action
    if (params.highlightOverlaps !== undefined) {
      this.isOverlapActive = params.highlightOverlaps;
      this.activeLayers = {
        ...this.activeLayers,
        risk: params.highlightOverlaps,
      };
      this.renderGeospatialLayers();
    }

    // 4. Filter features in real-time
    if (params.filterQuery !== undefined) {
      this.filterQuery = params.filterQuery;
      this.renderGeospatialLayers();
    }

    // 5. Normal location mappings or route flyovers
    if (params.location) {
      const q = params.location.toLowerCase();
      if (
        q.includes("south gobi") ||
        q.includes("omnogovi") ||
        q.includes("өмнөговь")
      ) {
        this.handleZoomToFeature("south_gobi");
      } else {
        this._handleViewLocation(params.location);
      }
    } else if (params.origin && params.destination) {
      this._handleDirections(params.origin, params.destination);
    }
  }

  setInputField(message: string) {
    this.inputMessage = message.trim();
  }

  addMessage(role: string, message: string) {
    const div = document.createElement("div");
    div.classList.add("turn");
    div.classList.add(`role-${role.trim()}`);
    div.setAttribute("aria-live", "polite");

    const thinkingDetails = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Тунгаан бодож буй явц...";
    thinkingDetails.classList.add("thinking");
    thinkingDetails.setAttribute("aria-label", "Model thinking process");
    const thinkingElement = document.createElement("div");
    thinkingDetails.append(summary);
    thinkingDetails.append(thinkingElement);
    div.append(thinkingDetails);

    const textElement = document.createElement("div");
    textElement.className = "text";
    textElement.innerHTML = message;
    div.append(textElement);

    this.messages = [...this.messages, div];
    this.scrollToTheEnd();
    return {
      thinkingContainer: thinkingDetails,
      thinkingElement: thinkingElement,
      textElement: textElement,
    };
  }

  scrollToTheEnd() {
    if (!this.anchor) return;
    this.anchor.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }

  async sendMessageAction(message?: string, role?: string) {
    if (this.chatState !== ChatState.IDLE) return;

    let msg = "";
    let usedComponentInput = false; // Flag to track if component's input was used

    if (message) {
      msg = message.trim();
    } else {
      msg = this.inputMessage.trim();
      if (msg.length > 0) {
        this.inputMessage = "";
        usedComponentInput = true;
      } else if (
        this.inputMessage.trim().length === 0 &&
        this.inputMessage.length > 0
      ) {
        this.inputMessage = "";
        usedComponentInput = true;
      }
    }

    if (msg.length === 0) {
      if (usedComponentInput) {
        this.setNewRandomPrompt();
      }
      return;
    }

    const msgRole = role ? role.toLowerCase() : "user";

    if (msgRole === "user" && msg) {
      const { textElement } = this.addMessage(msgRole, "...");
      textElement.innerHTML = await marked.parse(msg);
    }

    if (this.sendMessageHandler) {
      await this.sendMessageHandler(msg, msgRole);
    }

    if (usedComponentInput) {
      this.setNewRandomPrompt();
    }
  }

  private async inputKeyDownAction(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessageAction();
    }
  }

  render() {
    // Google Maps: Initial camera parameters for the <gmp-map-3d> element.
    const initialCenter = "43.450,105.450,100"; // Center on South Gobi
    const initialRange = "160000"; // View range in meters (160km view)
    const initialTilt = "45"; // Camera tilt in degrees
    const initialHeading = "0"; // Camera heading in degrees

    return html`
      <div class="gdm-map-app">
        <div
          class="main-container"
          role="application"
          aria-label="Интерактив Газрын Зургийн Хэсэг">
          ${this.mapError
            ? html`
                <div
                  class="map-error-message"
                  role="alert"
                  aria-live="assertive">
                  ${this.mapError}
                </div>
              `
            : ""}
          <!-- Google Maps: The core 3D Map custom element -->
          <gmp-map-3d
            id="mapContainer"
            style="height: 100%; width: 100%;"
            aria-label="Монгол Улс - 3D Газрын Зураг"
            mode="hybrid"
            center="${initialCenter}"
            heading="${initialHeading}"
            tilt="${initialTilt}"
            range="${initialRange}"
            internal-usage-attribution-ids="gmp_aistudio_threedmapjsmcp_v0.1_showcase"
            default-ui-disabled="true"
            role="application"></gmp-map-3d>
        </div>
        <div
          class="sidebar"
          role="complementary"
          aria-labelledby="chat-heading">
          <div
            class="selector"
            role="tablist"
            aria-label="Ажлын талбар"
            style="display: flex; background: #0f172a; border-bottom: 2px solid #1e293b; padding: 4px;">
            <button
              id="geminiTab"
              role="tab"
              aria-selected=${this.selectedChatTab === ChatTab.GEMINI}
              aria-controls="chat-panel"
              style="flex: 1; padding: 12px; text-align: center; border: none; background: transparent; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: 0.2s;"
              class=${classMap({
                "selected-tab": this.selectedChatTab === ChatTab.GEMINI,
              })}
              @click=${() => {
                this.selectedChatTab = ChatTab.GEMINI;
              }}>
              <span
                id="chat-heading"
                style="color: ${this.selectedChatTab === ChatTab.GEMINI
                  ? "#60a5fa"
                  : "#94a3b8"}">
                Гео-Хиймэл Оюун
              </span>
            </button>
            <button
              id="geospatialTab"
              role="tab"
              aria-selected=${this.selectedChatTab === ChatTab.GEOSPATIAL}
              aria-controls="geospatial-panel"
              style="flex: 1; padding: 12px; text-align: center; border: none; background: transparent; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: 0.2s;"
              class=${classMap({
                "selected-tab": this.selectedChatTab === ChatTab.GEOSPATIAL,
              })}
              @click=${() => {
                this.selectedChatTab = ChatTab.GEOSPATIAL;
              }}>
              <span
                style="color: ${this.selectedChatTab === ChatTab.GEOSPATIAL
                  ? "#60a5fa"
                  : "#94a3b8"}">
                Хяналтын Самбар
              </span>
            </button>
          </div>

          <div
            id="chat-panel"
            role="tabpanel"
            aria-labelledby="geminiTab"
            class=${classMap({
              tabcontent: true,
              showtab: this.selectedChatTab === ChatTab.GEMINI,
            })}>
            <div class="chat-messages" aria-live="polite" aria-atomic="false">
              ${this.messages}
              <div id="anchor"></div>
            </div>
            <div class="footer">
              <div
                id="chatStatus"
                aria-live="assertive"
                class=${classMap({
                  hidden: this.chatState === ChatState.IDLE,
                })}>
                ${this.chatState === ChatState.GENERATING
                  ? html`
                      ${ICON_BUSY} Хариулт бэлдэж байна...
                    `
                  : html``}
                ${this.chatState === ChatState.THINKING
                  ? html`
                      ${ICON_BUSY} Тунгаан бодож байна...
                    `
                  : html``}
                ${this.chatState === ChatState.EXECUTING
                  ? html`
                      ${ICON_BUSY} Газрын зураг ажиллуулж байна...
                    `
                  : html``}
              </div>
              <div
                id="inputArea"
                role="form"
                aria-labelledby="message-input-label">
                <label id="message-input-label" class="hidden">
                  Асуултаа бичнэ үү
                </label>
                <input
                  type="text"
                  id="messageInput"
                  .value=${this.inputMessage}
                  @input=${(e: InputEvent) => {
                    this.inputMessage = (e.target as HTMLInputElement).value;
                  }}
                  @keydown=${(e: KeyboardEvent) => {
                    this.inputKeyDownAction(e);
                  }}
                  placeholder="Өмнөд говийн экологийн давхцлын талаар асуух..."
                  autocomplete="off"
                  aria-labelledby="message-input-label"
                  aria-describedby="sendButton-desc" />
                <button
                  id="sendButton"
                  @click=${() => {
                    this.sendMessageAction();
                  }}
                  aria-label="Илгээх"
                  aria-describedby="sendButton-desc"
                  ?disabled=${this.chatState !== ChatState.IDLE}
                  class=${classMap({
                    disabled: this.chatState !== ChatState.IDLE,
                  })}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="30px"
                    viewBox="0 -960 960 960"
                    width="30px"
                    fill="currentColor"
                    aria-hidden="true">
                    <path
                      d="M120-160v-240l320-80-320-80v-240l760 320-760 320Z" />
                  </svg>
                </button>
                <p id="sendButton-desc" class="hidden">
                  Хиймэл оюун руу мессеж илгээнэ.
                </p>
              </div>
            </div>
          </div>

          <div
            id="geospatial-panel"
            role="tabpanel"
            aria-labelledby="geospatialTab"
            class=${classMap({
              tabcontent: true,
              showtab: this.selectedChatTab === ChatTab.GEOSPATIAL,
            })}
            style="padding: 1.25em; display: flex; flex-direction: column; gap: 1.5em; overflow-y: auto; height: calc(100vh - 60px); background: #0b0f19; color: #f1f5f9; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
            <!-- Quick environmental alert header -->
            <div
              style="background: rgba(220, 38, 38, 0.1); padding: 1em; border-radius: 8px; border-left: 4px solid #ef4444; border-top: 1px solid rgba(220, 38, 38, 0.2); border-right: 1px solid rgba(220, 38, 38, 0.1); border-bottom: 1px solid rgba(220, 38, 38, 0.1); box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
              <h3
                style="font-size: 1rem; font-weight: 700; margin-bottom: 0.4em; color: #fca5a5; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.1rem;">⚠️</span>
                Байгаль Орчны Ноцтой Давхцал
              </h3>
              <p
                style="font-size: 0.82rem; color: #cbd5e1; line-height: 1.45; margin: 0;">
                Хамгаалалттай газар нутаг болон усны сав газар уул уурхайн
                лицензтэй давхцсан
                <strong style="color: #f87171;">
                  ${checkFrictionOverlaps().length}
                </strong>
                ноцтой зөрчлийг хяналтын систем илрүүллээ. Давхаргын унтраалгаар
                шүүж харна уу.
              </p>
            </div>

            <!-- Quick Actions macros -->
            <div>
              <h4
                style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-top: 0; margin-bottom: 0.75em; font-weight: 700;">
                Шуурхай Макро Хяналт
              </h4>
              <div
                style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <button
                  @click=${() => this.handleQuickMacro("zoom_south_gobi")}
                  style="background: #1e293b; border: 1px solid #334155; color: #f1f5f9; padding: 8px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: 0.2s;"
                  onmouseover="this.style.background='#334155'"
                  onmouseout="this.style.background='#1e293b'">
                  🎯 Өмнөговь руу очих
                </button>
                <button
                  @click=${() => this.handleQuickMacro("toggle_overlaps")}
                  style="background: ${this.isOverlapActive
                    ? "#7f1d1d"
                    : "#1e293b"}; border: 1px solid ${this.isOverlapActive
                    ? "#f87171"
                    : "#334155"}; color: #f1f5f9; padding: 8px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: 0.2s;">
                  🚨 Эрсдэл Лугших:
                  ${this.isOverlapActive ? "АСААЛТТАЙ" : "УНТРААСТАЙ"}
                </button>
                <button
                  @click=${() => this.handleQuickMacro("show_all")}
                  style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; color: #a7f3d0; padding: 8px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: 0.2s;">
                  📂 Бүх давхаргыг нээх
                </button>
                <button
                  @click=${() => this.handleQuickMacro("clear_all")}
                  style="background: #1e293b; border: 1px solid #334155; color: #cbd5e1; padding: 8px; border-radius: 6px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: 0.2s;">
                  ❌ Бүх давхаргыг нуух
                </button>
              </div>
            </div>

            <!-- Geospatial visibility toggles list -->
            <div>
              <h4
                style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-top: 0; margin-bottom: 0.75em; display: flex; justify-content: space-between; align-items: center; font-weight: 700;">
                <span>Зураглалын Идэвхтэй Давхаргууд</span>
                <button
                  @click=${() => this.resetFilter()}
                  style="background: transparent; border: none; color: #3b82f6; font-size: 0.75rem; cursor: pointer; font-weight: 600;">
                  Анхны төлөв
                </button>
              </h4>
              <div
                style="display: flex; flex-direction: column; gap: 10px; background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #1e293b;">
                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; background: #ef4444; border-radius: 2px;"></span>
                    Уул уурхайн лиценз (Улаан 3D)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.mining}
                    @change=${() => this.toggleLayerManual("mining")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #ef4444;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; background: #06b6d4; border-radius: 2px;"></span>
                    Хайгуулын талбай (Цэнхэр / Скан)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.exploration}
                    @change=${() => this.toggleLayerManual("exploration")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #06b6d4;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; background: #f59e0b; border-radius: 2px;"></span>
                    Ордын нөөц (Алтлаг / 3D Цамхаг)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.reserves}
                    @change=${() => this.toggleLayerManual("reserves")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #f59e0b;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; background: #22c55e; border-radius: 2px;"></span>
                    Тусгай хамгаалалттай газар нутаг (Ногоон)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.protected}
                    @change=${() => this.toggleLayerManual("protected")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #22c55e;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; background: #3b82f6; border-radius: 2px;"></span>
                    Усны ай сав газар (Цэнхэр судал)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.watershed}
                    @change=${() => this.toggleLayerManual("watershed")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #3b82f6;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; background: #f97316; border-radius: 50%;"></span>
                    Компани / обьект (Улбар шар цэг)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.company}
                    @change=${() => this.toggleLayerManual("company")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #f97316;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; border: 1px dashed #94a3b8; border-radius: 2px;"></span>
                    Аймаг, сумын хил (Саарал шугам)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.admin}
                    @change=${() => this.toggleLayerManual("admin")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #94a3b8;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 2px; background: #64748b; border-radius: 1px;"></span>
                    Замын сүлжээ (Саарал шугам)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.road}
                    @change=${() => this.toggleLayerManual("road")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #64748b;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0; font-weight: 750; color: #fca5a5;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; background: #dc2626; border-radius: 2px; box-shadow: 0 0 6px #ef4444;"></span>
                    Байгаль орчны эрсдэл (Лугших Улаан)
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.risk}
                    @change=${() => this.toggleLayerManual("risk")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #dc2626;" />
                </label>

                <label
                  style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; font-size: 0.85rem; padding: 2px 0; font-weight: 750; color: #a5f3fc; border-top: 1px solid #1e293b; padding-top: 8px; margin-top: 4px;">
                  <span style="display: flex; align-items: center; gap: 8px;">
                    <span
                      style="display: inline-block; width: 10px; height: 10px; background: #06b6d4; border-radius: 2px; box-shadow: 0 0 6px #22d3ee;"></span>
                    Resource Reserve Visualization Layer
                  </span>
                  <input
                    type="checkbox"
                    ?checked=${this.activeLayers.resourceReserve}
                    @change=${() => this.toggleLayerManual("resourceReserve")}
                    style="cursor: pointer; width: 15px; height: 15px; border-radius: 4px; accent-color: #06b6d4;" />
                </label>
              </div>
            </div>

            <!-- Feature Filter Input -->
            <div>
              <h4
                style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-top: 0; margin-bottom: 0.5em; font-weight: 700;">
                Хайх болон Түлхүүр үгээр шүүх
              </h4>
              <div style="display: flex; gap: 8px;">
                <input
                  type="text"
                  .value=${this.filterQuery}
                  @input=${(e: InputEvent) =>
                    this.handleFilterInput(
                      (e.target as HTMLInputElement).value,
                    )}
                  placeholder="Жишээ: Оюу Толгой, Нүүрс, Орд..."
                  style="flex: 1; background: #0f172a; border: 1px solid #1e293b; color: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-size: 0.82rem; outline: none;" />
                ${this.filterQuery
                  ? html`
                      <button
                        @click=${() => this.handleFilterInput("")}
                        style="background: #1e293b; color: #f1f5f9; border: 1px solid #334155; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                        Цэвэрлэх
                      </button>
                    `
                  : html``}
              </div>
            </div>

            <!-- Interactive overlap descriptors -->
            <div>
              <h4
                style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-top: 0; margin-bottom: 0.75em; font-weight: 700;">
                Идэвхтэй Газар Зүйн Зөрчилт Талбар
              </h4>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${getOverlapZones().map((overlap) => {
                  const isSelected = this.selectedFeatureId === overlap.id;
                  return html`
                    <div
                      @click=${() => this.handleZoomToFeature(overlap.id)}
                      style="background: ${isSelected
                        ? "rgba(37, 99, 235, 0.15)"
                        : "#0f172a"}; padding: 12px; border-radius: 8px; border: 1px solid ${isSelected
                        ? "#3b82f6"
                        : "#1e293b"}; cursor: pointer; transition: 0.2s;"
                      onmouseover="this.style.borderColor='#3b82f6'"
                      onmouseout="this.style.borderColor='${isSelected
                        ? "#3b82f6"
                        : "#1e293b"}'">
                      <div
                        style="font-size: 0.85rem; font-weight: 700; color: #fca5a5; margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <span>${overlap.name}</span>
                        <span
                          style="font-size: 0.65rem; background: rgba(220, 38, 38, 0.2); color: #f87171; padding: 2px 6px; border-radius: 9999px; font-weight: 600; border: 1px solid rgba(220, 38, 38, 0.4);">
                          Зөрчил
                        </span>
                      </div>
                      <div
                        style="font-size: 0.78rem; color: #94a3b8; line-height: 1.45;">
                        ${overlap.properties.description}
                      </div>
                      <div
                        style="margin-top: 8px; font-size: 0.7rem; color: #60a5fa; text-align: right; font-weight: 600;">
                        Камераар очиж харах ⌖
                      </div>
                    </div>
                  `;
                })}
              </div>
            </div>

            <!-- Console/System Operations log -->
            <div
              style="flex: 1; display: flex; flex-direction: column; min-height: 140px;">
              <h4
                style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-top: 0; margin-bottom: 0.5em; font-weight: 700;">
                Хяналтын Системийн Операцийн Лог
              </h4>
              <div
                style="background: #020617; border: 1px solid #1e293b; padding: 10px; border-radius: 8px; font-family: 'Fira Code', 'Courier New', monospace; font-size: 0.72rem; color: #34d399; overflow-y: auto; flex: 1; max-height: 180px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.8);">
                ${this.systemLogs.map(
                  (log) => html`
                    <div style="margin-bottom: 4px; line-height: 1.35;">
                      <span style="color: #64748b;">$</span>
                      ${log}
                    </div>
                  `,
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
