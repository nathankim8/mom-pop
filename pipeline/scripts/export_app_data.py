"""
Stage 3 — export the validated USC-area model for the React app.

Writes ../public/data/usc-model-v1.json with:
  grid          100 m cells: modelled pedestrian-activity percentile (ONE percentile scale, computed once over the
                whole modelling area) + low-confidence flags
  ladot         the 22 LADOT count sites exactly as published per year (no averaging, no per-hour conversion)
  transitStops  scheduled weekday departures by hour (Metro GTFS) — transit service, not pedestrians
  competitors   OSM food places (observed listings; cuisine from OSM tags / obvious name keywords)
  candidateSites public places to rank (intersections / stations located from OSM + GTFS)
  validation    headline numbers from out/validation_report.json + comparability checks run here

Requires build_features.py and model_validate.py to have run first.
Usage: python3 -I scripts/export_app_data.py <pipeline dir>
"""
import collections, csv, glob, io, json, math, re, sys, zipfile
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from scipy.stats import spearmanr

ROOT = Path(sys.argv[1]).resolve()
RAW, OUT = ROOT / "raw", ROOT / "out"
DEST = ROOT.parent / "public/data/usc-model-v1.json"
DEST.parent.mkdir(parents=True, exist_ok=True)

LAT_REF = 34.02
KX, KY = 111_320 * math.cos(math.radians(LAT_REF)), 110_574
xy = lambda lat, lon: np.column_stack([(np.asarray(lon, float) + 118.28) * KX, (np.asarray(lat, float) - LAT_REF) * KY])

report = json.load(open(OUT / "validation_report.json"))
grid = pd.read_csv(OUT / "grid_predictions.csv")
sites = pd.read_csv(OUT / "site_validation.csv")
YEARS = ["2019", "2021", "2023", "2025"]

# ------------------------------------------------------------------ OSM helpers
osm = json.load(open(RAW / "osm/usc_area.json"))["elements"]
nodes = {e["id"]: (e["lat"], e["lon"]) for e in osm if e["type"] == "node" and "lat" in e}
DIRS = {"north", "south", "east", "west", "n", "s", "e", "w"}
ABBR = {"street": "st", "avenue": "ave", "boulevard": "blvd", "place": "pl", "drive": "dr"}


def norm(n):
    w = [ABBR.get(x, x) for x in re.sub(r"[^a-z0-9 ]", " ", n.lower()).split()]
    while w and w[0] in DIRS:
        w = w[1:]
    return " ".join(w)


street_nodes = collections.defaultdict(set)
for e in osm:
    t = e.get("tags", {})
    if e["type"] == "way" and "name" in t and t.get("highway") not in (None, "footway", "service", "path", "cycleway", "steps"):
        street_nodes[norm(t["name"])].update(e["nodes"])


def crossing(a, b):
    pts = [nodes[n] for n in street_nodes[norm(a)] & street_nodes[norm(b)] if n in nodes]
    if not pts:
        raise SystemExit(f"intersection not found in OSM: {a} & {b}")
    return (float(np.mean([p[0] for p in pts])), float(np.mean([p[1] for p in pts])))


# ------------------------------------------------------------------ grid geometry + flags
lats, lons = np.sort(grid.lat.unique()), np.sort(grid.lon.unique())
d_lat, d_lon = float(np.median(np.diff(lats))), float(np.median(np.diff(lons)))
grid = grid.sort_values(["lat", "lon"]).reset_index(drop=True)
assert len(grid) == len(lats) * len(lons)

# USC University Park campus edge zone (JUDGEMENT, see VALIDATION.md): the campus block bounded by Jefferson,
# Figueroa, Exposition and Vermont, plus 500 m around it. Both count sites next to campus were under-predicted 1.6–3×.
campus = [crossing("Jefferson Blvd", "Vermont Ave"), crossing("Jefferson Blvd", "Figueroa St"),
          crossing("Exposition Blvd", "Figueroa St"), crossing("Exposition Blvd", "Vermont Ave")]
