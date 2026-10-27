# Academic and competition evidence: forecasting methods for short, noisy daily series with weekly seasonality (restaurant sales / covers)

Context: notes for choosing a forecasting method for a 9-site restaurant group with 6 weeks to a few years of daily history per site, forecasting 1–14 days ahead. Compiled 27 Oct 2026. Where a figure could not be verified against a primary source in this session, it is listed under Gaps rather than stated as fact.

## 1. M4 and M5 competition findings (what won, simple vs complex, daily and retail data)

### Takeaway
M4 (2018, 100,000 mostly low-frequency series) showed that **combinations win** and that pure ML did badly on its own, but the winning margins over simple benchmarks were small (under 10%). M5 (2020, 42,840 hierarchical Walmart daily unit-sales series) was the first M-competition won by pure ML: **equal-weighted averages of LightGBM models trained across many series ("cross-learning") with calendar/price/event features**, beating the best statistical benchmark (bottom-up exponential smoothing) by 22.4%. Crucially for a 9-site group, M5 gains were large at aggregated levels (store, state) and **almost vanished at the most granular levels**.

### Cited Findings
**M5 (Makridakis, Spiliotis & Assimakopoulos, "M5 accuracy competition: Results, findings, and conclusions", IJF 38(4), 2022)**
- Task: forecast 42,840 hierarchical Walmart unit-sales series (30,490 at the lowest product-store level), daily, 28 days ahead. — [IDEAS/RePEc record](https://ideas.repec.org/a/eee/intfor/v38y2022i4p1346-1364.html); [paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Of the participating teams, 48.4% beat Naive, only **35.8% beat seasonal naive (sNaive)**, and only **7.5% (415 teams) beat the best benchmark, ES_bu** (bottom-up exponential smoothing). The majority of teams were more than 13% worse than ES_bu. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- All top 50 submissions improved on ES_bu by more than 14% (WRMSSE); the top five by more than 20%; **the winner by 22.4%**. By contrast, the winners of M3 and M4 improved on their benchmarks by less than 10%. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Gains depended heavily on aggregation: the top 50 averaged **40% improvement over ES_bu at level 1 (total), about 23% at levels 5–7, and only about 3% at levels 10–12** (product, product-state, product-store). "The gains of the top-performing methods mainly refer to the top and middle parts of the hierarchies." — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Winner (YJ_STU, a South Korean undergraduate): an equal-weighted arithmetic mean of LightGBM models trained per store (10), per store-category (30) and per store-department (70), each in recursive and non-recursive variants (220 models; each series averaged over 6), Tweedie loss, tuned on the last four 28-day windows using both mean and standard deviation of errors to pick a robust ensemble. 2nd place: LightGBM ensemble adjusted with multipliers derived from N-BEATS at higher aggregation levels. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- "Horses for courses": the winner was best at only 4 of 12 levels; the runner-up was 1st at levels 2, 4, 5, 6 but almost worst (48th–49th of 50) at levels 10–12. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Cross-learning: "all top 50 performing methods in M5 utilized 'cross-learning'", which the authors note also mitigates "difficulties related to limited historical observations". — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Exogenous variables matter even for statistical models: ESX (exponential smoothing with promotion/event regressors) was 6% better than ES_td without them; ARIMAX was 13% more accurate than ARIMA_td. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Cross-validation design mattered: top teams used at least the last four 28-day windows; many teams failed to select their own best submission. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Intermittent/retail benchmark detail: sNaive was on average 11.5% more accurate than Croston (CRO), with gains of 37.8% at the top level falling to 9.7% at level 9, and **sNaive worse than Croston by 13.0%, 20.2% and 27.0% at levels 10–12** (intermittent product-store series). Exponential smoothing benchmarks improved on sNaive by about 28% overall, 54% at the top level, falling to about 1.1% at the product-store level. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- LightGBM described as "the standard method of choice in Kaggle's recent forecasting competitions", including the Recruit Restaurant winner. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)

**M4 (Makridakis, Spiliotis & Assimakopoulos, IJF 2018/2020)**
- Winner: Smyl's hybrid ES-RNN; Theta was the best single benchmark; the 2nd-place method was a combination of seven statistical methods and one ML method weighted by an ML meta-learner. "The combination of methods was the king of the M4." — [Fast ES-RNN, arXiv 1907.03329](https://arxiv.org/pdf/1907.03329); [M4 paper record](https://pure.unic.ac.cy/en/publications/the-m4-competition-results-findings-conclusion-and-way-forward/)
- Benchmark sMAPE (all frequencies): Single ES 13.09%, Holt 13.77%, Damped 12.66%, Comb (SES+Holt+Damped) 12.55%. ES-RNN averaged 11.76 sMAPE vs a benchmark average of 12.95 (≈9.2% better). — [Fast ES-RNN, arXiv 1907.03329](https://arxiv.org/pdf/1907.03329)
- M4 had only 4,227 daily series (of 100,000); horizon 14 for daily. Practitioners criticised M4 for under-representing daily/weekly series and lacking exogenous variables and hierarchies. — [Fast ES-RNN, arXiv 1907.03329](https://arxiv.org/pdf/1907.03329); [Bojer & Meldgaard, arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- SCUM (Petropoulos & Svetunkov, IJF 36(1), 2020): median of ETS, CES, auto-ARIMA and Dynamic Optimised Theta forecasts and intervals; ranked 6th in M4 for point forecasts (small gap to 2nd) and for intervals, and 2nd on weekly data. — [Bath research portal](https://researchportal.bath.ac.uk/en/publications/a-simple-combination-of-univariate-models/)

### Inferences
- M5's ML win came from (a) thousands of related, aligned series to cross-learn from, and (b) rich exogenous data (prices, events, promotions). A 9-site group has only 9 series of site-level sales (perhaps a few more if split by lunch/dinner or channel), so the M5 advantage of global LightGBM is likely much smaller here; the closest analogue in M5 is the store level (level 3, 10 series), where gains over ES were material, but that relied on aggregating thousands of item series beneath.
- Site-level daily sales are an aggregated, non-intermittent series, so Croston-type intermittent methods are irrelevant; ETS/seasonal methods and sNaive are the right baselines.
- The "most teams lost to sNaive/ES" result is a strong warning: an untuned complex model is more likely to be worse than a seasonal naive than better.

### Gaps
- M4 daily-specific sMAPE/MASE by method (Naive vs Theta vs ES-RNN on the 4,227 daily series) was not retrieved; it is in the M4 IJF paper tables. My recollection (unverified) is that on M4 daily the naive method was very hard to beat and differences were tiny.
- M5 store-level (level 3) numeric WRMSSE by team was not extracted.

## 2. Kaggle Recruit Restaurant Visitor Forecasting and other restaurant forecasting papers

### Takeaway
The only large public restaurant benchmark (Recruit, 821 Japanese restaurants, 15 months of daily visitors, 1–39 days ahead) was won by an **average of LightGBM, XGBoost and feed-forward neural nets** with rolling-statistic and **reservation** features, but the winner was only about **27% better than seasonal naive**, and the 50th place only 25% better: most of the available gain is reachable with a reasonable model. Domain tricks (treating holidays as Saturdays) gave big boosts. Restaurant academic papers are small-sample and mostly favour gradient boosting with weather/calendar features; Prophet and N-BEATS tend to underperform.

### Cited Findings
- Recruit set-up: forecast daily visits per restaurant, horizon 1–39 days, 15 months of data for 821 restaurants, plus metadata, holidays and advance reservations. — [Bojer & Meldgaard, "Kaggle forecasting competitions: An overlooked learning opportunity", IJF 2021, arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- Winner: a team of four averaging LightGBM, XGBoost and feed-forward NN models, using rolling statistics and lagged reservations; one model per horizon (the 5th place needed 42 models in total). — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- **Relative error vs seasonal naive: 1st place 0.73, 50th place 0.75** (i.e. 27% and 25% better). For comparison: Rossmann (store-day sales) 1st place 0.26 / 50th 0.29; Walmart Store Sales 0.73/0.89; Corporación Favorita 0.40/0.41. — [arXiv 2009.07701, Table 2](https://arxiv.org/pdf/2009.07701)
- Holiday trick: test period contained Golden Week, with only one earlier holiday period in training; treating holidays as Saturdays and adjacent days as Fridays/Mondays "generally gave a significant performance boost", though the winner did not need it. — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- RNN/CNN approaches placed 21st, 23rd, 25th, about 2% worse than 1st; a **Kalman filter (traditional state-space model) placed 33rd, only 2.4% behind 1st**, "highlighting that more traditional time series models can still be viable with exogenous variables". Authors suggest NNs did worse because the dataset was over 100× smaller than Wikipedia/Favorita. — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- More than 98% of series in the Favorita, Walmart Stormy Weather, Recruit and Rossmann datasets show some intermittency (missing/zero days). — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- Across six Kaggle competitions: "Ensembles won all of the competitions"; global models were used by all winners. — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- Walmart Store Sales (weekly, 45 stores): winner used SVD denoising across stores, then STL + exponential smoothing/ARIMA, combined with seasonal naive and simple models; a single SVD+STL+ETS model would have won alone. Aligning holidays year-to-year was used by all top eight. ML on its own did not do well. — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- Arab & Benitez (Ruhrdot, arXiv 2502.03395, Feb 2025): hourly sales, 14-day horizon, 4 restaurants from different German chains, 2 years of history, with weather and calendar features. Gradient-boosting ML models "consistently achieved the highest performance across all restaurants"; **Chronos-Bolt zero-shot matched ML accuracy in 3 of 4 restaurants**; Prophet underperformed both ML and foundation models; N-BEATS "showed promise but required extensive computational resources and feature engineering". (Numeric MAE/MAPE shown only in figures.) — [arXiv 2502.03395](https://arxiv.org/pdf/2502.03395)
- Lasek, Cercone & Saunders (2016) review: restaurant sales forecasting historically judgement-based; techniques over 20 years grouped into seven categories including hybrids; noted no earlier review existed. — [EUDL](https://eudl.eu/doi/10.1007/978-3-319-33681-7_40)
- Holmberg (2017, as summarised secondarily): XGBoost beat a neural network on restaurant sales; adding weather improved performance by roughly 2–4 percentage points. — [secondary summary via academia.edu](https://www.academia.edu/86520521/Application_of_Sales_Forecasting_Model_Based_on_Machine_Learning_Algorithms) (primary thesis not retrieved)
- A study of restaurant customer counts found XGBoost best, with the most influential features being previous-day count, exponential-smoothing outputs, holidays, day of week and weather. — [AIMS Applied Computing and Intelligence 2025](https://www.aimspress.com/aimspress-data/aci/2025/2/PDF/aci-05-02-011.pdf)
- Counter-evidence: a Bangladesh restaurant demand study found simple exponential smoothing and Croston outperformed XGBoost. — [PMC12136425](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12136425/)
- Schmidt, Kabir & Hoque (2022, MAKE 4(1)) benchmark many ML and RNN models on a mid-sized restaurant's sales. — [MDPI](https://mdpi.com/2504-4990/4/1/6) (full text blocked; results not extracted)

### Inferences
- Reservations are the restaurant-specific "killer feature" (Recruit's distinctive input). If the group takes bookings (OpenTable/ResDiary/SevenRooms), on-the-books covers for the next 1–14 days are likely worth more than any choice of algorithm.
- Holiday handling via domain rules (bank holidays treated like Saturdays/Sundays, adjacent-day effects) is cheap and has documented value.
- With 9 sites, a "global" GBM pooled across sites (site ID as a feature) is the restaurant analogue of the Recruit/M5 winners, but expect gains over a tuned seasonal baseline in the order of 0–25%, not the 60–74% seen in Rossmann/Favorita.

### Gaps
- Recruit winning RMSLE score and the RMSLE of a seasonal naive baseline were not retrieved (only the ratio 0.73).
- Holmberg & Halldén primary thesis and its MAPE figures not found.
- Schmidt et al. 2022 numeric results not retrieved (403).

## 3. Foundation models zero-shot vs statistical baselines

### Takeaway
The evidence is **contested and benchmark-dependent**. Model authors' benchmarks (Chronos, fev-bench) show foundation models (Chronos-2, TimesFM-2.5, Chronos-Bolt) beating seasonal naive and AutoETS by 25–50% skill on aggregate. Independent/critical evaluations (Nixtla; an Amazon NeurIPS 2025 workshop paper with leakage controls) find well-tuned statistical ensembles (SCUM/SiCoUM, ARIMA) **beat foundation models by 8–20%** on classic competition data. On a real restaurant dataset, Chronos-Bolt matched gradient boosting in 3 of 4 sites. Test-set leakage into pre-training is a recognised problem.

### Cited Findings
- Chronos (Ansari et al., TMLR Oct 2024): on Benchmark II (27 datasets unseen in training), Chronos "significantly outperform[s] standalone local statistical models"; ranks 2nd–4th on aggregate relative WQL; Chronos-T5 Large 2nd on MASE, "surpassing ... the strong SCUM ensemble". Scores are normalised to Seasonal Naive and aggregated by geometric mean. Authors note Seasonal Naive "performs competitively against other local models" on Benchmark I because the datasets are strongly seasonal. — [arXiv 2403.07815](https://arxiv.org/pdf/2403.07815)
- Per a secondary account of the Chronos paper, SCUM beat the smaller Chronos variants (small, mini) on aggregate relative MASE; Chronos beat SCUM only by "a slim margin" on WQL. — [Baron & Karpinski, arXiv 2501.10216](https://arxiv.org/pdf/2501.10216)
- Nixtla's comparison: on monthly, quarterly and yearly datasets, **SCUM beat Chronos by about 10% on CRPS, MASE and sMAPE, using about 20% of the wall time**. A Chronos author rebutted that the dataset selection favoured short, low-frequency series which Chronos rarely saw in training. — [arXiv 2501.10216](https://arxiv.org/pdf/2501.10216)
- Olivares, Wolff et al. (Amazon, NeurIPS 2025 workshop, arXiv 2509.19465v3, Nov 2025): pre-training only on proprietary and synthetic data to avoid leakage, evaluated on 15 large competition datasets: "statistical models and their ensembles consistently outperform existing FFMs by more than 8.2% in sCRPS, and by more than 20% MASE"; ARIMA and SiCoUM (CES+ETS+Theta+ARIMA) gave the lowest error on 11 of 15 datasets; neural forecasters "never obtain the minimum MASE in any dataset or frequency". They argue statistical baselines are often under-reported in FFM papers. — [arXiv 2509.19465](https://arxiv.org/pdf/2509.19465)
  - Same paper reports M4-Daily MASE 0.963–0.977 for ARIMA/Theta/ETS vs 3.000–3.330 for the best neural forecasts. Note: the size of this gap is surprising and may reflect a scaling difference in their table; treat with caution. — [arXiv 2509.19465](https://arxiv.org/pdf/2509.19465)
  - Caveat: this paper evaluates their own reimplemented CFTL models (e.g. "ChronosB-P"), not necessarily the public checkpoints.
- fev-bench (AutoGluon/Amazon, arXiv 2509.26468, 2025): Chronos-2 has the highest win rate and skill, followed by TiRex and TimesFM-2.5; Chronos-Bolt ranks lower. Skill vs Seasonal Naive (MASE): Chronos-2 35.5, TimesFM-2.5 30.3, Chronos-Bolt 26.5, **AutoETS 2.3**, Seasonal Naive 0.0. On WQL: Chronos-2 51.5, TimesFM-2.5 46.8, Chronos-Bolt 43.2, AutoETS −27.0. — [fev-bench arXiv 2509.26468](https://arxiv.org/pdf/2509.26468); [Chronos-2 arXiv 2510.15821](https://arxiv.org/pdf/2510.15821); [fev-bench MASE leaderboard](https://huggingface.co/spaces/autogluon/fev-bench/blob/0d4449c7b5c5e721513a5d74d0104a72c1c9a8fe/tables/leaderboard_MASE.csv)
- GIFT-Eval: MASE normalised by seasonal naive per dataset/frequency/horizon; the leaderboard carries a test-data-leakage flag, and TimesFM and Chronos may have partial leakage with the GIFT-Eval test set. On a non-leaking subset (context ≥512, horizon ≤128), Chronos-Bolt scored 0.788 and TimesFM-2.5 0.691 relative MASE. — [GIFT-Eval HF about.py](https://huggingface.co/spaces/vencortexio/GIFT-Eval/blob/main/src/about.py); [Cisco TSM report arXiv 2511.19841](https://arxiv.org/pdf/2511.19841); [benchmarklist GIFT-Eval](https://benchmarklist.com/benchmarks/gift_eval/)
- Nixtla's "foundation time-series arena": among foundation models TimeGPT-1 ranked first, TimesFM second, Chronos third (with very high inference times), Moirai and Lag-Llama last; **Prophet "consistently ranks lower than all the methods considered"**. (Numbers in an image only; Nixtla is TimeGPT's vendor.) — [Nixtla GitHub](https://github.com/Nixtla/nixtla/tree/main/experiments/foundation-time-series-arena)
- Restaurant case: Chronos-Bolt zero-shot matched gradient-boosting accuracy in 3 of 4 German restaurants (hourly sales, 14 days), without extra regressors. — [arXiv 2502.03395](https://arxiv.org/pdf/2502.03395)
- On NN5 Daily (ATM withdrawals, strong weekly pattern), a conformal-prediction study found a statistical ensemble competitive with Chronos/TimesFM, with Chronos only slightly better on MASE at one horizon. — [arXiv 2507.08858](https://arxiv.org/pdf/2507.08858)
- Chronos vs ARIMA/Prophet on daily bike-share demand: Chronos was better at longer horizons and kept accuracy as context grew, while ARIMA/Prophet degraded with longer context. — [arXiv 2501.10216](https://arxiv.org/pdf/2501.10216)

### Inferences
- For short daily series with strong weekly seasonality, a zero-shot foundation model (Chronos-Bolt / Chronos-2 / TimesFM-2.5) is a credible, low-effort candidate that can produce forecasts from a few weeks of context, but it is not reliably better than a tuned ETS/Theta/ARIMA ensemble. It should be benchmarked against one, not assumed superior.
- Univariate zero-shot models ignore bookings, weather and bank holidays unless the covariate-capable variants (e.g. Chronos-2, ChronosX, TimeGPT with exogenous variables) are used.
- GPU/hosted-API dependency is a practical cost; Chronos-Bolt and TimesFM are lighter than the original Chronos-T5.

### Gaps
- Exact Chronos Benchmark II aggregate relative MASE/WQL values (figure only, not extractable).
- TimesFM paper, Moirai, Lag-Llama and TimeGPT paper numbers on daily data specifically were not retrieved.
- No independent benchmark found specifically on very short (<100 points) daily restaurant series with foundation models.

## 4. Accuracy vs history length; minimum history; cold start

### Takeaway
There is no hard rule: Hyndman & Kostenko say the bare minimum for a seasonal model is roughly the number of parameters plus a cycle or two, but noisy data need far more. With weekly seasonality (m = 7), 6 weeks gives 6 full cycles, enough to estimate a day-of-week profile but not annual seasonality or holiday effects. Cross-learning across sites and zero-shot foundation models are the main academic remedies for short histories.

### Cited Findings
- Hyndman & Kostenko, "Minimum sample size requirements for seasonal forecasting models", Foresight 6 (2007): sets out bare minimum data for seasonal dummy regression, exponential smoothing and ARIMA; achieving the minimum "does not ensure adequate estimates of seasonality"; extra data needed depends on noise; published sample-size tables are "overly simplified". — [IDEAS/RePEc](https://ideas.repec.org/a/for/ijafaa/y2007i6p12-15.html); [Foresight issue 6](https://forecasters.org/product/foresight-issue-6)
- Software minima: SAS Winters methods need at least one full seasonal cycle but "there should be data for several complete seasonal cycles"; SAP seasonal trend models need 2 × season length. — [SAS docs](https://support.sas.com/documentation/cdl/en/etsug/63939/HTML/default/etsug_forecast_sect025.htm); [SAP help](https://help.sap.com/saphelp_dm40/helpdata/en/c5/8f163f6b5baa09e10000000a114084/content.htm)
- Cerqueira, Torgo & Soares, "Machine learning vs statistical methods for time series forecasting: size matters" (arXiv 1909.13316): argues the advantage of statistical methods over ML in earlier studies is linked to small sample sizes, and ML improves as sample size grows. — [arXiv 1909.13316](https://arxiv.org/pdf/1909.13316) (abstract-level; specific crossover point not extracted)
- M5 authors: cross-learning (one model over many series) mitigates "difficulties related to limited historical observations". — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Kaggle benchmarking used a fallback for series absent from training: the mean at the next level of the hierarchy (simple cross-learning). — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- Chronos maintained or improved accuracy with longer context, whereas ARIMA/Prophet degraded with more history (bike-share daily). — [arXiv 2501.10216](https://arxiv.org/pdf/2501.10216)
- Vendor guidance (not peer-reviewed) says at least 12 months of daily item-level data before a forecast is trustworthy. — [Nory blog](https://www.nory.ai/blog/simple-guide-to-accurately-forecasting-restaurant-sales-gcg9c)

### Inferences
- Practical tiering for the group (inference, to be validated by back-testing):
  - **<2 weeks / new site (cold start):** use a scaled profile from comparable sites (group day-of-week shape × the new site's level), or a zero-shot foundation model once 1–2 weeks exist; blend in manager judgement.
  - **2–8 weeks:** seasonal naive (same weekday last week), mean of the last 2–4 same weekdays, or ETS with weekly seasonality; a foundation model is a reasonable alternative.
  - **2 months to 1 year:** ETS/Theta/ARIMA ensemble (SCUM-style median) plus holiday/booking adjustments; pooled GBM across sites becomes viable.
  - **1+ years:** add annual seasonality and year-on-year holiday alignment; pooled GBM with weather, bookings, bank holidays, events.
- ETS with m = 7 has about 7 seasonal states plus 2–3 smoothing/level parameters, so 6 weeks (42 points) is above the bare minimum, but noisy restaurant data mean the profile will be unstable; shrinkage towards the group profile is advisable.

### Gaps
- Exact Hyndman–Kostenko per-model thresholds (paywalled).
- No study found quantifying restaurant forecast error as a function of weeks of history.

## 5. Are combinations/ensembles reliably better?

### Takeaway
Yes, this is the most consistent finding across M3, M4, M5, the Kaggle competitions and foundation-model critiques: simple combinations (median or equal-weighted mean) of a few diverse methods rarely lose much and usually beat the individual components. The SCUM median of ETS/CES/ARIMA/Theta is the standard strong statistical baseline.

### Cited Findings
- M4: "The combination of methods was the king of the M4"; Comb benchmark (12.55% sMAPE) beat each of its components (SES 13.09%, Holt 13.77%, Damped 12.66%). — [arXiv 1907.03329](https://arxiv.org/pdf/1907.03329)
- M5 winner was an **equal-weighted** mean of LightGBM models, chosen partly for stability (low error standard deviation) rather than best mean error. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Kaggle: "Ensembles won all of the competitions" (six competitions, 2014–2018); Recruit winner was a plain average of GBM and NN models. — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- SCUM (median of four statistical models) ranked 6th of M4 with a small gap to 2nd. — [Bath research portal](https://researchportal.bath.ac.uk/en/publications/a-simple-combination-of-univariate-models/)
- SiCoUM/ARIMA beat foundation models by >8.2% sCRPS and >20% MASE across 15 datasets; SiCoUM stays below MASE 1.0 in all but a few yearly series. — [arXiv 2509.19465](https://arxiv.org/pdf/2509.19465)
- SCUM beat Chronos by about 10% on Nixtla's low-frequency selection. — [arXiv 2501.10216](https://arxiv.org/pdf/2501.10216)
- Caveat (horses for courses): in M5, different methods won at different aggregation levels. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)

### Inferences
- A sensible design for the group: median of {seasonal naive (last-4-same-weekdays mean), ETS(weekly), Theta, and optionally a foundation model or pooled GBM}, with a fixed rule for holidays and a booking-based adjustment. Median combinations are robust to one method misbehaving on a short series.

### Gaps
- No restaurant-specific study comparing simple combinations against single methods was found.

## 6. Typical achievable error for daily restaurant sales and covers at site level

### Takeaway
No peer-reviewed source found gives a credible typical site-level daily MAPE/WAPE for restaurants. Competition evidence is expressed relative to seasonal naive (best Recruit models ≈27% lower error than seasonal naive). Vendor claims (3–7% MAPE for "AI", 3.6% for 7shifts) are marketing figures and should not be used as targets without validation.

### Cited Findings
- Recruit Restaurant: 1st place error 0.73 × seasonal naive; 50th place 0.75 × (RMSLE-based). — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- Rossmann (daily store sales, closer to site-level sales than visitor counts): 1st place 0.26 × seasonal naive, i.e. 74% error reduction (aided by promotion and store-closure information). — [arXiv 2009.07701](https://arxiv.org/pdf/2009.07701)
- M5 store-level and above: improvements over ES of about 23–40% for top teams; at granular levels about 3%. — [M5 paper PDF](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Vendor claims: spreadsheets 10–15% MAPE, POS-linked software 7–12%, AI forecasting 3–7% (Nory). — [Nory blog](https://www.nory.ai/blog/simple-guide-to-accurately-forecasting-restaurant-sales-gcg9c)
- 7shifts reports an average daily sales-projection error of 3.61% in 2022 and "below 5%" historically (self-reported; metric definition unclear, possibly aggregated error that lets over- and under-forecasts cancel). — [7shifts KB](https://kb.7shifts.com/hc/en-us/articles/14620377028627)
- Holmberg (2017, secondary): weather features improved restaurant sales forecasts by about 2–4 percentage points. — [academia.edu summary](https://www.academia.edu/86520521/Application_of_Sales_Forecasting_Model_Based_on_Machine_Learning_Algorithms)

### Inferences
- Plan to measure rather than assume: back-test each method per site with rolling origin (e.g. the last 8–12 weeks, 1–14 days ahead), report WAPE and MASE against seasonal naive, and adopt a method only if it beats seasonal naive consistently. Per M5, most entrants did not.
- Given Recruit (0.73) and the M5 store-level results, a realistic target is a 15–30% error reduction against same-weekday-last-week seasonal naive, more if bookings data are used. Single-digit daily MAPE claims at individual site level should be treated sceptically, especially for small sites with low covers.

### Gaps
- No academic source found for absolute site-level daily MAPE/WAPE in restaurants (covers or sales).
- Recruit winning RMSLE (absolute) not verified.
