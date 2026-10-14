"""
Stage 2b — pedestrian activity models + validation against LADOT counts.

Target: LADOT weekday pedestrian count (people counted on the segment, 7–10 AM + 3–6 PM = 6 h total),
combined across available years as a geometric mean. Counts are never invented, resampled or imputed.

Models (all evaluated with cross-validation — a site's own count is never used to predict it):
  null       predict the average count for every site
  index      equal-weight index of the 6 features (z-scores computed on the grid, NOT on the counts);
             only a 2-parameter scale (slope/intercept) is fitted, inside the CV loop
  single:*   one feature at a time, log-log regression
  ridge      ridge regression on all 6 log features
  forest     random forest (to check whether "more advanced ML" helps with n = 22)

Usage: python3 -I scripts/model_validate.py <pipeline dir>
"""
import itertools, json, math, sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.cluster import AgglomerativeClustering
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression, RidgeCV

ROOT = Path(sys.argv[1])
OUT = ROOT / "out"
rng = np.random.default_rng(0)

FEATURES = ["osm_food_400", "biz_storefront_400", "jobs_800", "pop_800", "intersections_400", "transit_deps_400"]
LABEL = {
    "osm_food_400": "Food places within 400 m (OSM)",
    "biz_storefront_400": "Storefront businesses within 400 m (LA City)",
    "jobs_800": "Jobs within 800 m (LODES 2023)",
    "pop_800": "Residents within 800 m (Census 2020)",
    "intersections_400": "Street intersections within 400 m (OSM)",
    "transit_deps_400": "Weekday transit departures within 400 m (Metro GTFS)",
}

sites = pd.read_csv(OUT / "count_sites.csv")
grid = pd.read_csv(OUT / "grid_features.csv")
YEARS = ["2019", "2021", "2023", "2025"]


def logf(df):
    return np.log1p(df[FEATURES].astype(float))


# Standardise with the GRID distribution (the area we will map), so the index uses no count information.
mu, sd = logf(grid).mean(), logf(grid).std()
Zs, Zg = (logf(sites) - mu) / sd, (logf(grid) - mu) / sd
sites["index_raw"] = Zs.mean(axis=1)
grid["index_raw"] = Zg.mean(axis=1)


def target(row, years, kind="wkday"):
    v = [row[f"{kind}_{y}"] for y in years if pd.notna(row[f"{kind}_{y}"]) and row[f"{kind}_{y}"] > 0]
    return math.exp(np.mean(np.log(v))) if v else np.nan


sites["y_all"] = sites.apply(lambda r: target(r, YEARS), axis=1)
sites["y_no2021"] = sites.apply(lambda r: target(r, ["2019", "2023", "2025"]), axis=1)
sites["y_weekend"] = sites.apply(lambda r: target(r, YEARS, "wkend"), axis=1)
sites["n_years"] = sites[[f"wkday_{y}" for y in YEARS]].notna().sum(axis=1)

# Spatial groups for blocked CV: sites closer than ~1.5 km are held out together (stops DTLA neighbours leaking).
xy = np.column_stack([sites.lon * 92_300, sites.lat * 110_600])
sites["group"] = AgglomerativeClustering(n_clusters=None, distance_threshold=1500, linkage="single").fit_predict(xy)


# ------------------------------------------------------------------ metrics
def metrics(obs, pred):
    obs, pred = np.asarray(obs, float), np.asarray(pred, float)
    lo, lp = np.log(obs), np.log(pred)
    rho = spearmanr(obs, pred).statistic
    pairs = list(itertools.combinations(range(len(obs)), 2))
    conc = np.mean([np.sign(obs[i] - obs[j]) == np.sign(pred[i] - pred[j]) for i, j in pairs])
    # High vs low: above / below the median observed count.
    hi_obs, hi_pred = obs > np.median(obs), pred > np.median(pred)
    # Top vs bottom third: of sites truly in the top third, how many are predicted in the top third (and bottom).
    t_obs = pd.qcut(obs, 3, labels=False)
    t_pred = pd.qcut(pred, 3, labels=False, duplicates="drop") if len(set(pred)) > 3 else np.ones_like(t_obs)
    extreme = t_obs != 1
    rmse = float(np.sqrt(np.mean((lo - lp) ** 2)))
    ss_tot = np.sum((lo - lo.mean()) ** 2)
    return {
        "spearman": float(rho) if not np.isnan(rho) else 0.0,
        "pair_concordance": float(conc),
        "median_split_accuracy": float(np.mean(hi_obs == hi_pred)),
        "extreme_tercile_accuracy": float(np.mean(t_obs[extreme] == t_pred[extreme])),
        "log_rmse": rmse,
        "typical_factor": float(math.exp(rmse)),
        "median_abs_pct_error": float(np.median(np.abs(pred - obs) / obs) * 100),
        "mae_count": float(np.mean(np.abs(pred - obs))),
        "r2_log": float(1 - np.sum((lo - lp) ** 2) / ss_tot),
    }


