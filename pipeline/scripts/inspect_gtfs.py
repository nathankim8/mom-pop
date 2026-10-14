import zipfile, csv, io, sys, collections
def read(z, name):
    with z.open(name) as f:
        return list(csv.DictReader(io.TextIOWrapper(f, "utf-8-sig")))
for path in sys.argv[1:]:
    z = zipfile.ZipFile(path)
    print("==", path, "files:", [n for n in z.namelist()][:12])
    feed = read(z, "feed_info.txt") if "feed_info.txt" in z.namelist() else []
    if feed: print("feed_info:", {k: feed[0][k] for k in feed[0] if "date" in k or "version" in k})
    cal = read(z, "calendar.txt") if "calendar.txt" in z.namelist() else []
    if cal: print("calendar range:", min(r["start_date"] for r in cal), "->", max(r["end_date"] for r in cal), "| service ids:", len(cal))
    stops = read(z, "stops.txt")
    box = {s["stop_id"]: s for s in stops if s.get("stop_lat") and 33.995 < float(s["stop_lat"]) < 34.045 and -118.315 < float(s["stop_lon"]) < -118.255}
    print("stops total:", len(stops), "| in USC core:", len(box))
    # departures per stop from stop_times (stream to save memory)
    cnt = collections.Counter(); hours = collections.Counter()
    with z.open("stop_times.txt") as f:
        for r in csv.DictReader(io.TextIOWrapper(f, "utf-8-sig")):
            if r["stop_id"] in box:
                cnt[r["stop_id"]] += 1
                h = r.get("departure_time") or ""
                if h: hours[int(h.split(":")[0]) % 24] += 1
    print("stop_times rows at core stops:", sum(cnt.values()))
    top = cnt.most_common(5)
    print("busiest core stops:", [(box[s]["stop_name"], c) for s, c in top])
    print("departures by hour (all service ids):", [hours[h] for h in range(24)])
