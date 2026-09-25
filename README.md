# Real-Time Public Chat Application with 1-to-1 WebRTC Audio & Video Calling

A complete, production-ready, genuinely real-time public chat application with **private 1-to-1 Audio and Video Calling**, built with **Next.js**, **Express**, **Socket.IO**, and **native browser WebRTC**.

Anyone with the public URL can join the shared room immediately by entering a display name. There are no logins, registrations, passwords, databases, or persistent user accounts.

---

## Architecture Overview

```text
Browser Window (User A)                         Browser Window (User B)
        │                                               │
        │ HTTP / Socket.IO Signaling                    │ HTTP / Socket.IO Signaling
        ▼                                               ▼
┌───────────────────────────────────────────────────────────────┐
│                    Unified Node.js Process                    │
│                                                               │
│   Next.js (Pages / SSR / Client Assets)                       │
│   Express HTTP Router (/health, CORS)                         │
│   Socket.IO Server Engine                                     │
│     ├── Global Chat Broadcasts                                │
│     └── Targeted WebRTC Call Signaling (Offers/Answers/ICE)   │
│                                                               │
│   Active In-Memory State:                                     │
│   - Users: Map(socket.id => { id, name, isBusy })             │
│   - Calls: Map(callId => { caller, callee, type, state })     │
│                                                               │
│   * ZERO Message or Call History Stored / Replayed *          │
└───────────────────────────────────────────────────────────────┘
        ▲                                               ▲
        │                                               │
        └─────────────── Direct P2P Media ──────────────┘
                     (Native WebRTC Audio/Video)
```

### Architectural Highlights

1. **One Project → One Deployment → One Public URL**:
   The application runs a unified HTTP server. The Next.js client, persistent Socket.IO server, and WebRTC signaling bind to the **exact same port** (`PORT`, default `3000`). This completely eliminates CORS issues in production and allows deployment as a single service with a single public URL.
2. **True Socket.IO Real-Time Engine & WebRTC Calling**:
   - **Global Chat**: Broadcasts messages immediately over persistent WebSockets. No intervals, no REST polling, no fake demo data.
   - **1-to-1 Audio & Video Calling**: Media is transmitted directly peer-to-peer using native browser WebRTC (`RTCPeerConnection`, `getUserMedia`). Socket.IO is used **only** for signaling (call state, SDP offers/answers, ICE candidates). No media is routed through Node.js.
3. **Strict Ephemeral Lifecycle (Zero Persistent History)**:
   Per strict specifications, **no database or persistent storage** is used. When a user connects and enters their display name, their message window starts completely empty. Sockets never replay past messages. No call logs, audio/video recordings, or media data are ever saved.
4. **Display Name Validation & Identity**:
   Users are identified internally by their unique `socket.id`. Duplicate display names (e.g. multiple "Santhosh" users) are allowed and do not collide.
5. **Real-Time Online Presence & Disconnect Detection**:
   When tabs close, reload, or lose connectivity, the server instantly removes the socket, cleans up any ongoing calls, and broadcasts the updated online count and busy states to all remaining connected participants.
6. **Multiple Independent Simultaneous Calls**:
   Different pairs of users can participate in simultaneous calls (e.g. Santhosh & Rahul on an audio call while Priya & Arun are on a video call) without interference.
7. **One Active Call Per User (Busy State Enforcement)**:
   Users currently in an active or ringing call cannot be called by third parties. The caller receives immediate feedback (e.g. *"User is currently in another call"*).
8. **Uninterrupted Global Chat During Calls**:
   Users can freely view messages, send chat messages, and interact with the room while on active audio or video calls.

---

## Technologies Used

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Lucide Icons
- **Real-Time Layer**: Socket.IO (Server & official `socket.io-client`)
- **Calling / Media**: Native Browser WebRTC (`RTCPeerConnection`, `getUserMedia`, `RTCSessionDescription`, `RTCIceCandidate`)
- **Backend Server**: Node.js, Express, HTTP
- **Cross-Platform Tooling**: cross-env, concurrently

---

## 1-to-1 Calling User Flow

