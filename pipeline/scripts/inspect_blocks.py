"""Read 2020 Census block population/housing + internal points from the TIGER DBF (stdlib only)."""
import struct, sys, csv
def read_dbf(path, keep):
    with open(path, "rb") as f:
        _, _, _, _, n, hlen, rlen = struct.unpack("<BBBBIHH20x", f.read(32))
        fields = []
        while True:
            b = f.read(32)
            if b[0] == 0x0D: break
            fields.append((b[:11].split(b"\0")[0].decode(), b[16]))
        f.seek(hlen)
        print("fields:", [x for x, _ in fields])
        for _ in range(n):
            rec = f.read(rlen)
            if rec[0:1] == b"*": continue
            pos, out = 1, {}
            for name, ln in fields:
                if name in keep: out[name] = rec[pos:pos + ln].decode("latin-1").strip()
                pos += ln
            yield out
keep = {"GEOID20", "POP20", "HOUSING20", "INTPTLAT20", "INTPTLON20", "COUNTYFP20"}
rows = [r for r in read_dbf(sys.argv[1], keep) if r["COUNTYFP20"] == "037"]
with open(sys.argv[2], "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["GEOID20", "lat", "lon", "pop", "housing"])
    w.writeheader()
    for r in rows:
        w.writerow({"GEOID20": r["GEOID20"], "lat": float(r["INTPTLAT20"]), "lon": float(r["INTPTLON20"]), "pop": int(r["POP20"]), "housing": int(r["HOUSING20"])})
print("LA County blocks:", len(rows), "| population:", sum(int(r["POP20"]) for r in rows))
core = [r for r in rows if 33.995 < float(r["INTPTLAT20"]) < 34.045 and -118.315 < float(r["INTPTLON20"]) < -118.255]
print("USC core blocks:", len(core), "| population:", sum(int(r["POP20"]) for r in core), "| housing units:", sum(int(r["HOUSING20"]) for r in core))