c_lat = [p[0] for p in campus]
c_lon = [p[1] for p in campus]
EDGE_M = 500
in_edge = (grid.lat.between(min(c_lat) - EDGE_M / KY, max(c_lat) + EDGE_M / KY)
           & grid.lon.between(min(c_lon) - EDGE_M / KX, max(c_lon) + EDGE_M / KX))

FLAG_MINOR_STREET, FLAG_OUT_OF_RANGE, FLAG_CAMPUS_EDGE = 1, 2, 4
flags = ((grid.on_major_street == 0) * FLAG_MINOR_STREET
         + (grid.within_validated_range == 0) * FLAG_OUT_OF_RANGE
         + in_edge * FLAG_CAMPUS_EDGE).astype(int)
pct = grid.index_pct.round().astype(int)

# ------------------------------------------------------------------ LADOT counts: as published + comparability checks
raw_rows = {}
for f in sorted(glob.glob(str(RAW / "counts/rows_*.json"))):
    year = json.load(open(f.replace("rows_", "meta_")))["name"][:4]
    for r in json.load(open(f)):
        raw_rows[(year, f"{r.get('street_name', '')} bw {r.get('limit_1', '')} & {r.get('limit_2', '')}")] = r

checks = {"total_equals_weekday_plus_weekend": 0, "total_mismatch": [], "weekend_outliers": []}
ladot = []
for _, s in sites.iterrows():
    obs = []
    for y in YEARS:
        wk, we = s[f"wkday_{y}"], s[f"wkend_{y}"]
        if pd.isna(wk) and pd.isna(we):
            continue
        r = raw_rows.get((y, s.segment))
        tot = r and (r.get("ped_total"))
        if tot and pd.notna(wk) and pd.notna(we):
            if int(tot) == int(wk) + int(we):
                checks["total_equals_weekday_plus_weekend"] += 1
            else:
                checks["total_mismatch"].append(f"{s.segment} {y}: total {tot} ≠ {int(wk)} + {int(we)}")
        obs.append({"year": int(y), "weekday6h": None if pd.isna(wk) else int(wk), "weekend2h": None if pd.isna(we) else int(we)})
    # Weekend values that are < 10 % of the site's other weekend years are flagged, not removed.
    we_vals = [o["weekend2h"] for o in obs if o["weekend2h"]]
    for o in obs:
        others = [v for v in we_vals if v != o["weekend2h"]]
        if o["weekend2h"] and others and o["weekend2h"] < 0.1 * np.median(others):
            o["note"] = "Weekend value far below this site's other years — possibly a data-entry or counting issue."
            checks["weekend_outliers"].append(f"{s.segment} {o['year']}: weekend {o['weekend2h']}")
    street, rest = s.segment.split(" bw ")
    ladot.append({
        "id": f"ladot-{len(ladot) + 1}",
        "segment": s.segment,
        "street": street,
        "between": rest,
        "position": [round(s.lon, 6), round(s.lat, 6)],
        "placement": "Both segment ends matched to OSM intersections" if s.both_ends_found
                     else "Only one end matched — position approximate",
        "observations": obs,
        "modelPercentile": None,  # filled below if inside the grid
        "insideModelArea": False,
    })

# Year comparability: COVID-era 2021 vs other years at sites counted in both.
ratios = []
for s in ladot:
    v = {o["year"]: o["weekday6h"] for o in s["observations"] if o["weekday6h"]}
    if 2021 in v and len(v) > 1:
        others = [x for y, x in v.items() if y != 2021]
        ratios.append(v[2021] / math.exp(np.mean(np.log(others))))
checks["weekday_2021_vs_other_years_median_ratio"] = float(np.median(ratios))
checks["sites_with_2021_and_other_years"] = len(ratios)
checks["sites_counted_only_in_one_year"] = [s["segment"] for s in ladot if len(s["observations"]) == 1]

g_tree = cKDTree(xy(grid.lat, grid.lon))
for s in ladot:
    lon, lat = s["position"]
    inside = lats[0] - d_lat / 2 <= lat <= lats[-1] + d_lat / 2 and lons[0] - d_lon / 2 <= lon <= lons[-1] + d_lon / 2
    s["insideModelArea"] = bool(inside)
    if inside:
        _, i = g_tree.query(xy([lat], [lon])[0])
        s["modelPercentile"] = int(pct[i])

