# N2YO.com REST API v1 (Unofficial Markdown Export)

Source docs: N2YO API page :contentReference[oaicite:0]{index=0}

## Overview

N2YO REST API v1 provides satellite tracking and prediction data for developers building satellite tracking or pass prediction applications. :contentReference[oaicite:1]{index=1}

- Method: **GET** for all requests :contentReference[oaicite:2]{index=2}
- Base URL: `https://api.n2yo.com/rest/v1/satellite/` :contentReference[oaicite:3]{index=3}
- Satellite identifier: **NORAD catalog number** (integer), for example ISS is `25544` :contentReference[oaicite:4]{index=4}

## Authentication (API Key)

Each request must include your API key appended as:

`&apiKey={your API key}` :contentReference[oaicite:5]{index=5}

You can generate an API key by registering and then using the profile page on n2yo.com. Keys are shown in your profile and cannot be changed. REST API keys are different from older SOAP keys. :contentReference[oaicite:6]{index=6}

## Rate limits (per API verb)

The API is free but transaction limited by endpoint type: :contentReference[oaicite:7]{index=7}

| Verb           | Limit |
| -------------- | ----: |
| `tle`          |  1000 |
| `positions`    |  1000 |
| `visualpasses` |   100 |
| `radiopasses`  |   100 |
| `above`        |   100 |

N2YO asks users not to abuse the system and notes traffic is monitored. :contentReference[oaicite:8]{index=8}

---

# Endpoints

## 1) Get TLE

Retrieve Two Line Elements (TLE) for a satellite by NORAD id. :contentReference[oaicite:9]{index=9}

**Request**

- Path: `/tle/{id}` :contentReference[oaicite:10]{index=10}

**Parameters**
| Name | Type | Required | Notes |
|---|---|---:|---|
| `id` | integer | Yes | NORAD id :contentReference[oaicite:11]{index=11} |

**Response fields**

- `info.satid` (integer): NORAD id used in input :contentReference[oaicite:12]{index=12}
- `info.satname` (string): satellite name :contentReference[oaicite:13]{index=13}
- `info.transactionscount` (integer): transactions in last 60 minutes for this API key :contentReference[oaicite:14]{index=14}
- `tle` (string): TLE as a single string; split into two lines using `\r\n` :contentReference[oaicite:15]{index=15}

**Example**

- Request: `https://api.n2yo.com/rest/v1/satellite/tle/25544&apiKey=YOUR_KEY` :contentReference[oaicite:16]{index=16}

---

## 2) Get satellite positions

Retrieve future satellite positions (ground track) and viewing angles from an observer location. Each element in the positions array represents **one second** of calculation. First element is for current UTC time. :contentReference[oaicite:17]{index=17}

**Request**

- Path: `/positions/{id}/{observer_lat}/{observer_lng}/{observer_alt}/{seconds}` :contentReference[oaicite:18]{index=18}

**Parameters**
| Name | Type | Required | Notes |
|---|---|---:|---|
| `id` | integer | Yes | NORAD id :contentReference[oaicite:19]{index=19} |
| `observer_lat` | float | Yes | decimal degrees :contentReference[oaicite:20]{index=20} |
| `observer_lng` | float | Yes | decimal degrees :contentReference[oaicite:21]{index=21} |
| `observer_alt` | float | Yes | meters above sea level :contentReference[oaicite:22]{index=22} |
| `seconds` | integer | Yes | number of future positions; limit **300** :contentReference[oaicite:23]{index=23} |

**Response fields**

- `info.satid` (integer) :contentReference[oaicite:24]{index=24}
- `info.satname` (string) :contentReference[oaicite:25]{index=25}
- `info.transactionscount` (integer) :contentReference[oaicite:26]{index=26}
- `positions[].satlatitude` (float): footprint latitude :contentReference[oaicite:27]{index=27}
- `positions[].satlongitude` (float): footprint longitude :contentReference[oaicite:28]{index=28}
- `positions[].azimuth` (float): degrees relative to observer :contentReference[oaicite:29]{index=29}
- `positions[].elevation` (float): degrees relative to observer :contentReference[oaicite:30]{index=30}
- `positions[].ra` (float): right ascension (degrees) :contentReference[oaicite:31]{index=31}
- `positions[].dec` (float): declination (degrees) :contentReference[oaicite:32]{index=32}
- `positions[].timestamp` (integer): Unix time (UTC) :contentReference[oaicite:33]{index=33}

**Example**

- Request: `https://api.n2yo.com/rest/v1/satellite/positions/25544/41.702/-76.014/0/2/&apiKey=YOUR_KEY` :contentReference[oaicite:34]{index=34}

