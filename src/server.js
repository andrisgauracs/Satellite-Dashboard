const express = require("express");
const fetch = require("node-fetch");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const N2YO_API_KEY = process.env.N2YO_API_KEY || "";

if (!N2YO_API_KEY) {
  console.warn("Warning: N2YO_API_KEY not set. Put key into .env file.");
}

// Satellite list per INSTRUCTIONS.md
const SATELLITES = [
  { satid: 25544, name: "ISS (25544)" },
  { satid: 45074, name: "Starlink 45074" },
  { satid: 45048, name: "Starlink 45048" },
  { satid: 45044, name: "Starlink 45044" },
  { satid: 44961, name: "Starlink 44961" },
  { satid: 44933, name: "Starlink 44933" },
  { satid: 44768, name: "Starlink 44768" },
  { satid: 44748, name: "Starlink 44748" },
  { satid: 44744, name: "Starlink 44744" },
  { satid: 44736, name: "Starlink 44736" },
  { satid: 44723, name: "Starlink 44723" },
];

// Simple static server
app.use("/", express.static(path.join(__dirname, "..", "public")));

// Return list of sats
app.get("/api/satellites", (req, res) => {
  res.json(SATELLITES);
});

// add to file-level cache variables
let lastFetch = 0;
let lastData = { updated: 0, sats: [] };
let lastRawResponses = null; // <-- store raw N2YO response(s) for debugging
const MIN_INTERVAL = 2000; // 4 seconds

// Helper: normalize a satellite response and include error info if available
function parsePositionResponse(satid, json) {
  // if N2YO returned an error shape, surface it
  const errMsg =
    json?.error ||
    json?.message ||
    (Array.isArray(json.positions) && json.positions.length === 0
      ? "no positions returned"
      : null);
  if (errMsg) {
    return {
      satid,
      name: SATELLITES.find((s) => s.satid === satid)?.name || `${satid}`,
      latitude: null,
      longitude: null,
      altitude_km: null,
      timestamp: json?.info?.timestamp ?? Date.now() / 1000,
      azimuth: null,
      elevation: null,
      error: String(errMsg),
      raw: json,
    };
  }

  // try to find the first position object (some responses may include .positions array)
  const pos =
    Array.isArray(json.positions) && json.positions[0]
      ? json.positions[0]
      : json.positions
      ? json.positions
      : json;
  return {
    satid,
    name: SATELLITES.find((s) => s.satid === satid)?.name || `${satid}`,
    latitude: pos?.satlatitude ?? pos?.satlat ?? null,
    longitude: pos?.satlongitude ?? pos?.satlng ?? null,
    altitude_km: pos?.sataltitude ?? pos?.alt ?? null,
    timestamp: pos?.timestamp ?? json?.info?.timestamp ?? Date.now() / 1000,
    azimuth: pos?.azimuth ?? null,
    elevation: pos?.elevation ?? null,
    raw: json,
  };
}

// Fetch positions from N2YO. Try group call first, fallback to per-sat calls.
async function fetchPositionsGrouped(obslat = 0, obslng = 0, obsalt = 0) {
  const ids = SATELLITES.map((s) => s.satid);
  const idStr = ids.join(",");
  const seconds = 1;
  const base = `https://api.n2yo.com/rest/v1/satellite/positions/${encodeURIComponent(
    idStr
  )}/${obslat}/${obslng}/${obsalt}/${seconds}?apiKey=${N2YO_API_KEY}`;

  try {
    console.log("Attempt grouped positions request for ids:", idStr);
    const resp = await fetch(base, { method: "GET" });
    const json = await resp.json().catch(() => null);
    lastRawResponses = json;
    // If the grouped call returned an array of satellites (unlikely for this endpoint), handle it
    if (Array.isArray(json) && json.length > 0) {
      console.log("Grouped positions returned array, mapping to sats.");
      return json.map((j) =>
        parsePositionResponse(j.info?.satid || j.satid, j)
      );
    }
    // Some grouped attempts return an object or an error; log and fallback
    console.warn(
      "Grouped positions returned unexpected shape, falling back to per-sat. sample:",
      (json && (json.info || json)) || json
    );
  } catch (err) {
    console.error("Grouped positions request failed:", err);
    lastRawResponses = { error: String(err) };
  }

  // Fallback: sequentially request each satellite's position (capture raw responses & errors)
  const results = [];
  const rawArray = [];
  for (const s of SATELLITES) {
    try {
      const url = `https://api.n2yo.com/rest/v1/satellite/positions/${s.satid}/${obslat}/${obslng}/${obsalt}/${seconds}?apiKey=${N2YO_API_KEY}`;
      console.log("Fetching per-sat position for", s.satid);
      const r = await fetch(url);
      let j = null;
      try {
        j = await r.json();
      } catch (e) {
        j = await r.text();
      }
      // If response status not OK, store textual error
      if (!r.ok) {
        const errText =
          typeof j === "string" && j
            ? j
            : j?.error || r.statusText || `HTTP ${r.status}`;
        rawArray.push({ satid: s.satid, error: String(errText), raw: j });
        results.push({
          satid: s.satid,
          name: s.name,
          error: String(errText),
          raw: j,
        });
        console.warn("Per-sat request non-OK for", s.satid, errText);
        continue;
      }
      rawArray.push({ satid: s.satid, raw: j });
      const parsed = parsePositionResponse(s.satid, j);
      results.push(parsed);
      if (!parsed.latitude || !parsed.longitude) {
        console.warn(`No position for sat ${s.satid}`, parsed.raw ?? j);
      }
    } catch (err) {
      console.error("Per-sat positions request failed for", s.satid, err);
      results.push({
        satid: s.satid,
        name: s.name,
        error: String(err),
        raw: null,
      });
      rawArray.push({ satid: s.satid, error: String(err) });
    }
  }
  lastRawResponses = rawArray;
  return results;
}

app.get("/api/positions", async (req, res) => {
  // optional observer query params
  const obslat = Number(req.query.obslat || 0);
  const obslng = Number(req.query.obslng || 0);
  const obsalt = Number(req.query.obsalt || 0);
  const debug = req.query.debug === "true";

  console.log(
    `/api/positions requested (debug=${debug}) obslat=${obslat} obslng=${obslng} obsalt=${obsalt}`
  );

  const now = Date.now();
  // cache check
  if (now - lastFetch < MIN_INTERVAL && lastData && lastData.updated) {
    const payload = { cached: true, ...lastData };
    if (debug) payload.raw = lastRawResponses;
    return res.json(payload);
  }

  try {
    const sats = await fetchPositionsGrouped(obslat, obslng, obsalt);
    lastFetch = Date.now();
    lastData = { updated: lastFetch, sats };
    const payload = { cached: false, ...lastData };
    if (debug) payload.raw = lastRawResponses;
    console.log(
      `/api/positions returning ${sats.length} satellites (cached=false)`
    );
    res.json(payload);
  } catch (err) {
    console.error("Fetching positions failed", err);
    // include lastRawResponses if available for diagnosis
    res.status(500).json({
      error: "Fetching positions failed",
      details: String(err),
      raw: lastRawResponses,
    });
  }
});

// Serve the bundled world.svg so frontend can fetch and inline it
app.get("/map/world.svg", (req, res) => {
  const svgPath = path.join(__dirname, "..", "world.svg");
  res.sendFile(svgPath, (err) => {
    if (err) {
      console.error("Failed to send world.svg", err);
      res.status(500).end();
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
