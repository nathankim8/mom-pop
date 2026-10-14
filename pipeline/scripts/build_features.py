"""
Stage 2a — turn the raw public datasets into per-location features.

Outputs (pipeline/out/):
  count_sites.csv     one row per LADOT count segment: observed counts by year + features
  grid_features.csv   one row per 100 m grid cell over the modelling area + features

Every feature is computed the same way for count sites and grid cells, using buffers that
were fixed BEFORE looking at the counts (400 m ≈ 5-min walk for street-level features,
800 m ≈ 10-min walk for population / jobs). Nothing here is fitted to the counts.

Usage: python3 -I scripts/build_features.py <pipeline dir>
"""
import collections, csv, glob, gzip, io, json, math, re, sys, zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

ROOT = Path(sys.argv[1])
RAW, OUT = ROOT / "raw", ROOT / "out"
OUT.mkdir(exist_ok=True)

# Download box for OSM + business listings (see DATA_SOURCES.md). Census, LODES and GTFS are not box-limited.
DL = dict(lat0=33.98, lat1=34.06, lon0=-118.33, lon1=-118.24)
LOCAL_M, AREA_M = 400, 800
GRID_STEP_M = 100
REF_DATE = "20261014"  # a Wednesday inside both the bus and rail GTFS calendars
REF_DOW = "wednesday"

# Local planar projection (equirectangular around the study area; error < 0.1 % over 10 km).
LAT_REF = 34.02
KX, KY = 111_320 * math.cos(math.radians(LAT_REF)), 110_574


def xy(lat, lon):
    return np.column_stack([(np.asarray(lon, float) + 118.28) * KX, (np.asarray(lat, float) - LAT_REF) * KY])


def buffer_inside_download_box(lat, lon, r):
    """True when a radius-r buffer lies fully inside the OSM/business download box."""
    dlat, dlon = r / KY, r / KX
    return (lat - dlat >= DL["lat0"]) & (lat + dlat <= DL["lat1"]) & (lon - dlon >= DL["lon0"]) & (lon + dlon <= DL["lon1"])


# ---------------------------------------------------------------- OSM
print("loading OSM …")
osm = json.load(open(RAW / "osm/usc_area.json"))["elements"]
nodes = {e["id"]: (e["lat"], e["lon"]) for e in osm if e["type"] == "node" and "lat" in e}

FOOD_AMENITY = {"restaurant", "fast_food", "cafe", "food_court", "ice_cream", "bar", "pub"}
# Streets people walk along. Motorways and their ramps are excluded (no sidewalks); footways are excluded because
# OSM sidewalk mapping is inconsistent across the area (see DATA_SOURCES.md).
STREET = {"primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "pedestrian",
          "trunk", "primary_link", "secondary_link", "tertiary_link"}
MAJOR = {"primary", "secondary", "trunk"}


def centroid(e):
    if e["type"] == "node":
        return e.get("lat"), e.get("lon")
    pts = [nodes[n] for n in e.get("nodes", []) if n in nodes]
    if not pts:
        return None, None
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


food_pts, shop_pts = [], []
degree = collections.Counter()
street_ways = []
for e in osm:
    t = e.get("tags", {})
    if t.get("amenity") in FOOD_AMENITY:
        food_pts.append(centroid(e))
    elif "shop" in t:
        shop_pts.append(centroid(e))
    if e["type"] == "way" and t.get("highway") in STREET:
        ns = e["nodes"]
        street_ways.append(e)
        # Degree = number of street "arms" meeting at a node (interior nodes count 2, endpoints 1).
        for i, n in enumerate(ns):
            degree[n] += 1 if i in (0, len(ns) - 1) else 2
food_pts = np.array([p for p in food_pts if p[0] is not None])
shop_pts = np.array([p for p in shop_pts if p[0] is not None])
inter_pts = np.array([nodes[n] for n, d in degree.items() if d >= 3 and n in nodes])
print(f"  OSM food places {len(food_pts)}, shops {len(shop_pts)}, street intersections {len(inter_pts)}")

