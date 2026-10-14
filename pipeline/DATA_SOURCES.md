# Pedestrian activity index — data inventory (Stage 1)

Study area: USC / Exposition Park core box `33.995–34.045 N, 118.315–118.255 W` (~5.5 × 5.5 km).
Downloads use a wider box `33.98–34.06 N, 118.33–118.24 W` so edge cells see their surroundings.
Raw files live in `pipeline/raw/` (git-ignored). Inspection scripts are in `pipeline/scripts/`.
Downloaded and inspected 2026-10-12.

| # | Dataset | Status | What we got | License / attribution |
|---|---------|--------|-------------|-----------------------|
| 1 | OpenStreetMap via Overpass API | ✅ Downloaded | 36,048 ways, 121,190 nodes; 735 food places, 552 shops, 1,731 transit platforms. OSM snapshot 2026-10-12T22:49Z | **ODbL 1.0.** Attribution "© OpenStreetMap contributors". A published grid derived from OSM is likely a *Derivative Database* → must be offered under ODbL. |
| 2 | LA City *Listing of Active Businesses* (data.lacity.org `6rrh-rzua`) | ✅ Downloaded | 58,224 businesses in download box; 18,742 in core (782 NAICS 722 food service). Updated 2026-09-15 | **CC0 1.0** (public domain), stated in dataset metadata |
| 3 | LA Metro GTFS bus + rail (gitlab.com/LACMTA) | ✅ Downloaded | 593 bus stops + 32 rail stops in core; scheduled departures by hour. Bus calendar 2026-06-07→2026-12-12; rail 2026-10-07→2026-10-21 | Metro developer terms page returned 404 — **re-check before launch**. Standard practice: attribute "LA Metro". |
| 4 | Census LODES8 WAC 2023 + block crosswalk | ✅ Downloaded, gzip verified | 96,387 jobs in 1,154 core blocks (31,638 education, 12,153 food & lodging, 6,190 retail) | U.S. Government work — public domain. Cite "U.S. Census Bureau, LEHD LODES 8". |
| 5 | Census 2020 block population (TIGER/Line `tl_2020_06_tabblock20`) | ✅ Downloaded | LA County 91,626 blocks, pop 10,014,009 (matches official 2020 total); core 1,340 blocks, 234,404 people, 75,072 housing units | Public domain. Census Data API now requires a key, so we used the keyless TIGER file instead. |
| 6 | LADOT Walk & Bike Count 2019 / 2021 / 2023 / 2025 (`m6qi-ifup`, `9tzi-nz7g`, `6ux4-qj74`, `hiwe-xzrt`) | ✅ Downloaded | 62 count records at 22 street segments inside download box; 3 segments within 1 km of USC (Hoover St, Figueroa St, Jefferson Blvd). Weekday counts 7–10 AM + 3–6 PM; weekend 11 AM–1 PM (per dataset description) | **No license stated** in metadata. City portal default terms not found — **ask LADOT / treat as validation-only until confirmed.** |
| 7 | UC Berkeley CAT Data Portal | ⛔ Not obtained | Requires a free account (the user must create it) | Terms not published |
| 8 | Census Data API (ACS) | ⛔ Not used | Requires an API key (user sign-up) | Not needed for now (TIGER covers population) |

## Known data-quality issues (to handle in the model)

- **OSM sidewalks are mapped inconsistently** (19,463 footway ways). Counting footways would reward well-mapped areas, so connectivity should use the street centreline network.
- **Business registry is noisy:** includes home-based firms, caterers and holding companies; top-20 coordinates hold 4.1 % of all records (office towers / geocode pile-ups); 4,665 records lack NAICS codes. Filter to storefront-type NAICS and cross-check with OSM.
- **LODES assigns employer jobs to one block:** USC's 22,141 education jobs sit on a single block (34.0183, −118.2869). Needs spreading over the campus or a log/capped transform.
- **GTFS = scheduled service, not ridership.** Good for time-of-day of transit supply; not a count of people.
- **Count timing:** weekday counts cover 6 h, weekend 2 h; whether these are single days or averages is not stated in the metadata.
- Counts were placed by matching street names to OSM intersections (`scripts/locate_counts.py`), not by official coordinates.