def boot_ci(obs, pred, key, n=2000):
    obs, pred, vals = np.asarray(obs), np.asarray(pred), []
    for _ in range(n):
        i = rng.integers(0, len(obs), len(obs))
        if len(set(obs[i])) > 3:
            vals.append(metrics(obs[i], pred[i])[key])
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


def perm_p(obs, pred, n=5000):
    r0 = spearmanr(obs, pred).statistic
    return float(np.mean([spearmanr(rng.permutation(obs), pred).statistic >= r0 for _ in range(n)]))


# ------------------------------------------------------------------ models (fit on train, predict test, log space)
def m_null(Xtr, ytr, Xte):
    return np.full(len(Xte), ytr.mean())


def m_index(Xtr, ytr, Xte):
    idx_tr, idx_te = Xtr.mean(axis=1, keepdims=True), Xte.mean(axis=1, keepdims=True)
    return LinearRegression().fit(idx_tr, ytr).predict(idx_te)


def m_single(k):
    def f(Xtr, ytr, Xte):
        return LinearRegression().fit(Xtr[:, [k]], ytr).predict(Xte[:, [k]])
    return f


def m_ridge(Xtr, ytr, Xte):
    return RidgeCV(alphas=np.logspace(-2, 3, 30)).fit(Xtr, ytr).predict(Xte)


def m_forest(Xtr, ytr, Xte):
    return RandomForestRegressor(n_estimators=500, min_samples_leaf=3, random_state=0).fit(Xtr, ytr).predict(Xte)


MODELS = {"null": m_null, "index": m_index, "ridge": m_ridge, "forest": m_forest}
MODELS.update({f"single:{f}": m_single(k) for k, f in enumerate(FEATURES)})


def cv_predict(model, X, y, groups):
    pred = np.empty(len(y))
    for g in np.unique(groups):
        te = groups == g
        pred[te] = model(X[~te], y[~te], X[te])
    return np.exp(pred)


def evaluate(df, ycol, label):
    d = df[df[ycol].notna()].reset_index(drop=True)
    X, y = Zs.loc[df[ycol].notna()].values, np.log(d[ycol].values)
    res = {"n_sites": int(len(d)), "schemes": {}}
    for scheme, groups in [("leave_one_out", np.arange(len(d))), ("spatial_blocks", d["group"].values)]:
        out = {}
        for name, m in MODELS.items():
            p = cv_predict(m, X, y, groups)
            out[name] = metrics(d[ycol], p)
            if scheme == "leave_one_out" and name in ("index", "ridge", "forest", "null"):
                out[name]["spearman_ci95"] = boot_ci(d[ycol].values, p, "spearman")
                if name != "null":
                    out[name]["spearman_perm_p"] = perm_p(d[ycol].values, p)
            if scheme == "leave_one_out" and name in ("index", "ridge"):
                d[f"pred_{name}"] = p
        res["schemes"][scheme] = out
    # Uncalibrated index (no count information at all): ranking metrics only.
    res["index_uncalibrated_spearman"] = float(spearmanr(d[ycol], d["index_raw"]).statistic)
    res["index_uncalibrated_perm_p"] = perm_p(d[ycol].values, d["index_raw"].values)
    print(f"\n=== {label}: n = {len(d)}")
    for scheme, out in res["schemes"].items():
        print(f"  [{scheme}]")
        for name, m in out.items():
            print(f"    {name:32} rho={m['spearman']:+.2f}  pairs={m['pair_concordance']:.2f}  "
                  f"hi/lo={m['median_split_accuracy']:.2f}  factor×{m['typical_factor']:.2f}  "
                  f"MdAPE={m['median_abs_pct_error']:.0f}%  R²log={m['r2_log']:+.2f}")
    print(f"  uncalibrated index rho = {res['index_uncalibrated_spearman']:+.2f} (perm p = {res['index_uncalibrated_perm_p']:.3f})")
    return res, d


report = {"features": FEATURES, "feature_labels": LABEL}

# ------------------------------------------------------------------ 1. how repeatable are the counts themselves?
pairs = []
for _, r in sites.iterrows():
    v = {y: r[f"wkday_{y}"] for y in YEARS if pd.notna(r[f"wkday_{y}"])}
    for a, b in itertools.combinations(sorted(v), 2):
        pairs.append({"segment": r.segment, "a": a, "b": b, "va": v[a], "vb": v[b]})
pairs = pd.DataFrame(pairs)
pairs["abs_log_ratio"] = np.abs(np.log(pairs.va / pairs.vb))
# Leave-one-year-out: predict a site-year from the geometric mean of the same site's other years.
loyo = []
for _, r in sites.iterrows():
    v = {y: r[f"wkday_{y}"] for y in YEARS if pd.notna(r[f"wkday_{y}"])}
    for y in v:
        others = [v[o] for o in v if o != y]
        if others:
            loyo.append((v[y], math.exp(np.mean(np.log(others)))))