# ------------------------------------------------------------------ transit: scheduled weekday departures by hour
REF_DATE, REF_DOW = "20261014", "wednesday"
area = dict(south=lats[0] - 0.005, north=lats[-1] + 0.005, west=lons[0] - 0.006, east=lons[-1] + 0.006)


def read_csv(z, name):
    with z.open(name) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, "utf-8-sig")))


stops_out, station_pos = [], {}
for path, mode in [(RAW / "gtfs/gtfs_bus.zip", "bus"), (RAW / "gtfs/gtfs_rail.zip", "rail")]:
    z = zipfile.ZipFile(path)
    active = {c["service_id"] for c in read_csv(z, "calendar.txt") if c["start_date"] <= REF_DATE <= c["end_date"] and c[REF_DOW] == "1"}
    for c in read_csv(z, "calendar_dates.txt") if "calendar_dates.txt" in z.namelist() else []:
        if c["date"] == REF_DATE:
            (active.add if c["exception_type"] == "1" else active.discard)(c["service_id"])
    trips = {t["trip_id"] for t in read_csv(z, "trips.txt") if t["service_id"] in active}
    stops = {s["stop_id"]: s for s in read_csv(z, "stops.txt") if s["stop_lat"].strip()
             and area["south"] <= float(s["stop_lat"]) <= area["north"] and area["west"] <= float(s["stop_lon"]) <= area["east"]}
    hourly = collections.defaultdict(lambda: [0] * 24)
    with z.open("stop_times.txt") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, "utf-8-sig")):
            if r["trip_id"] in trips and r["stop_id"] in stops:
                h = r.get("departure_time") or ""
                if h:
                    hourly[r["stop_id"]][int(h.split(":")[0]) % 24] += 1
    for sid, h in hourly.items():
        s = stops[sid]
        stops_out.append({"mode": mode, "name": s["stop_name"].strip(), "position": [round(float(s["stop_lon"]), 6), round(float(s["stop_lat"]), 6)], "hourly": h})
        if mode == "rail":
            station_pos.setdefault(s["stop_name"].strip(), (float(s["stop_lat"]), float(s["stop_lon"])))

# ------------------------------------------------------------------ competitors: OSM food places in the area
CUISINE = {
    "tacos": {"mexican", "tex-mex", "oaxacan", "taco", "tacos", "burrito", "latin_american", "salvadoran", "salvadorean", "guatemalan", "nicaraguan"},
    "asian": {"korean", "japanese", "chinese", "sushi", "ramen", "asian", "vietnamese", "thai", "noodle", "noodles", "beef_bowl", "yakitori", "dumpling", "filipino", "indian"},
    "burgers": {"burger", "american", "chicken", "fried_chicken", "wings", "hot_dog", "sandwich", "barbecue", "pizza", "southern", "steak_house"},
    "coffee": {"coffee_shop", "coffee", "breakfast", "donut", "pancake", "bagel", "pastry", "cafe"},
    "dessert": {"ice_cream", "dessert", "bubble_tea", "frozen_yogurt", "cake", "tea", "juice", "donut"},
    "healthy": {"salad", "poke", "mediterranean", "vegan", "vegetarian", "healthy", "organic", "greek"},
}
NAME_HINTS = [("tacos", r"\btaco|taquer|burrito|tamal"), ("burgers", r"burger|wings|pizza"), ("coffee", r"coffee|espresso|caf[eé]\b|donut"),
              ("dessert", r"boba|ice cream|yogurt|dessert|tea\b"), ("asian", r"sushi|ramen|pho\b|teriyaki|wok|panda"),
              ("healthy", r"salad|poke|juice|bowl")]
FOOD = {"restaurant", "fast_food", "cafe", "food_court", "ice_cream"}  # bars/pubs are not direct food competitors here


