/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This is the main entry point for the application.
 * It sets up the LitElement-based MapApp component, initializes the Google GenAI
 * client for chat interactions, and establishes communication between the
 * Model Context Protocol (MCP) client and server. The MCP server exposes
 * map-related tools that the AI model can use, and the client relays these
 * tool calls to the server.
 */

import {GoogleGenAI, mcpToTool} from '@google/genai';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {Transport} from '@modelcontextprotocol/sdk/shared/transport.js';
import {ChatState, MapApp, marked} from './map_app'; // Updated import path

import {startMcpGoogleMapServer} from './mcp_maps_server';

/* --------- */

async function startClient(transport: Transport) {
  const client = new Client({name: 'AI Studio', version: '1.0.0'});
  await client.connect(transport);
  return client;
}

/* ------------ */

const SYSTEM_INSTRUCTIONS = `You are a Geospatial Intelligence Assistant integrated into a 3D interactive map system. Your role is to interpret user messages, control map visualization layers, and answer spatial questions using map context.
You do NOT hallucinate data. You only operate on available map layers and spatial context.

GEOSPATIAL DATASET DETAILS (SOUTH GOBI, MONGOLIA):
Focus Area: South Gobi (Omnogovi Province, Lat: 43.450, Lng: 105.450)
Available Layers:
1. 'mining': Mining license polygons (Red).
   - 'mining_oyu_tolgoi': Large-scale Copper/Gold mine owned by Oyu Tolgoi LLC.
   - 'mining_tavan_tolgoi': Mega-scale Metallurgical Coal mine state-owned by Erdenes Tavan Tolgoi JSC.
   - 'mining_bayan_gobi': Coal exploration lease under environmental dispute, owned by SouthGobi Sands LLC.
2. 'protected': National protectorates & preservation corridors (Green).
   - 'protected_gurvansaikhan': Gobi Gurvansaikhan National Park (Strictly Protected IUCN Cat II Reserve).
   - 'protected_gobi_restricted': Border Wildlife Transit Corridor (excluding high-grade human access).
3. 'watershed': Hydrological & aquifer boundaries crucial for water security (Blue).
   - 'watershed_galba_uul': Galba-Uul Underground Fossil Aquifer (primary source of desert spring feeds).
   - 'watershed_gobi_lakes': Gobi Lakes Valley catchments supporting nomadic herds and wetlands.
4. 'company': Key company/asset compound facilities (Yellow/Orange Points).
   - 'asset_oyu_tolgoi_pit': Main concentrator plant and pit area.
   - 'asset_tavan_tolgoi_camp': Command camp and worker compound.
   - 'asset_bayan_gobi_camp': Halted exploration camp.
   - 'asset_tsogt_tsetsii': Substation and wind turbine infrastructure park.
5. 'admin': Eco-monitoring bounding frames (Grey dashed outer line).
   - 'admin_omnogovi': Province bounds for eco-impact reporting.
6. 'overlap': Threat intersections where mining and environmental/public reserves violate each other (Flashing Red).
   - 'overlap_bayan_gobi_vs_gurvansaikhan': High Environmental Risk conflict. Red coal license overlaps 580 sq km into Gurvansaikhan National Park.
   - 'overlap_oyu_tolgoi_vs_galba_uul': Deep aquifer draw conflict. Industrial mining sits fully atop critical groundwater-basin feed.
   - 'overlap_tavan_tolgoi_vs_gobi_lakes': Dust and drainage runoff hazard mapping.

GEOSPATIAL BEHAVIOR RULES:
- Center & Zoom: If user asks about a location (e.g. "Zoom to South Gobi", "Focus Oyu Tolgoi"), call zoom_to_geospatial_feature with the appropriate feature ID (e.g., 'south_gobi', 'mining_oyu_tolgoi'). This automatically performs a flying camera pan.
- Toggle Layers: If user says "Show mining areas" or "Hide protected zones", call toggle_geospatial_layer with the correct layerId ('mining', 'protected', etc.) and a boolean visible flag.
- Overlaps / Conflicts: If user asks about overlap, friction, or environmental conflicts, make sure both overlapping layers are turned ON (e.g., mining and protected) AND call highlight_overlap_conflicts(true) to show flashing indicators. Write a warning that these are HIGH RISK zones.
- Filtering: If user asks to search/filter (e.g., "Show me things related to SouthGobi Sands" or "Filter coal"), call filter_geospatial_features(query: "...") which updates map listings.
- No Invented Features: If a requested feature or region is not mentioned in our datasets, clearly say: "Not available in current map layers." Do not make up coordinates or boundaries.

OUTPUT STYLE REQUIREMENT:
You must ALWAYS respond in short, structured formats using the FOLLOWING EXACT TEMPLATE. Note that there can be multiple ACTION lines depending on the tools used, followed by a separate RESPONSE block explaining your reasoning:

ACTION: zoom_to(<feature_id or south_gobi>)
ACTION: toggle_layer(<layer_id>, <true/false>)
ACTION: highlight_overlaps(<true/false>)
RESPONSE: "<Answering text detailing environmental risks, ownership, locations, or status context directly based on visible spatial data.>"

Example:
ACTION: zoom_to(mining_oyu_tolgoi)
ACTION: toggle_layer(mining, true)
RESPONSE: "Centered view on Oyu Tolgoi. The copper license is fully active and sits inside the Galba-Uul deep fossil groundwater basin."`;

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY,
});

