"""Figures for VALIDATION.md. Usage: python3 -I scripts/plot_validation.py <pipeline dir>"""
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

OUT = Path(sys.argv[1]) / "out"
s = pd.read_csv(OUT / "site_validation.csv")
g = pd.read_csv(OUT / "grid_predictions.csv")
s["dtla"] = (s.lat > 34.04) & (s.lon > -118.265)

fig, ax = plt.subplots(1, 2, figsize=(13, 5.6))

# 1. Cross-validated prediction vs observation (log-log).
a = ax[0]
for dt, c, lab in [(True, "#6b6b6b", "Downtown (10 sites)"), (False, "#1f7a4d", "Outside downtown (12 sites)")]:
    d = s[s.dtla == dt]
    a.scatter(d.pred_index, d.y_all, s=46, c=c, label=lab, edgecolor="white", zorder=3)
    for _, r in d.iterrows():
        a.annotate(r.segment.split(" bw ")[0], (r.pred_index, r.y_all), fontsize=7, xytext=(4, 2),
                   textcoords="offset points", color=c)
lim = [30, 12000]
a.plot(lim, lim, color="black", lw=0.8)
for k in (2, 0.5):
    a.plot(lim, [v * k for v in lim], color="black", lw=0.5, ls=":")
a.set(xscale="log", yscale="log", xlim=lim, ylim=lim,
      xlabel="Predicted (index model, leave-one-out)", ylabel="Observed LADOT weekday count (6 h)",
      title="Predicted vs observed — dotted lines = 2× off")
a.legend(loc="upper left", fontsize=8, frameon=False)

# 2. Map of the uncalibrated index (percentile) with observed counts.
a = ax[1]
piv = g.pivot_table(index="lat", columns="lon", values="index_pct")
a.imshow(piv.values, origin="lower", cmap="Greens", alpha=0.85,
         extent=[piv.columns.min(), piv.columns.max(), piv.index.min(), piv.index.max()], aspect=1 / np.cos(np.radians(34.02)))
sc = a.scatter(s.lon, s.lat, c=np.log10(s.y_all), cmap="magma_r", s=60, edgecolor="black", lw=0.6, zorder=3)
cb = fig.colorbar(sc, ax=a, shrink=0.75)
cb.set_ticks([2, 3, np.log10(5000)]); cb.set_ticklabels(["100", "1,000", "5,000"]); cb.set_label("Observed weekday count")
a.plot([-118.315, -118.255, -118.255, -118.315, -118.315], [33.995, 33.995, 34.045, 34.045, 33.995], color="#1f4fb5", lw=1)
a.text(-118.314, 33.996, "USC core study box", color="#1f4fb5", fontsize=8)
a.set(title="Modelled index (green = higher percentile) + LADOT sites", xticks=[], yticks=[])
fig.tight_layout()
fig.savefig(OUT / "validation.png", dpi=130)
print("wrote", OUT / "validation.png")