def category(t):
    for c in t.get("cuisine", "").split(";"):
        for k, vals in CUISINE.items():
            if c.strip() in vals:
                return k, "OSM cuisine tag"
    name = t.get("name", "").lower()
    for k, rx in NAME_HINTS:
        if re.search(rx, name):
            return k, "name keyword"
    if t.get("amenity") == "cafe":
        return "coffee", "OSM amenity=cafe"
    if t.get("amenity") == "ice_cream":
        return "dessert", "OSM amenity=ice_cream"
    return "other", "unclassified"


competitors, cat_basis = [], collections.Counter()
for e in osm:
    t = e.get("tags", {})
    if t.get("amenity") not in FOOD:
        continue
    if e["type"] == "node":
        lat, lon = e["lat"], e["lon"]
    else:
        pts = [nodes[n] for n in e.get("nodes", []) if n in nodes]
        if not pts:
            continue
        lat, lon = np.mean([p[0] for p in pts]), np.mean([p[1] for p in pts])
    if not (area["south"] <= lat <= area["north"] and area["west"] <= lon <= area["east"]):
        continue
    cat, basis = category(t)
    cat_basis[basis] += 1
    fmt = "cart" if t.get("street_vendor") == "yes" or t.get("vending") else "restaurant"
    competitors.append({"id": f"osm-{e['type'][0]}{e['id']}", "name": t.get("name", "Unnamed food place"),
                        "position": [round(float(lon), 6), round(float(lat), 6)], "category": cat, "format": fmt})

# ------------------------------------------------------------------ candidate vending spots (public places)
INTERSECTIONS = [
    ("Jefferson & Hoover", "USC", "Jefferson Blvd", "Hoover St"),
    ("Figueroa & Jefferson", "University Park", "Figueroa St", "Jefferson Blvd"),
    ("Figueroa & Adams", "University Park", "Figueroa St", "Adams Blvd"),
    ("Vermont & Adams", "University Park", "Vermont Ave", "Adams Blvd"),
    ("Vermont & Vernon", "Vermont Square", "Vermont Ave", "Vernon Ave"),
    ("Vermont & Slauson", "Vermont-Slauson", "Vermont Ave", "Slauson Ave"),
    ("Western & Jefferson", "Jefferson Park", "Western Ave", "Jefferson Blvd"),
    ("Normandie & Exposition", "Exposition Park", "Normandie Ave", "Exposition Blvd"),
    ("Central & Vernon", "Central-Alameda", "Central Ave", "Vernon Ave"),
    ("Central & Washington", "Historic South-Central", "Central Ave", "Washington Blvd"),
    ("7th & Figueroa", "Financial District", "7th St", "Figueroa St"),
    ("Broadway & 7th", "Historic Core", "Broadway", "7th St"),
    ("Olympic & Figueroa (LA Live)", "South Park", "Olympic Blvd", "Figueroa St"),
    ("Santee Alley at Olympic", "Fashion District", "Santee St", "Olympic Blvd"),
]
candidates = [{"name": n, "neighborhood": hood, "position": [round(p[1], 6), round(p[0], 6)]}
              for n, hood, a, b in INTERSECTIONS for p in [crossing(a, b)]]
STATIONS = [("Expo Park / USC", "Exposition Park"), ("Expo / Vermont", "Exposition Park"), ("Expo / Western", "Jefferson Park"),
            ("Jefferson / USC", "University Park"), ("LATTC / Ortho Institute", "University Park"), ("Pico", "South Park")]
for key, hood in STATIONS:
    name = next((n for n in station_pos if n.lower().startswith(key.lower())), None)
    if name is None:
        raise SystemExit(f"rail station not found in GTFS: {key}  (have: {sorted(station_pos)[:40]})")
    lat, lon = station_pos[name]
    candidates.append({"name": f"{name.replace(' Station', '')} station", "neighborhood": hood, "position": [round(lon, 6), round(lat, 6)]})
candidates.append({"name": "Exposition Park Rose Garden", "neighborhood": "Exposition Park", "position": [-118.2869, 34.0167]})
for i, c in enumerate(candidates):
    c["id"] = f"usc-site-{i + 1}"