---

## 3) Get visual passes

Predict visible (optical) passes relative to a location. A visual pass requires the satellite to be above the horizon, sunlit (not in Earth shadow), and the sky dark enough for visibility. :contentReference[oaicite:35]{index=35}

**Request**

- Path: `/visualpasses/{id}/{observer_lat}/{observer_lng}/{observer_alt}/{days}/{min_visibility}` :contentReference[oaicite:36]{index=36}

**Parameters**
| Name | Type | Required | Notes |
|---|---|---:|---|
| `id` | integer | Yes | NORAD id :contentReference[oaicite:37]{index=37} |
| `observer_lat` | float | Yes | decimal degrees :contentReference[oaicite:38]{index=38} |
| `observer_lng` | float | Yes | decimal degrees :contentReference[oaicite:39]{index=39} |
| `observer_alt` | float | Yes | meters above sea level :contentReference[oaicite:40]{index=40} |
| `days` | integer | Yes | max **10** :contentReference[oaicite:41]{index=41} |
| `min_visibility` | integer | Yes | minimum visible seconds during pass :contentReference[oaicite:42]{index=42} |

**Response fields**

- `info.satid`, `info.satname`, `info.transactionscount` :contentReference[oaicite:43]{index=43}
- `info.passescount` (integer): number of passes returned :contentReference[oaicite:44]{index=44}
- `passes[].startAz`, `passes[].startAzCompass`, `passes[].startEl`, `passes[].startUTC` :contentReference[oaicite:45]{index=45}
- `passes[].maxAz`, `passes[].maxAzCompass`, `passes[].maxEl`, `passes[].maxUTC` :contentReference[oaicite:46]{index=46}
- `passes[].endAz`, `passes[].endAzCompass`, `passes[].endEl`, `passes[].endUTC` :contentReference[oaicite:47]{index=47}
- `passes[].mag` (float): max visual magnitude; `100000` if unknown :contentReference[oaicite:48]{index=48}
- `passes[].duration` (integer): visible duration in seconds :contentReference[oaicite:49]{index=49}

Compass values include: `N, NE, E, SE, S, SW, W, NW` :contentReference[oaicite:50]{index=50}

**Example**

- Request: `https://api.n2yo.com/rest/v1/satellite/visualpasses/25544/41.702/-76.014/0/2/300/&apiKey=YOUR_KEY` :contentReference[oaicite:51]{index=51}

---

## 4) Get radio passes

Similar to visual passes, but without the requirement for optical visibility. Useful for predicting passes for radio communications. Pass quality depends largely on the maximum elevation during the pass, which you constrain via `min_elevation`. :contentReference[oaicite:52]{index=52}

**Request**

- Path: `/radiopasses/{id}/{observer_lat}/{observer_lng}/{observer_alt}/{days}/{min_elevation}` :contentReference[oaicite:53]{index=53}

**Parameters**
| Name | Type | Required | Notes |
|---|---|---:|---|
| `id` | integer | Yes | NORAD id :contentReference[oaicite:54]{index=54} |
| `observer_lat` | float | Yes | decimal degrees :contentReference[oaicite:55]{index=55} |
| `observer_lng` | float | Yes | decimal degrees :contentReference[oaicite:56]{index=56} |
| `observer_alt` | float | Yes | meters above sea level :contentReference[oaicite:57]{index=57} |
| `days` | integer | Yes | max **10** :contentReference[oaicite:58]{index=58} |
| `min_elevation` | integer | Yes | minimum acceptable peak elevation (degrees) :contentReference[oaicite:59]{index=59} |

**Response fields**

- `info.satid`, `info.satname`, `info.transactionscount`, `info.passescount` :contentReference[oaicite:60]{index=60}
- `passes[].startAz`, `passes[].startAzCompass`, `passes[].startUTC` :contentReference[oaicite:61]{index=61}
- `passes[].maxAz`, `passes[].maxAzCompass`, `passes[].maxEl`, `passes[].maxUTC` :contentReference[oaicite:62]{index=62}
- `passes[].endAz`, `passes[].endAzCompass`, `passes[].endUTC` :contentReference[oaicite:63]{index=63}

**Example**

- Request: `https://api.n2yo.com/rest/v1/satellite/radiopasses/25544/41.702/-76.014/0/2/40/&apiKey=YOUR_KEY` :contentReference[oaicite:64]{index=64}

---

## 5) Above (aka "What's up?")

Returns all objects within a given search radius above the observer location. Radius is measured in degrees relative to the point directly overhead. Range is `0` to `90` degrees:

