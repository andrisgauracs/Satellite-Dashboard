# Space API — Satellite Visualizer

A small, self-contained Node.js project that provides a backend API to fetch satellite positions (powered by the N2YO API) and a frontend that visualizes those satellites on an interactive Three.js globe.

## 🚀 Project overview

- **Backend**: Express server (in `src/server.js`) that exposes endpoints for the satellite list and live positions. Fetches data from the N2YO API and provides a small cache + debug information.
- **Frontend**: Static single-page app served from `public/` (main script: `public/app.js`). Uses Three.js to render a globe, places satellite markers, and polls `/api/positions` for updates.

## 📁 Project structure

- `src/` — server code (Express, API endpoints)
  - `src/server.js` — main server and satellite fetching logic
- `public/` — frontend files served as static assets
  - `index.html` — page shell
  - `app.js` — frontend logic: loads satellites, polls `/api/positions`, renders Three.js globe and markers
  - `style.css`, `three-orbit-controls.js`, etc.
- `world.svg` — bundled globe SVG served at `/map/world.svg`
- `INSTRUCTIONS.md` — satellite selection notes
- `package.json` — scripts and dependencies

## 🔧 Requirements

- Node.js 14+ (see `engines` in `package.json`)
- N2YO API key (for live satellite positions): https://www.n2yo.com/

## Quick start

1. Install dependencies:

   npm install

2. Create a `.env` file in the project root with your N2YO key:

   N2YO_API_KEY=your_api_key_here

3. Start the server (production):

   npm start

   or start in development (auto-reload with nodemon):

   npm run dev

4. Open in the browser:

   http://localhost:3000

## API reference

- `GET /api/satellites` — returns the list of satellites that the app will track (defined in `src/server.js`).
- `GET /api/positions` — fetches current positions for tracked satellites.
  - Optional query param: `debug=true` — server will include raw provider responses for easier debugging.
  - Response shape: `{ cached: boolean, updated: <timestamp>, sats: [ ... ] }`, where each sat may include `latitude`, `longitude`, `altitude_km`, `timestamp`, `error`, and `raw`.
- `GET /map/world.svg` — the globe SVG used by the frontend to build an equirectangular texture.

## Frontend details

- The frontend polls `/api/positions` (every ~2s) and updates both the sidebar list and 3D markers.
- The globe is rendered using Three.js; orbit controls and pointer interactions are provided in `public/`.
- The "Refresh" button and `?debug=true` are useful when diagnosing missing data.

## Development notes

- Modify the satellite list in `src/server.js` (or see `INSTRUCTIONS.md` for guidance).
- The server includes basic rate-limiting via a short cache to avoid hitting the N2YO API too quickly.
- Logs: server logs to console; enable `?debug=true` to see raw provider data returned in responses.

## Troubleshooting

- If no satellite positions appear:
  - Verify `N2YO_API_KEY` in `.env`.
  - Check server console output for N2YO errors or HTTP status failures.
  - Use `GET /api/positions?debug=true` in the browser or curl to see raw provider responses.

## Contributing

- Feel free to open issues or PRs for bug fixes and enhancements.
- For UI tweaks, edit files under `public/`. For backend changes, modify `src/server.js` and add tests if possible.