# ------------------------------------------------------------------ validation headline numbers
p = report["primary"]["schemes"]
dt = sites.lat.gt(34.04) & sites.lon.gt(-118.265)
validation = {
    "nSites": report["primary"]["n_sites"],
    "spearmanLOO": round(p["leave_one_out"]["index"]["spearman"], 2),
    "spearmanLOOci95": [round(x, 2) for x in p["leave_one_out"]["index"]["spearman_ci95"]],
    "spearmanUncalibrated": round(report["primary"]["index_uncalibrated_spearman"], 2),
    "spearmanOutsideDowntown": round(float(spearmanr(sites[~dt].y_all, sites[~dt].index_raw).statistic), 2),
    "nOutsideDowntown": int((~dt).sum()),
    "spearmanDowntown": round(float(spearmanr(sites[dt].y_all, sites[dt].index_raw).statistic), 2),
    "nDowntown": int(dt.sum()),
    "medianSplitCorrect": round(p["leave_one_out"]["index"]["median_split_accuracy"] * report["primary"]["n_sites"]),
    "typicalFactorLOO": round(p["leave_one_out"]["index"]["typical_factor"], 1),
    "typicalFactorSpatial": round(p["spatial_blocks"]["index"]["typical_factor"], 1),
    "nullTypicalFactor": round(p["leave_one_out"]["null"]["typical_factor"], 1),
    "ridgeSpearmanLOO": round(p["leave_one_out"]["ridge"]["spearman"], 2),
    "forestSpearmanLOO": round(p["leave_one_out"]["forest"]["spearman"], 2),
    "yearToYearMedianChangePct": round(report["repeatability"]["median_abs_pct_diff_between_years"]),
    "gridCellsOutOfRangePct": round(100 - report["grid_cells_within_site_feature_range_pct"]),
    "gridCellsMinorStreetPct": round(100 - report["grid_cells_on_major_street_pct"]),
    "countSitesOnMajorStreets": report["count_sites_on_major_street"],
    "comparability": checks,
}

out = {
    "version": "usc-ped-index-v1",
    "generated": date.today().isoformat(),
    "area": {"south": float(lats[0] - d_lat / 2), "north": float(lats[-1] + d_lat / 2),
             "west": float(lons[0] - d_lon / 2), "east": float(lons[-1] + d_lon / 2)},
    "grid": {"south": float(lats[0]), "west": float(lons[0]), "dLat": d_lat, "dLng": d_lon,
             "rows": len(lats), "cols": len(lons), "percentile": pct.tolist(), "flags": flags.tolist()},
    "flagBits": {"minorStreet": FLAG_MINOR_STREET, "outOfRange": FLAG_OUT_OF_RANGE, "campusEdge": FLAG_CAMPUS_EDGE},
    "campusEdgeZone": {"south": min(c_lat) - EDGE_M / KY, "north": max(c_lat) + EDGE_M / KY,
                       "west": min(c_lon) - EDGE_M / KX, "east": max(c_lon) + EDGE_M / KX},
    "features": [report["feature_labels"][f] for f in report["features"]],
    "validation": validation,
    "ladot": ladot,
    "transit": {"referenceDate": "2026-10-14", "dayType": "Weekday (Wednesday) schedule", "stops": stops_out},
    "competitors": competitors,
    "candidateSites": candidates,
}
json.dump(out, open(DEST, "w"), separators=(",", ":"))

print(f"wrote {DEST} ({DEST.stat().st_size / 1024:.0f} KB)")
print(f"grid {len(lats)}×{len(lons)}; flags: minor street {int((flags & 1 > 0).sum())}, out of range {int((flags & 2 > 0).sum())}, campus edge {int((flags & 4 > 0).sum())}")
print(f"LADOT sites {len(ladot)} ({sum(s['insideModelArea'] for s in ladot)} inside model grid)")
print("comparability:", json.dumps(checks, indent=1))
print(f"transit stops {len(stops_out)}; competitors {len(competitors)} {dict(cat_basis)} by category {dict(collections.Counter(c['category'] for c in competitors))}")
print(f"candidate sites {len(candidates)}:", [c['name'] for c in candidates])