- near `0`: only satellites passing almost exactly overhead
- `90`: all satellites above the horizon :contentReference[oaicite:65]{index=65}

This endpoint can be CPU intensive because it computes exact positions for many objects. :contentReference[oaicite:66]{index=66}

**Request**

- Path: `/above/{observer_lat}/{observer_lng}/{observer_alt}/{search_radius}/{category_id}` :contentReference[oaicite:67]{index=67}

**Parameters**
| Name | Type | Required | Notes |
|---|---|---:|---|
| `observer_lat` | float | Yes | decimal degrees :contentReference[oaicite:68]{index=68} |
| `observer_lng` | float | Yes | decimal degrees :contentReference[oaicite:69]{index=69} |
| `observer_alt` | float | Yes | meters above sea level :contentReference[oaicite:70]{index=70} |
| `search_radius` | integer | Yes | `0-90` :contentReference[oaicite:71]{index=71} |
| `category_id` | integer | Yes | use `0` for all categories :contentReference[oaicite:72]{index=72} |

**Response fields**

- `info.category` (string): category name, or `ANY` when `category_id=0` :contentReference[oaicite:73]{index=73}
- `info.transactionscount` (integer) :contentReference[oaicite:74]{index=74}
- `info.satcount` (integer): number of satellites returned :contentReference[oaicite:75]{index=75}
- `above[].satid` (integer): NORAD id :contentReference[oaicite:76]{index=76}
- `above[].intDesignator` (string): international designator :contentReference[oaicite:77]{index=77}
- `above[].satname` (string) :contentReference[oaicite:78]{index=78}
- `above[].launchDate` (string): `YYYY-MM-DD` :contentReference[oaicite:79]{index=79}
- `above[].satlat` (float), `above[].satlng` (float): footprint lat/lng :contentReference[oaicite:80]{index=80}
- `above[].satalt` (float): altitude (km) :contentReference[oaicite:81]{index=81}

**Example**

- Request: `https://api.n2yo.com/rest/v1/satellite/above/41.702/-76.014/0/70/18/&apiKey=YOUR_KEY` :contentReference[oaicite:82]{index=82}

---

# Satellite Categories (for `above`)

Use these integer category IDs with the `above` endpoint. :contentReference[oaicite:83]{index=83}

| Category                                      |  ID |
| --------------------------------------------- | --: |
| Brightest                                     |   1 |
| ISS                                           |   2 |
| Weather                                       |   3 |
| NOAA                                          |   4 |
| GOES                                          |   5 |
| Earth resources                               |   6 |
| Search & rescue                               |   7 |
| Disaster monitoring                           |   8 |
| Tracking and Data Relay Satellite System      |   9 |
| Geostationary                                 |  10 |
| Intelsat                                      |  11 |
| Gorizont                                      |  12 |
| Raduga                                        |  13 |
| Molniya                                       |  14 |
| Iridium                                       |  15 |
| Orbcomm                                       |  16 |
| Globalstar                                    |  17 |
| Amateur radio                                 |  18 |
| Experimental                                  |  19 |
| Global Positioning System (GPS) Operational   |  20 |
| Glonass Operational                           |  21 |
| Galileo                                       |  22 |
| Satellite-Based Augmentation System           |  23 |
| Navy Navigation Satellite System              |  24 |
| Russian LEO Navigation                        |  25 |
| Space & Earth Science                         |  26 |
| Geodetic                                      |  27 |
| Engineering                                   |  28 |
| Education                                     |  29 |
| Military                                      |  30 |
| Radar Calibration                             |  31 |
| CubeSats                                      |  32 |
| XM and Sirius                                 |  33 |
| TV                                            |  34 |
| Beidou Navigation System                      |  35 |
| Yaogan                                        |  36 |
| Westford Needles                              |  37 |
| Parus                                         |  38 |
| Strela                                        |  39 |
| Gonets                                        |  40 |
| Tsiklon                                       |  41 |
| Tsikada                                       |  42 |
| O3B Networks                                  |  43 |
| Tselina                                       |  44 |
| Celestis                                      |  45 |
| IRNSS                                         |  46 |
| QZSS                                          |  47 |
| Flock                                         |  48 |
| Lemur                                         |  49 |
| Global Positioning System (GPS) Constellation |  50 |
| Glonass Constellation                         |  51 |
| Starlink                                      |  52 |
| OneWeb                                        |  53 |
| Chinese Space Station                         |  54 |
| Qianfan                                       |  55 |
| Kuiper                                        |  56 |
| GeeSAT                                        |  57 |
