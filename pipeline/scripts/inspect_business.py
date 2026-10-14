import json, sys, glob, collections
rows = []
for f in sorted(glob.glob(sys.argv[1] + "/page_*.json")):
    rows += json.load(open(f))
print("total rows:", len(rows))
pts = collections.Counter()
for r in rows:
    loc = r["location_1"]
    pts[(round(float(loc["latitude"]), 5), round(float(loc["longitude"]), 5))] += 1
top = pts.most_common(5)
print("most common coordinates (geocode pile-ups):", top)
print("share at top-20 coordinates:", round(sum(c for _, c in pts.most_common(20)) / len(rows), 3))
# businesses with no physical storefront clues
mail_same = sum(1 for r in rows if r.get("mailing_address") and r.get("mailing_address") == r.get("street_address"))
print("mailing == street address:", mail_same)
food = [r for r in rows if (r.get("naics") or "").startswith("722")]
print("food service (NAICS 722):", len(food), collections.Counter(r.get("primary_naics_description") for r in food).most_common(6))
retail = [r for r in rows if (r.get("naics") or "")[:2] in ("44", "45")]
print("retail (NAICS 44-45):", len(retail))
nonaics = sum(1 for r in rows if not r.get("naics"))
print("no NAICS code:", nonaics)
# inner USC core box
core = [r for r in rows if 33.995 < float(r["location_1"]["latitude"]) < 34.045 and -118.315 < float(r["location_1"]["longitude"]) < -118.255]
print("inside USC core (6x6 km):", len(core), "| food:", sum(1 for r in core if (r.get('naics') or '').startswith('722')))
years = collections.Counter((r.get("location_start_date") or "")[:4] for r in rows)
print("start years, recent:", sorted(((y, c) for y, c in years.items() if y >= "2020"))[-7:])