function createAiChat(mcpClient: Client) {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      tools: [mcpToTool(mcpClient)],
    },
  });
}

function camelCaseToDash(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

document.addEventListener('DOMContentLoaded', async (event) => {
  const rootElement = document.querySelector('#root')! as HTMLElement;

  const mapApp = new MapApp();
  rootElement.appendChild(mapApp);

  const [transportA, transportB] = InMemoryTransport.createLinkedPair();

  void startMcpGoogleMapServer(
    transportA,
    (params: {location?: string; origin?: string; destination?: string}) => {
      mapApp.handleMapQuery(params);
    },
  );

  const mcpClient = await startClient(transportB);
  const aiChat = createAiChat(mcpClient);

  mapApp.sendMessageHandler = async (input: string, role: string) => {
    console.log('sendMessageHandler', input, role);

    const {thinkingElement, textElement, thinkingContainer} = mapApp.addMessage(
      'assistant',
      '',
    );

    mapApp.setChatState(ChatState.GENERATING);
    textElement.innerHTML = '...'; // Initial placeholder

    let newCode = '';
    let thoughtAccumulator = '';

    try {
      // Outer try for overall message handling including post-processing
      try {
        // Inner try for AI interaction and message parsing
        const stream = await aiChat.sendMessageStream({message: input});

        for await (const chunk of stream) {
          for (const candidate of chunk.candidates ?? []) {
            for (const part of candidate.content?.parts ?? []) {
              if (part.functionCall) {
                console.log(
                  'FUNCTION CALL:',
                  part.functionCall.name,
                  part.functionCall.args,
                );
                const mcpCall = {
                  name: camelCaseToDash(part.functionCall.name!),
                  arguments: part.functionCall.args,
                };

                const explanation =
                  'Calling function:\n```json\n' +
                  JSON.stringify(mcpCall, null, 2) +
                  '\n```';
                const {textElement: functionCallText} = mapApp.addMessage(
                  'assistant',
                  '',
                );
                functionCallText.innerHTML = await marked.parse(explanation);
              }

              if (part.thought) {
                mapApp.setChatState(ChatState.THINKING);
                thoughtAccumulator += ' ' + part.thought;
                thinkingElement.innerHTML =
                  await marked.parse(thoughtAccumulator);
                if (thinkingContainer) {
                  thinkingContainer.classList.remove('hidden');
                  thinkingContainer.setAttribute('open', 'true');
                }
              } else if (part.text) {
                mapApp.setChatState(ChatState.EXECUTING);
                newCode += part.text;
                textElement.innerHTML = await marked.parse(newCode);
              }
              mapApp.scrollToTheEnd();
            }
          }
        }
      } catch (e: unknown) {
        // Catch for AI interaction errors.
        console.error('GenAI SDK Error:', e);
        let baseErrorText: string;

        if (e instanceof Error) {
          baseErrorText = e.message;
        } else if (typeof e === 'string') {
          baseErrorText = e;
        } else if (
          e &&
          typeof e === 'object' &&
          'message' in e &&
          typeof (e as {message: unknown}).message === 'string'
        ) {
          baseErrorText = (e as {message: string}).message;
        } else {
          try {
            // Attempt to stringify complex objects, otherwise, simple String conversion.
            baseErrorText = `Unexpected error: ${JSON.stringify(e)}`;
          } catch (stringifyError) {
            baseErrorText = `Unexpected error: ${String(e)}`;
          }
        }

        let finalErrorMessage = baseErrorText; // Start with the extracted/formatted base error message.

        // Attempt to parse a JSON object from the baseErrorText, as some SDK errors embed details this way.
        // This is useful if baseErrorText itself is a string containing JSON.
        const jsonStartIndex = baseErrorText.indexOf('{');
        const jsonEndIndex = baseErrorText.lastIndexOf('}');

        if (jsonStartIndex > -1 && jsonEndIndex > jsonStartIndex) {
          const potentialJson = baseErrorText.substring(
            jsonStartIndex,
            jsonEndIndex + 1,
          );
          try {
            const sdkError = JSON.parse(potentialJson);
            let refinedMessageFromSdkJson: string | undefined;

            // Check for common nested error structures (e.g., sdkError.error.message)
            // or a direct message (sdkError.message) in the parsed JSON.
            if (
              sdkError &&
              typeof sdkError === 'object' &&
              sdkError.error && // Check if 'error' property exists and is truthy
              typeof sdkError.error === 'object' && // Check if 'error' property is an object
              typeof sdkError.error.message === 'string' // Check for 'message' string within 'error' object
            ) {
              refinedMessageFromSdkJson = sdkError.error.message;
            } else if (
              sdkError &&
              typeof sdkError === 'object' && // Check if sdkError itself is an object
              typeof sdkError.message === 'string' // Check for a direct 'message' string on sdkError
            ) {
              refinedMessageFromSdkJson = sdkError.message;
            }

            if (refinedMessageFromSdkJson) {
              finalErrorMessage = refinedMessageFromSdkJson; // Update if JSON parsing yielded a more specific message
            }
          } catch (parseError) {
            // If parsing fails, finalErrorMessage remains baseErrorText.
            console.warn(
              'Could not parse potential JSON from error message; using base error text.',
              parseError,
            );
          }
        }

        const {textElement: errorTextElement} = mapApp.addMessage('error', '');
        errorTextElement.innerHTML = await marked.parse(
          `Error: ${finalErrorMessage}`,
        );
      }

      // Post-processing logic (now inside the outer try)
      if (thinkingContainer && thinkingContainer.hasAttribute('open')) {
        if (!thoughtAccumulator) {
          thinkingContainer.classList.add('hidden');
        }
        thinkingContainer.removeAttribute('open');
      }

      if (
        textElement.innerHTML.trim() === '...' ||
        textElement.innerHTML.trim().length === 0
      ) {
        const hasFunctionCallMessage = mapApp.messages.some((el) =>
          el.innerHTML.includes('Calling function:'),
        );
        if (!hasFunctionCallMessage) {
          textElement.innerHTML = await marked.parse('Done.');
        } else if (textElement.innerHTML.trim() === '...') {
          textElement.innerHTML = '';
        }
      }
    } finally {
      // Finally for the outer try, ensures chat state is reset
      mapApp.setChatState(ChatState.IDLE);
    }
  };
});