loyo = np.array(loyo)
same_site = metrics(loyo[:, 0], loyo[:, 1])
year_rho = {}
for a, b in itertools.combinations(YEARS, 2):
    m = sites[f"wkday_{a}"].notna() & sites[f"wkday_{b}"].notna()
    if m.sum() >= 5:
        year_rho[f"{a}-{b}"] = {"n": int(m.sum()), "spearman": float(spearmanr(sites.loc[m, f"wkday_{a}"], sites.loc[m, f"wkday_{b}"]).statistic)}
report["repeatability"] = {
    "n_site_year_pairs": int(len(pairs)),
    "median_abs_pct_diff_between_years": float(np.median(np.exp(pairs.abs_log_ratio) - 1) * 100),
    "same_site_other_years_as_prediction": same_site,
    "spearman_between_years": year_rho,
}
print("=== count repeatability (same site, different years)")
print(f"  site-year pairs: {len(pairs)}; median change between years: "
      f"{report['repeatability']['median_abs_pct_diff_between_years']:.0f}%")
print(f"  predicting a year from the same site's other years: factor×{same_site['typical_factor']:.2f}, "
      f"MdAPE={same_site['median_abs_pct_error']:.0f}%, rho={same_site['spearman']:.2f}")
print("  rank correlation between years:", {k: round(v["spearman"], 2) for k, v in year_rho.items()})

# ------------------------------------------------------------------ 2. models
report["primary"], primary = evaluate(sites, "y_all", "PRIMARY: weekday 6-h count, geometric mean of all years")
report["sens_no2021"], _ = evaluate(sites, "y_no2021", "SENSITIVITY: excluding 2021 (COVID-era) counts")
ok = sites[sites.osm_biz_coverage_ok == 1].copy()
Zs_backup = Zs
Zs = Zs_backup.loc[ok.index].reset_index(drop=True)
report["sens_full_coverage"], _ = evaluate(ok.reset_index(drop=True), "y_all", "SENSITIVITY: only sites with complete OSM/business buffers")
Zs = Zs_backup
report["weekend"], _ = evaluate(sites, "y_weekend", "SECONDARY: weekend 2-h count (11 AM–1 PM)")

# ------------------------------------------------------------------ 3. final fits on all sites (for transparency + the map)
X, y = Zs.values, np.log(sites.y_all.values)
ridge = RidgeCV(alphas=np.logspace(-2, 3, 30)).fit(X, y)
lin_idx = LinearRegression().fit(sites[["index_raw"]].values, y)
report["ridge_fit"] = {"alpha": float(ridge.alpha_), "intercept": float(ridge.intercept_),
                       "coef_per_sd": dict(zip(FEATURES, map(float, ridge.coef_)))}
report["index_fit"] = {"slope": float(lin_idx.coef_[0]), "intercept": float(lin_idx.intercept_)}
report["feature_spearman_with_counts"] = {f: float(spearmanr(sites[f], sites.y_all).statistic) for f in FEATURES}
report["feature_grid_mean_sd_log1p"] = {f: [float(mu[f]), float(sd[f])] for f in FEATURES}
report["grid_index_percentiles_at_sites"] = {}
print("\nridge coefficients (log-count change per 1 SD of log feature):",
      {k: round(v, 2) for k, v in report["ridge_fit"]["coef_per_sd"].items()}, "alpha", round(ridge.alpha_, 2))
print("feature-by-feature rank correlation with counts:",
      {k: round(v, 2) for k, v in report["feature_spearman_with_counts"].items()})

# Coverage of the count sites inside the grid's feature space (how much of the map is extrapolation).
lo_, hi_ = Zs.min(), Zs.max()
inside = ((Zg >= lo_) & (Zg <= hi_)).all(axis=1)
report["grid_cells_within_site_feature_range_pct"] = float(inside.mean() * 100)
report["grid_cells_on_major_street_pct"] = float(grid.on_major_street.mean() * 100)
report["count_sites_on_major_street"] = int(sites.on_major_street.sum())
print(f"grid cells whose features are all within the range seen at count sites: {inside.mean() * 100:.0f}%")

grid["index_pct"] = grid.index_raw.rank(pct=True) * 100
grid["pred_weekday_6h"] = np.exp(lin_idx.predict(grid[["index_raw"]].values))
grid["within_validated_range"] = inside.astype(int)
grid.to_csv(OUT / "grid_predictions.csv", index=False)
sites["index_pct_in_grid"] = [float((grid.index_raw < v).mean() * 100) for v in sites.index_raw]
cols = ["segment", "lat", "lon", "group", "n_years", "osm_biz_coverage_ok", "both_ends_found", "on_major_street",
        *[f"wkday_{y}" for y in YEARS], *[f"wkend_{y}" for y in YEARS], "y_all", "y_no2021", "y_weekend",
        "index_raw", "index_pct_in_grid", *FEATURES]
sites_out = sites[cols].merge(primary[["segment", "pred_index", "pred_ridge"]], on="segment")
sites_out.to_csv(OUT / "site_validation.csv", index=False)
json.dump(report, open(OUT / "validation_report.json", "w"), indent=1)
print("\nwrote out/site_validation.csv, out/grid_predictions.csv, out/validation_report.json")
