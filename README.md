# Real-Time Public Chat Application

A complete, production-ready, genuinely real-time public chat room built with **Next.js**, **Express**, and **Socket.IO**.

Anyone with the public URL can join the shared room immediately by entering a display name. There are no logins, registrations, passwords, or persistent user accounts.

---

## Architecture Overview

```text
Browser Window (User A)         Browser Window (User B)
        │                               │
        │ HTTP / WebSockets             │ HTTP / WebSockets
        ▼                               ▼
┌───────────────────────────────────────────────────────┐
│               Unified Node.js Process                 │
│                                                       │
│   Next.js (Pages / SSR / Client Assets)               │
│   Express HTTP Router (/health, CORS)                 │
│   Socket.IO Server Engine                             │
│                                                       │
│   Active In-Memory Users:                             │
│   Map(socket.id => { id, name, joinedAt })            │
│                                                       │
│   * ZERO Message History Stored / Replayed *          │
└───────────────────────────────────────────────────────┘
```

### Architectural Highlights

1. **One Project → One Deployment → One Public URL**:
   The application runs a unified HTTP server. The Next.js client and the persistent Socket.IO server bind to the **exact same port** (`PORT`, default `3000`). This completely eliminates CORS issues in production and allows deployment as a single service with a single public URL.
2. **True Socket.IO Real-Time Engine**:
   Messages and user presence are broadcast immediately over persistent WebSockets with automatic fallback to long-polling when needed. No intervals, no REST polling, no fake demo timeouts.
3. **Strict Ephemeral Message Lifecycle (Zero History)**:
   Per strict specifications, **no database or persistent storage** is used. When a user connects and enters their display name, their message window starts completely empty. Sockets never replay past messages. Messages exist only in the active memory of currently connected browser tabs at the instant they are broadcast.
4. **Display Name Validation & Identity**:
   Users are identified internally by their unique `socket.id`. Duplicate display names (e.g. multiple "Santhosh" users) are allowed and do not collide. Names are sanitized and validated both client-side and server-side (1–30 characters, whitespace-trimmed, non-empty).
5. **Real-Time Online Presence & Disconnect Detection**:
   When tabs close, reload, or lose connectivity, the server instantly removes the socket from active memory and broadcasts the updated online count to all remaining connected participants.

---

## Technologies Used

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Lucide Icons
- **Real-Time Layer**: Socket.IO (Server & official `socket.io-client`)
- **Backend Server**: Node.js, Express, HTTP
- **Cross-Platform Tooling**: cross-env, concurrently

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

The project includes an end-to-end integration test suite verifying the socket lifecycle, duplicate names, absence of past history replay, disconnect user counting, and input validation:

```bash
# Run unit and end-to-end socket tests
npm test

# Run the strict multi-user flow scenario (Santhosh, Rahul, Priya)
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

### Step-by-Step Deployment Guide: Railway (Unified Single Deployment)

1. Sign in to [Railway.app](https://railway.app/).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select this repository.
4. Railway will automatically detect Node.js and run `npm run build` followed by `npm start`.
5. Under project settings, generate a domain.
6. The public URL will be live with full WebSocket support on port 3000.

---

### Step-by-Step Deployment Guide: Docker / VPS

A production-optimized multi-stage `Dockerfile` is included in the project.

```bash
# Build the Docker image
docker build -t realtime-chat .

# Run the container
docker run -p 3000:3000 -e NODE_ENV=production realtime-chat
```

---

## Verification & Acceptance Checklist

To test across multiple browser windows or devices:

1. **Browser 1 (Santhosh)**:
   - Open the application.
   - Enter display name `Santhosh` and click **Join Chat**.
   - Send: `Hello`.
   - UI renders: `Santhosh : Hello`.
2. **Browser 2 (Rahul)**:
   - Open the application in an incognito window or separate browser.
   - Enter display name `Rahul` and click **Join Chat**.
   - Verify Rahul's chat is **completely empty** (no previous messages replayed).
   - Verify online user count indicates `2 users online`.
   - Send: `Hi Santhosh`.
   - Both Santhosh and Rahul immediately see: `Rahul : Hi Santhosh`.
3. **Browser 1 (Santhosh)**:
   - Send: `How are you?`.
   - Both browsers immediately display: `Santhosh : How are you?`.
4. **Close Browser 2**:
   - Close Rahul's tab.
   - Verify Santhosh's screen immediately updates to `1 user online`.
5. **Browser 3 (Priya)**:
   - Open a new window and join as `Priya`.
   - Priya sees zero previous messages.
   - Priya sends `Hello!`.
   - All currently active users see `Priya : Hello!`.
