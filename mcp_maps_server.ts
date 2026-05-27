/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This file defines and runs an MCP (Model Context Protocol) server.
 * The server exposes tools that an AI model (like Gemini) can call to interact
 * with Google Maps functionality. These tools include:
 * - `view_location_google_maps`: To display a specific location.
 * - `directions_on_google_maps`: To get and display directions.
 *
 * When the AI decides to use one of these tools, the MCP server receives the
 * call and then uses the `mapQueryHandler` callback to send the relevant
 * parameters (location, origin/destination) to the frontend
 * (MapApp component in map_app.ts) to update the map display.
 */

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {z} from 'zod';

export interface MapParams {
  location?: string;
  origin?: string;
  destination?: string;

  // Custom Geospatial intelligence properties
  layerId?: string;
  layerVisible?: boolean;
  zoomFeatureId?: string;
  highlightOverlaps?: boolean;
  filterQuery?: string;
}

export async function startMcpGoogleMapServer(
  transport: Transport,
  /**
   * Callback function provided by the frontend (index.tsx) to handle map updates.
   * This function is invoked when an AI tool call requires a map interaction,
   * passing the necessary parameters to update the map view (e.g., show location,
   * display directions, or toggle and highlight geospatial layers).
   */
  mapQueryHandler: (params: MapParams) => void,
) {
  // Create an MCP server
  const server = new McpServer({
    name: 'GeoAI Intelligence Map Server',
    version: '1.0.0',
  });

  server.tool(
    'view_location_google_maps',
    'View a specific default city or query and fly camera there in standard mode.',
    {query: z.string()},
    async ({query}) => {
      mapQueryHandler({location: query});
      return {
        content: [{type: 'text', text: `Standard view navigating to: ${query}`}],
      };
    },
  );

  server.tool(
    'toggle_geospatial_layer',
    'Turns a specific geospatial layer ON or OFF on the map display. Layers include: mining, protected, watershed, company, admin, overlap, or all.',
    {
      layerId: z.enum(['mining', 'protected', 'watershed', 'company', 'admin', 'overlap', 'all']),
      visible: z.boolean()
    },
    async ({layerId, visible}) => {
      mapQueryHandler({layerId, layerVisible: visible});
      return {
        content: [{type: 'text', text: `Layer '${layerId}' is now ${visible ? 'ON' : 'OFF'}`}],
      };
    }
  );

  server.tool(
    'zoom_to_geospatial_feature',
    'Fly camera, center map, and zoom to a specific feature or key location. Supported identifiers include specific feature IDs (like mining_oyu_tolgoi, mining_tavan_tolgoi, mining_bayan_gobi, protected_gurvansaikhan, protected_gobi_restricted, watershed_galba_uul, watershed_gobi_lakes, admin_omnogovi) or regional terms like "south_gobi".',
    {
      featureId: z.string()
    },
    async ({featureId}) => {
      mapQueryHandler({zoomFeatureId: featureId});
      return {
        content: [{type: 'text', text: `Zooming and focusing camera onto feature: ${featureId}`}],
      };
    }
  );

  server.tool(
    'highlight_overlap_conflicts',
    'Turns on or off highlighting of overlapping environmental and mining threat zones (flashing red overlap layers).',
    {
      active: z.boolean()
    },
    async ({active}) => {
      mapQueryHandler({highlightOverlaps: active});
      return {
        content: [{type: 'text', text: `High risk overlap mapping is now ${active ? 'ACTIVE (flashing red outline)' : 'DEACTIVATED'}`}],
      };
    }
  );

  server.tool(
    'filter_geospatial_features',
    'Filter map layers by search term or text query (updates visible properties matching query in real time). For empty filter to show all, pass reset string "".',
    {
      query: z.string()
    },
    async ({query}) => {
      mapQueryHandler({filterQuery: query});
      return {
        content: [{type: 'text', text: `Applied geo-attribute filter: "${query}"`}],
      };
    }
  );

  server.tool(
    'directions_on_google_maps',
    'Search google maps for directions from origin to destination.',
    {origin: z.string(), destination: z.string()},
    async ({origin, destination}) => {
      mapQueryHandler({origin, destination});
      return {
        content: [
          {type: 'text', text: `Navigating from ${origin} to ${destination}`},
        ],
      };
    },
  );

  await server.connect(transport);
  console.log('server running');
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
