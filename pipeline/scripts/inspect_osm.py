import json, sys, collections
d = json.load(open(sys.argv[1]))
print("osm timestamp:", d.get("osm3s", {}).get("timestamp_osm_base"), "| copyright:", d.get("osm3s", {}).get("copyright", "")[:80])
els = d["elements"]
c = collections.Counter(e["type"] for e in els)
print("elements:", dict(c))
hw = collections.Counter(e["tags"]["highway"] for e in els if e["type"] == "way" and "tags" in e and "highway" in e["tags"])
print("highway ways:", hw.most_common(14))
am = collections.Counter(e["tags"]["amenity"] for e in els if "tags" in e and "amenity" in e["tags"])
print("amenities (top):", am.most_common(15))
sh = sum(1 for e in els if "tags" in e and "shop" in e["tags"])
print("shops:", sh)
food = [e for e in els if "tags" in e and e["tags"].get("amenity") in ("restaurant", "fast_food", "cafe", "food_court", "ice_cream")]
print("food places:", len(food), "| with name:", sum(1 for e in food if "name" in e["tags"]))
pt = collections.Counter(e["tags"].get("public_transport") for e in els if "tags" in e and "public_transport" in e["tags"])
print("public_transport:", dict(pt))
