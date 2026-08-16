---
name: LiveKit WebRTC SFU Server Orchestration
description: Deploy, configure, manage, and scale the LiveKit WebRTC SFU media server for real-time video, audio, and AI agent tracks.
---

# LiveKit WebRTC SFU Server Orchestration Skill

This skill empowers AI coding assistants and engineers to deploy, manage, and scale the LiveKit WebRTC SFU—a high-performance, single-binary media server for real-time video, audio, and AI data tracks.

## 🚨 MANDATORY: Pre-Flight Checklist
Before writing deployment scripts or configuration files, you MUST:
1. **Never Hallucinate Configuration Keys:** LiveKit configuration fields change across versions. Always verify syntax against live schema documentation or the LiveKit CLI.
2. **Secure by Default:** Never expose a server to the public internet without configuring token-based JWT authentication and explicit firewall port routing.
3. **Handle Ephemeral Rooms Correctly:** LiveKit rooms are ephemeral by default. They destroy themselves when the last participant leaves.

---

## 🏗️ 1. Core Architecture Primitives
When interacting with the server or writing backend integrations, adhere to the strict LiveKit data model:
* **Room:** The isolated logical session. Participants within the same room share a media graph. Tracks cannot cross room boundaries.
* **Participant:** Can be a human client user or a backend Voice/AI Agent. Every participant carries a set of tracks.
* **Track:** A single media or data stream (audio, video, or raw binary frames). Publishing a track is entirely decoupled from subscribing to it.

---

## 🛠️ 2. Production Server Configuration (`livekit.yaml`)
Always construct the `livekit.yaml` file utilizing these production standard blocks:

```yaml
port: 7880
log_level: info

rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  # Set to true for cloud environments (AWS, GCP, DigitalOcean) behind NAT
  use_external_ip: true

redis:
  address: "localhost:6379"
  # Required for multi-node distributed SFU scaling

keys:
  # api_key: api_secret
  devkey: "secret_key_minimum_32_characters_long_for_production"

turn:
  enabled: true
  domain: "yourdomain.com"
  tls_port: 3478
  udp_port: 3478

prometheus_port: 6789
```

---

## 🔒 3. Token Generation & Access Control
Access to the SFU is governed strictly via JSON Web Tokens (JWT). When writing backend services to mint access tokens, use the official Server SDKs (Go, Node.js, Python, or Rust).

### Token Implementation Protocol:
1. **Initialize RoomServiceClient:** Use your designated `api_key` and `api_secret`.
2. **Set Grants Explicitly:**
   * `roomJoin`: Must be true for a user to connect.
   * `room`: Define the specific target room name.
   * `identity`: A unique string identifier for the participant.

---

## 🌐 4. Infrastructure & Network Topologies
Ensure firewall policies expose the following network channels explicitly:
* **TCP 7880:** Signaling & HTTP Webhooks
* **TCP 7881:** WebRTC over TCP (Fallback)
* **UDP 3478:** TURN server routing
* **UDP 50000-60000:** WebRTC Media tracks (SFU dynamic range)

---

## 🤖 5. Integration with LiveKit AI Agents
When establishing real-time voice or multimodal AI agents:
* **Job Assignments:** Always use the standard LiveKit Worker framework.
* **Worker Types:** Determine if the agent should spin up per `ROOM` (shared session helper) or per `PUBLISHER` (dedicated individual voice assistant stream).
* **VAD & Track Subscriptions:** Ensure the AI worker subscribes explicitly to the user’s audio track and bypasses unnecessary video tracks to optimize downstream server bandwidth.

---

## 🔍 6. Verification and Troubleshooting
* **Configuration Validation:** Use `livekit-cli validate livekit.yaml` before starting the binary.
* **Connectivity Checks:** Use the LiveKit Playground (`https://meet.livekit.io`) to test local signaling connectivity via token verification.