1. User enters their display name and joins the public chat room.
2. Click the **Users** button in the header to open the Online Users drawer.
3. Next to each available user, click **[Audio]** or **[Video]** to initiate a 1-to-1 call.
4. The recipient receives an incoming call notification modal with **[Accept]** and **[Decline]** buttons.
5. Upon acceptance, WebRTC peer connection negotiates directly:
   - **Audio Call**: Displays contact name, live call duration timer, mute/unmute control, and end call button.
   - **Video Call**: Full-screen or responsive PIP layout displaying remote video, local camera preview, mute/unmute, camera on/off, and end call controls.
6. Either party can end the call at any time, returning both participants to the available state.

---

## Local Development Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) v18.0.0 or higher
- `npm`

### 2. Installation

Clone or navigate to the repository directory and install dependencies:

```bash
npm install
```

### 3. Start Development (Single Command)

To run the unified server (Next.js with hot reload + Socket.IO server on port 3000):

```bash
npm run dev
```

Open your browser at:
```text
http://localhost:3000
```

> **Note for Separate Development Servers (`dev:split`)**:
> If you prefer running the frontend and backend on separate ports during development (Frontend on `localhost:3000` and Backend on `localhost:5000`):
> ```bash
> npm run dev:split
> ```
> In this mode, set `NEXT_PUBLIC_SOCKET_URL=http://localhost:5000` in your `.env.local`.

---

## Testing

The project includes unit and end-to-end integration test suites verifying:
- Name and message validation
- Zero message history replay to new users
- Real-time online user count updates and disconnect handling
- 1-to-1 Audio call signaling, acceptance, rejection, and termination
- 1-to-1 Video call signaling
- Multiple simultaneous independent calls between different pairs
- Busy state enforcement and duplicate call prevention
- Uninterrupted global chat messaging during calls
- Automatic call timeout and disconnect cleanup

```bash
# Run unit, chat e2e, and calling e2e tests
npm test

# Run the Section 20 multi-user chat verification flow
npm run test:flow
```

---

## Environment Variables

Copy `.env.example` to `.env.local` for local overrides:

```bash
cp .env.example .env.local
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The HTTP & WebSocket port to listen on. | `3000` |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO server URL for the client. Leave empty in unified mode to automatically use `window.location.origin`. Set to `http://localhost:5000` if running backend on a separate port. | `""` (same-origin) |
| `CLIENT_ORIGIN` | Comma-separated list of allowed origins for CORS if frontend is hosted on a separate domain. | `""` (handled automatically) |
| `NODE_ENV` | Application environment mode (`development` or `production`). | `development` |
| `STUN_SERVERS` | Comma-separated list of STUN servers for WebRTC NAT traversal. | `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302` |
| `TURN_SERVER_URL` | Optional TURN server URL (e.g. `turn:turn.example.com:3478`) for restricted enterprise firewalls. | `""` |
| `TURN_USERNAME` | Username for TURN server authentication. | `""` |
| `TURN_CREDENTIAL` | Password / credential for TURN server authentication. | `""` |

---

## Production Deployment

### Recommended Platforms (Persistent Node.js / WebSockets)

Socket.IO requires a persistent Node.js server to maintain long-lived WebSocket connections.

> [!IMPORTANT]
> **Serverless Warning**: Platforms like standard Vercel or Netlify Serverless Functions terminate execution after each request and **do not support persistent stateful WebSocket servers**.
> To get **one deployment → one public URL**, deploy this application to any platform supporting long-running Node.js processes or Docker containers:
> - **[Render](https://render.com/)** (Web Service)
> - **[Railway](https://railway.app/)**
> - **[Fly.io](https://fly.io/)**
> - **[DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform/)**
> - **Self-hosted VPS / Docker** (Ubuntu, Debian, etc.)

---

### Step-by-Step Deployment Guide: Render.com (Unified Single Deployment)

1. Push this repository to GitHub or GitLab.
2. Sign in to [Render](https://render.com/) and click **New +** → **Web Service**.
3. Connect your repository.
4. Configure service settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free or Starter
5. Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
6. Click **Deploy Web Service**.
7. Once deployed, Render provides your single public URL:
   ```text
   https://realtime-chat-xxxx.onrender.com
   ```
8. Share this URL with any number of users on different devices.

---

### Step-by-Step Deployment Guide: Docker / VPS

A production-optimized multi-stage `Dockerfile` is included in the project.

```bash
# Build the Docker image
docker build -t realtime-chat .

# Run the container
docker run -p 3000:3000 -e NODE_ENV=production realtime-chat
```
