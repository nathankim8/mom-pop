"""Place LADOT Walk & Bike Count segments using OSM street intersections (only inside the OSM download box)."""
import json, re, sys, glob, collections, math
osm = json.load(open(sys.argv[1]))
ABBR = {"street": "st", "avenue": "ave", "boulevard": "blvd", "drive": "dr", "place": "pl", "road": "rd",
        "way": "way", "lane": "ln", "court": "ct", "terrace": "ter", "parkway": "pkwy"}
DIRS = {"north", "south", "east", "west", "n", "s", "e", "w"}
def norm(name):
    w = re.sub(r"[^a-z0-9 ]", " ", name.lower()).split()
    w = [ABBR.get(x, x) for x in w]
    while w and w[0] in DIRS: w = w[1:]
    w = [x for x in w if x not in ("jr",)]
    return " ".join(w)
nodes = {e["id"]: (e["lat"], e["lon"]) for e in osm["elements"] if e["type"] == "node" and "lat" in e}
street_nodes = collections.defaultdict(set)
for e in osm["elements"]:
    t = e.get("tags", {})
    if e["type"] == "way" and "highway" in t and "name" in t and t["highway"] not in ("footway", "service", "path", "cycleway", "steps"):
        street_nodes[norm(t["name"])].update(e["nodes"])
def crossing(a, b):
    common = street_nodes.get(norm(a), set()) & street_nodes.get(norm(b), set())
    pts = [nodes[n] for n in common if n in nodes]
    if not pts: return None
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
out = []
for f in sorted(glob.glob(sys.argv[2] + "/rows_*.json")):
    meta = json.load(open(f.replace("rows_", "meta_")))
    year = meta["name"][:4]
    for r in json.load(open(f)):
        s, l1, l2 = r.get("street_name", ""), r.get("limit_1", ""), r.get("limit_2", "")
        p1, p2 = crossing(s, l1), crossing(s, l2)
        if p1 and p2:
            lat, lon = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
        elif p1 or p2:
            lat, lon = p1 or p2
        else:
            continue
        wk = r.get("ped_weekday_total") or r.get("ped_weekday")
        we = r.get("ped_weekend")
        out.append({"year": year, "segment": f"{s} bw {l1} & {l2}", "lat": round(lat, 6), "lon": round(lon, 6),
                    "both_ends_found": bool(p1 and p2), "ped_weekday": int(wk) if wk else None, "ped_weekend": int(we) if we else None})
json.dump(out, open(sys.argv[3], "w"), indent=1)
usc = (34.0224, -118.2851)
def km(a): return math.hypot((a["lat"] - usc[0]) * 111, (a["lon"] - usc[1]) * 92)
print("count records placed inside OSM box:", len(out), "| unique segments:", len({o['segment'] for o in out}))
for o in sorted(out, key=km)[:40]:
    print(f"{km(o):4.1f} km  {o['year']}  {o['segment'][:58]:58} wkday={o['ped_weekday']} wkend={o['ped_weekend']} {'' if o['both_ends_found'] else '(one end only)'}")
