# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the project

```bash
# Install server dependencies (only needed once)
cd server && npm install

# Start server (production mode)
cd server && npm start

# Start server with auto-reload (development)
cd server && npm run dev
```

The server starts on `http://localhost:3000` and serves the client files statically. Open that URL to play.

There is no build step, no bundler, and no test suite.

## Architecture

**Neon Kart** is a 2.5D top-down multiplayer kart racing game. The client is plain HTML/CSS/JS (no ES modules, no bundler); the server is Node.js + Express + Socket.IO.

### Client (`client/`)

No module system is used — every file exposes a global on `window` (e.g. `window.NK_Config`, `window.NK_Net`, `window.NK_UI`, `window.NK_Audio`, `window.RaceScene`). This is intentional so the client can be hosted as static files on GitHub Pages.

Load order matters: `config.js` → `utils/audio.js` → `utils/network.js` → `ui.js` → `scenes/TrackScene.js` → `scenes/RaceScene.js` → `main.js`.

Key globals and their roles:
- `NK_CONFIG` (`config.js`) — single source of truth for all tunable values: `SERVER_URL`, world dimensions, car physics, colors. Auto-detects `localhost` vs production.
- `NK_Net` (`utils/network.js`) — thin wrapper around Socket.IO. Exposes `connect()`, `on(event, cb)`, and emit helpers (`sendUpdate`, `sendCheckpoint`, `sendBoostPickup`). Everything else subscribes to it via `on()`.
- `NK_UI` (`ui.js`) — controls screen visibility (login → lobby → game → victory) and renders the player list, HUD, and ranking.
- `NK_Audio` (`utils/audio.js`) — all audio generated procedurally via Web Audio API; no audio files.
- `RaceScene` (`scenes/RaceScene.js`) — the Phaser 3 scene that runs during a race: car physics, input, checkpoint detection, boost zones, interpolation of remote players.
- `TrackScene` (`scenes/TrackScene.js`) — draws the track with Phaser Graphics (no textures) and defines the `waypoints` array used for checkpoint ordering.

Phaser is initialized lazily in `main.js` on the first `raceStart` event, then reused for subsequent races.

### Server (`server/server.js`)

Single-file Express + Socket.IO server. Manages an in-memory `rooms` object; no database.

Room lifecycle: `lobby` → `racing` → `finished` → (8s) → `lobby`.

Key socket events:
- Client → Server: `joinRoom`, `startRace`, `playerUpdate` (50 ms), `checkpoint`, `boostPickup`
- Server → Client: `joinedRoom`, `lobbyUpdate`, `raceStart`, `playersState`, `rankingUpdate`, `playerFinished`, `raceFinished`, `backToLobby`, `boostTaken`

Lap/checkpoint validation is done entirely on the client (trust-based). Position sync is broadcast-only: the server relays each player's state to everyone else without authoritative simulation.

Health check endpoint: `GET /health`.

### Deployment split

- **Server**: deploy to Render/Railway/Glitch (any Node host). Uses `process.env.PORT`.
- **Client**: can be hosted on GitHub Pages (static). Set `SERVER_URL` in `config.js` to the server's public URL — or leave the auto-detect logic (`window.location.hostname === "localhost"`) in place.

## Customization entry points

- `client/src/config.js` — change physics, laps, world size, colors, network timing.
- `client/src/scenes/TrackScene.js` — edit the `waypoints` array to reshape the track.
