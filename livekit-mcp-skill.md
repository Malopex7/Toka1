# LiveKit Model Context Protocol (MCP) Server Skill File

This skill file configures AI coding assistants (e.g., Claude Code, Cursor, Windsurf) to safely develop, extend, and orchestrate Model Context Protocol (MCP) servers tailored for the LiveKit WebRTC ecosystem. Use this to bridge LLM reasoning with live WebRTC rooms, participants, and media operations.

## 🚨 MANDATORY: Pre-Flight Checklist
1. **Enforce Stateless Execution:** MCP tools must remain stateless. Track and session state must reside inside the LiveKit SFU, not within the local memory of the MCP process.
2. **Sanitise Multi-Tenant Arguments:** Never allow raw LLM inputs to directly interpolate into LiveKit room names or participant identities without strict regex sanitisation.
3. **Handle Async Lifecycles:** All WebRTC mutations (e.g., room creation, muting, track eviction) must use structured async-await workflows with explicit timeout guards.

---

## 🏗️ 1. Core Architecture Primitives
When exposing LiveKit capabilities as an MCP Server, implement this precise standard lifecycle model:
* **Resources (Read-Only):** Expose point-in-time system state (e.g., live logs, room metrics, or static JSON schemas of current configurations).
* **Prompts (Templates):** Provide predefined prompts for operators (e.g., "Troubleshoot connection quality for room X").
* **Tools (Executable Actions):** Expose explicit mutations via the LiveKit Server SDK (e.g., creating tokens, muting users, or triggering recording engines).

---

## 🛠️ 2. Core Server Setup (Node.js SDK Standard)
Always bootstrap your LiveKit MCP server using the `@modelcontextprotocol/sdk` and `livekit-server-sdk` schemas:

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { RoomServiceClient } from "livekit-server-sdk";

const livekitClient = new RoomServiceClient(
  process.env.LIVEKIT_API_URL!,
  process.env.LIVEKIT_API_KEY!,
  process.env.LIVEKIT_API_SECRET!
);

const server = new Server(
  { name: "livekit-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);
```

---

## 🔧 3. Standardised Tool Definitions
When instructing the LLM on available operations, strictly register the following structural formats to prevent schema drift:

### A. Room Creation & Provisioning
* **Tool Name:** `livekit_create_room`
* **Input Schema:** 
  * `roomName` (string, required, regex: `^[a-zA-Z0-9-_]+$`)
  * `emptyTimeout` (number, optional, default: `300`)
  * `maxParticipants` (number, optional)

### B. Dynamic Access Token Minting
* **Tool Name:** `livekit_generate_token`
* **Input Schema:**
  * `roomName` (string, required)
  * `identity` (string, required, unique participant ID)
  * `canPublish` (boolean, optional, default: `true`)
  * `canSubscribe` (boolean, optional, default: `true`)

### C. Live Participant Management
* **Tool Name:** `livekit_mute_participant` / `livekit_remove_participant`
* **Input Schema:**
  * `roomName` (string, required)
  * `identity` (string, required)
  * `trackSid` (string, required for selective muting)

---

## 🔒 4. Transport & Security Protocols
* **Local Operations:** Default strictly to standard input/output (`StdioServerTransport`) for local IDE agent integration.
* **Remote Orchestration:** Use authenticated Server-Sent Events (`SSE`) transports behind an API gateway.
* **Secret Injection:** Never write credentials or tokens into the codebase. Always consume variables exclusively through `process.env.LIVEKIT_API_KEY` and `process.env.LIVEKIT_API_SECRET`.

---

## 🔍 5. Verification and Troubleshooting
* **Transport Test:** Confirm the server responds to JSON-RPC initialization requests without throwing unhandled promise rejections.
* **SDK Handshake:** Implement a startup check using `livekitClient.listRooms()` to verify connectivity and API keys prior to binding to the MCP transport.