# Street-class lookup: sample points every ~20 m along every street way, tagged major/minor.
seg_pts, seg_major, seg_names = [], [], []
for e in street_ways:
    t = e["tags"]
    ps = [nodes[n] for n in e["nodes"] if n in nodes]
    for a, b in zip(ps, ps[1:]):
        L = math.hypot((b[0] - a[0]) * KY, (b[1] - a[1]) * KX)
        k = max(1, int(L // 20))
        for j in range(k + 1):
            f = j / k
            seg_pts.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
            seg_major.append(t["highway"] in MAJOR)
            seg_names.append(t.get("name", ""))
seg_tree = cKDTree(xy(*np.array(seg_pts).T))
seg_major = np.array(seg_major)

# ---------------------------------------------------------------- LA City business listings
print("loading business listings …")
biz = []
for f in sorted(glob.glob(str(RAW / "business/page_*.json"))):
    biz += json.load(open(f))
b = pd.DataFrame({
    "lat": [float(r["location_1"]["latitude"]) for r in biz],
    "lon": [float(r["location_1"]["longitude"]) for r in biz],
    "naics": [(r.get("naics") or "") for r in biz],
})
# Geocode pile-ups (office towers, registered-agent addresses): keep at most 5 businesses per exact coordinate,
# otherwise one tower full of holding companies looks like a busy shopping street.
b["key"] = b.lat.round(5).astype(str) + "," + b.lon.round(5).astype(str)
b = b.groupby("key", group_keys=False).head(5)
# Storefront-type NAICS: retail (44-45), food service (722), personal services (812).
storefront = b[b.naics.str[:2].isin(["44", "45"]) | b.naics.str.startswith("722") | b.naics.str.startswith("812")]
food_biz = b[b.naics.str.startswith("722")]
print(f"  businesses after pile-up cap {len(b)}, storefront-type {len(storefront)}, food service {len(food_biz)}")

# ---------------------------------------------------------------- Census population (2020 blocks)
blocks = pd.read_csv(RAW / "census/la_county_blocks_2020.csv")
blocks = blocks[blocks.lat.between(33.9, 34.15) & blocks.lon.between(-118.45, -118.1)]

# ---------------------------------------------------------------- LODES jobs (2023, workplace)
wac = pd.read_csv(RAW / "lodes/ca_wac_S000_JT00_2023.csv.gz", dtype={"w_geocode": str}, usecols=["w_geocode", "C000"])
xw = pd.read_csv(RAW / "lodes/ca_xwalk.csv.gz", dtype={"tabblk2020": str}, usecols=["tabblk2020", "blklatdd", "blklondd"])
jobs = wac.merge(xw, left_on="w_geocode", right_on="tabblk2020")
jobs = jobs[jobs.blklatdd.between(33.9, 34.15) & jobs.blklondd.between(-118.45, -118.1)]

# ---------------------------------------------------------------- GTFS: scheduled departures on REF_DATE
print("counting GTFS departures …")


def read_csv(z, name):
    with z.open(name) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, "utf-8-sig")))


stop_rows, hourly = [], collections.defaultdict(lambda: np.zeros(24))
for path, mode in [(RAW / "gtfs/gtfs_bus.zip", "bus"), (RAW / "gtfs/gtfs_rail.zip", "rail")]:
    z = zipfile.ZipFile(path)
    active = {c["service_id"] for c in read_csv(z, "calendar.txt")
              if c["start_date"] <= REF_DATE <= c["end_date"] and c[REF_DOW] == "1"}
    for c in read_csv(z, "calendar_dates.txt") if "calendar_dates.txt" in z.namelist() else []:
        if c["date"] == REF_DATE:
            (active.add if c["exception_type"] == "1" else active.discard)(c["service_id"])
    trips = {t["trip_id"] for t in read_csv(z, "trips.txt") if t["service_id"] in active}
    stops = {s["stop_id"]: s for s in read_csv(z, "stops.txt") if s["stop_lat"].strip()}
    # Rail feeds list platforms with a parent station; count departures at the platform, place at its own coords.
    with z.open("stop_times.txt") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, "utf-8-sig")):
            if r["trip_id"] in trips and r["stop_id"] in stops:
                h = r.get("departure_time") or r.get("arrival_time") or ""
                if h:
                    hourly[(mode, r["stop_id"])][int(h.split(":")[0]) % 24] += 1
    for sid, s in stops.items():
        if (mode, sid) in hourly:
            stop_rows.append({"mode": mode, "stop_id": sid, "name": s["stop_name"], "lat": float(s["stop_lat"]),
                              "lon": float(s["stop_lon"]), "deps": hourly[(mode, sid)].sum()})
    print(f"  {mode}: {len(active)} active service ids, {len(trips)} trips on {REF_DATE}")
stops = pd.DataFrame(stop_rows)
stops = stops[stops.lat.between(33.9, 34.15) & stops.lon.between(-118.45, -118.1)].reset_index(drop=True)
rail_stops = stops[stops["mode"] == "rail"]
# Observed (scheduled) transit supply by hour across all stops in the download box — used later only as a
# labelled time-of-day *supply* profile, never as a pedestrian count.
in_box = stops.lat.between(DL["lat0"], DL["lat1"]) & stops.lon.between(DL["lon0"], DL["lon1"])
hour_profile = sum(hourly[(m, s)] for m, s in zip(stops[in_box]["mode"], stops[in_box].stop_id))
json.dump({"ref_date": REF_DATE, "departures_by_hour": hour_profile.astype(int).tolist()},
          open(OUT / "transit_hourly_supply.json", "w"))


