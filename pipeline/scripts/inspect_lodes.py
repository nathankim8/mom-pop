import pandas as pd, sys
wac = pd.read_csv(sys.argv[1], dtype={"w_geocode": str})
xw = pd.read_csv(sys.argv[2], dtype={"tabblk2020": str}, usecols=["tabblk2020", "blklatdd", "blklondd", "ctyname"])
print("WAC blocks (CA):", len(wac), "| total jobs:", int(wac.C000.sum()))
print("columns sample:", list(wac.columns[:12]), "... CNS07=retail, CNS18=accommodation & food, CNS15=education")
df = wac.merge(xw, left_on="w_geocode", right_on="tabblk2020")
core = df[(df.blklatdd.between(33.995, 34.045)) & (df.blklondd.between(-118.315, -118.255))]
print("blocks with jobs in USC core:", len(core), "| jobs:", int(core.C000.sum()),
      "| education jobs:", int(core.CNS15.sum()), "| food & lodging jobs:", int(core.CNS18.sum()), "| retail:", int(core.CNS07.sum()))
print("top 5 job blocks:")
print(core.nlargest(5, "C000")[["w_geocode", "blklatdd", "blklondd", "C000", "CNS15"]].to_string(index=False))