# ---------------------------------------------------------------- feature computation
def count_within(src_lat, src_lon, q, r, weights=None):
    if len(src_lat) == 0:
        return np.zeros(len(q))
    tree = cKDTree(xy(src_lat, src_lon))
    hits = tree.query_ball_point(q, r)
    if weights is None:
        return np.array([len(h) for h in hits], float)
    w = np.asarray(weights, float)
    return np.array([w[h].sum() for h in hits])


def features(lat, lon):
    lat, lon = np.asarray(lat, float), np.asarray(lon, float)
    q = xy(lat, lon)
    f = pd.DataFrame({"lat": lat, "lon": lon})
    f["osm_food_400"] = count_within(food_pts[:, 0], food_pts[:, 1], q, LOCAL_M)
    f["osm_shops_400"] = count_within(shop_pts[:, 0], shop_pts[:, 1], q, LOCAL_M)
    f["biz_storefront_400"] = count_within(storefront.lat.values, storefront.lon.values, q, LOCAL_M)
    f["biz_food_400"] = count_within(food_biz.lat.values, food_biz.lon.values, q, LOCAL_M)
    f["intersections_400"] = count_within(inter_pts[:, 0], inter_pts[:, 1], q, LOCAL_M)
    f["pop_800"] = count_within(blocks.lat.values, blocks.lon.values, q, AREA_M, blocks["pop"].values)
    f["jobs_800"] = count_within(jobs.blklatdd.values, jobs.blklondd.values, q, AREA_M, jobs.C000.values)
    f["transit_deps_400"] = count_within(stops.lat.values, stops.lon.values, q, LOCAL_M, stops.deps.values)
    d_rail, _ = cKDTree(xy(rail_stops.lat.values, rail_stops.lon.values)).query(q)
    f["rail_dist_m"] = d_rail
    _, idx = seg_tree.query(q)
    f["on_major_street"] = seg_major[idx].astype(int)
    f["osm_biz_coverage_ok"] = buffer_inside_download_box(lat, lon, LOCAL_M).astype(int)
    return f


# ---------------------------------------------------------------- count sites
counts = json.load(open(RAW / "counts/located_counts.json"))
by_seg = collections.defaultdict(dict)
pos = {}
for c in counts:
    by_seg[c["segment"]][c["year"]] = (c["ped_weekday"], c["ped_weekend"])
    pos[c["segment"]] = (c["lat"], c["lon"], c["both_ends_found"])
segs = sorted(by_seg)
site = features([pos[s][0] for s in segs], [pos[s][1] for s in segs])
site.insert(0, "segment", segs)
site["both_ends_found"] = [int(pos[s][2]) for s in segs]
for y in ("2019", "2021", "2023", "2025"):
    site[f"wkday_{y}"] = [by_seg[s].get(y, (None, None))[0] for s in segs]
    site[f"wkend_{y}"] = [by_seg[s].get(y, (None, None))[1] for s in segs]
# Street class of the *counted* street: snap to the nearest OSM street with the same normalised name.
ABBR = {"street": "st", "avenue": "ave", "boulevard": "blvd", "bl": "blvd", "place": "pl"}
DIRS = {"north", "south", "east", "west", "n", "s", "e", "w"}


def norm(n):
    w = [ABBR.get(x, x) for x in re.sub(r"[^a-z0-9 ]", " ", n.lower()).split()]
    while w and w[0] in DIRS:
        w = w[1:]
    return " ".join(w)



names = np.array([norm(n) for n in seg_names])
seg_xy = seg_tree.data
on_major = []
for s, (la, lo, _) in zip(segs, [pos[s] for s in segs]):
    street = norm(s.split(" bw ")[0])
    m = names == street
    if m.any():
        d = np.hypot(*(seg_xy[m] - xy([la], [lo])[0]).T)
        on_major.append(int(seg_major[m][d.argmin()]))
    else:
        on_major.append(None)
site["on_major_street"] = on_major
site.to_csv(OUT / "count_sites.csv", index=False)
print(f"count sites: {len(site)} ({int((site.osm_biz_coverage_ok == 0).sum())} with truncated OSM/business buffers)")

# ---------------------------------------------------------------- grid over the modelling area
# Modelling area = download box shrunk by the 400 m buffer, so every cell sees complete OSM/business data.
m_lat, m_lon = LOCAL_M / KY, LOCAL_M / KX
lats = np.arange(DL["lat0"] + m_lat, DL["lat1"] - m_lat, GRID_STEP_M / KY)
lons = np.arange(DL["lon0"] + m_lon, DL["lon1"] - m_lon, GRID_STEP_M / KX)
G = np.array([(a, o) for a in lats for o in lons])
grid = features(G[:, 0], G[:, 1])
grid.to_csv(OUT / "grid_features.csv", index=False)
print(f"grid cells: {len(grid)} ({len(lats)} × {len(lons)}, {GRID_STEP_M} m)")
