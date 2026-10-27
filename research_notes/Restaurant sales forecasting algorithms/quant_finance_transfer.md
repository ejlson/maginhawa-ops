# Quant-finance techniques for restaurant sales and covers forecasting: what transfers and what does not

Context: 9 London sites, daily sales (£) and covers, horizons of 1 to 14 days, 6 weeks to a few years of history per site. Labels used below: **[Evidence]** means a published empirical result in demand, sales or forecasting-competition data. **[Theory]** means a mathematical result. **[Analogy]** means a finance practice carried over by reasoning only, with no direct demand-forecasting evidence found. Notes marked "(training knowledge, not re-verified this session)" are standard textbook facts I did not re-fetch.

## Which finance ideas have direct evidence of helping in demand/sales forecasting, and which are a poor fit?

### Takeaway
The finance ideas that transfer are the generic statistical-hygiene ones: combining forecasts, honest walk-forward validation, state-space/exponential smoothing (EWMA), robust handling of outliers and monitoring for level shifts. Each has direct evidence in demand forecasting or the M competitions. Finance-specific signal ideas do not fit: momentum, random-walk-centred modelling, GARCH-style volatility clustering and high-frequency microstructure methods. Daily restaurant sales are dominated by strong, stable weekly seasonality plus calendar, booking and weather effects, which is the opposite of near-unpredictable asset returns.

### Cited Findings
**Ensembles and model averaging [Evidence, strong]**
- In M4, 12 of the 17 most accurate methods were combinations, mostly of statistical approaches. No pure ML method beat the combination benchmark. — [M4 results, Makridakis et al. (via UNIC repository)](https://pure.unic.ac.cy/en/publications/the-m4-competition-results-findings-conclusion-and-way-forward/)
- M5 (Walmart daily unit sales, hierarchical by product and store, with prices, promotions and calendar events) "confirmed the findings of the previous four M competitions". The winner used an equal-weighted combination of 6 models, the runner-up an equal-weighted combination of 5, and third place an equal-weighted combination of 43 NNs. Among the benchmarks, the ES+ARIMA combination beat either method alone. — [Makridakis, Spiliotis & Assimakopoulos, M5 Accuracy results (IJF 2022, preprint)](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- The "forecast combination puzzle": optimised weights often fail to beat equal weights. One explanation is the low power of tests and estimation noise in the weights. — [Solving the Forecast Combination Puzzle (arXiv 2308.05263)](https://arxiv.org/pdf/2308.05263)
- Lichtendahl & Winkler (2020) found that a simple, robust trimmed-mean combination of a subset of M4 methods (screening out inaccurate or highly correlated ones) performs almost as well as the best M4 combination, with lower accuracy risk. — [Duke Scholars record](https://scholars.duke.edu/publication/1402610)
- Pesaran & Timmermann found that averaging forecasts from the same model fitted over different estimation windows reduces MSFE in many cases when there are structural breaks. — [Pesaran & Timmermann, Selection of estimation window (J. Econometrics 2007)](https://rady.ucsd.edu/_files/faculty-research/timmermann/estimation-window.pdf)

**Cross-learning across series (pooling sites) [Evidence]**
- In M5, "essentially all top 50 performing methods" used cross-learning (one model across many aligned, correlated series). This beat series-by-series training and mitigates "difficulties related to limited historical observations". — [M5 results](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- M5 top methods were mostly LightGBM, which handles many correlated series and exogenous variables. M5 was the first M competition where pure ML methods clearly beat all statistical benchmarks, by more than 20% WRMSSE on average, with smaller gaps at lower aggregation levels. — [M5 results](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)

**Exogenous variables (bookings, events, weather) [Evidence]**
- All M5 winners used external information. ES with promotion and event regressors (ESX) was 6% better than the same ES without them. Pure time-series methods "fail to effectively account for the effect of holidays, special events, promotions, prices and possibly the weather". — [M5 results](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- A restaurant-specific state-space study (Chiba, Kyushu) decomposed daily restaurant sales into day-of-week, holiday and weather effects, using 2 years of data from a restaurant near a convention centre and offices. Model selection was by information criterion. — [Chiba, State space modelling approach to decompose daily sales of a restaurant (CORE record)](https://core.ac.uk/works/155922109) (abstract only seen via search; full text returned 403)

**Restaurant literature context [Evidence, survey]**
- Lasek, Cercone & Saunders (2016) surveyed 20 years of restaurant sales and guest-count forecasting and sorted the methods into seven categories. They noted there was no prior review and that practice had historically been judgement-based. — [Lasek et al., Smart City 360° (EUDL)](https://eudl.eu/doi/10.1007/978-3-319-33681-7_40)

**Poor fit: random-walk thinking and momentum [Evidence, from finance itself, plus Analogy]**
- Stock returns sit close to random walks. Even Lo & MacKinlay's famous rejection of the random walk for weekly US returns came largely from small stocks, and it did not support a mean-reverting model. That is a weak, fragile predictability, unlike sales seasonality. — [Lo & MacKinlay 1988 (MIT)](https://web.mit.edu/~alo/www/Papers/lo-mackinlay-88.html)
- In forecasting benchmarks, the seasonal naive (sNaive) is the meaningful baseline for seasonal sales. In M5, only 35.8% of teams beat sNaive and only 7.5% beat the best benchmark (bottom-up exponential smoothing). So simple seasonal methods are strong, and a random-walk (Naive1) baseline would be a strawman. — [M5 results](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- M4 defines Naive1 as a random walk and Naive2 as a seasonally adjusted naive. The seasonal benchmark is the relevant one for seasonal data. — [Nuffield M4 paper (Doornik et al.)](https://www.nuffield.ox.ac.uk/economics/Papers/2019/2019W01_M4_forecasts.pdf); [M4 results](https://pure.unic.ac.cy/en/publications/the-m4-competition-results-findings-conclusion-and-way-forward/)
- I found no study showing momentum or trend-following signals improving sales forecasts beyond what a level/trend component already captures. (See Gaps.)

**Poor fit, or only niche: GARCH-style volatility [Evidence, weak and adjacent]**
- I found no paper applying GARCH to retail or restaurant sales prediction intervals. The nearest is a safety-stock study, which found GARCH(1,1) more appropriate than kernel density estimation for longer lead times *when forecast-error variance is autocorrelated*. — [Demand-forecasting/safety-stock repository record (UPV)](https://riunet.upv.es/handle/10251/159356?show=full)
- For volatile, promotion-driven demand, a closed-form ARIMA-based prediction interval was reported as reliable, with no GARCH needed. — [Demand forecasting in supply chain: impact of demand volatility with promotions (arXiv 1909.13084)](https://arxiv.org/pdf/1909.13084)

**High-frequency methods [Analogy]**
- No sources sought. Microstructure, tick-level and order-book methods have no counterpart at daily granularity with 9 series. They are not relevant to v1. (Intraday covers by service period are a separate, ordinary seasonal problem.)

### Inferences
- Transfer table (my synthesis):

| Technique | Fit for Maginhawa | Basis |
|---|---|---|
| Forecast combination (equal-weight or trimmed mean of ETS, seasonal naive, regression/GBM) | High | Evidence (M4, M5) |
| Walk-forward / rolling-origin validation | High, essential | Evidence (M5 Finding 6), textbook |
| Look-ahead/leakage controls (bookings and weather "as known at origin") | High, essential | Evidence (ex-ante load forecasting) |
| Backtest-overfitting awareness (limit model search, report variance across origins) | High | Evidence (M5 selection failures); PBO is Analogy |
| Kalman / structural state-space (local level + weekly seasonal + regressors) | High | Theory + restaurant case study |
| EWMA / exponential smoothing | High (EWMA = SES) | Theory + competitions |
| Robust statistics (median, winsorising, robust loss) | Medium–high | Analogy plus standard practice; little direct evidence found |
| Change-point detection (CUSUM, tracking signals, BOCPD) | Medium–high, as a monitor | Evidence (CUSUM in demand control since 1964); BOCPD is Analogy |
| Online/adaptive learning | Medium (state-space and ETS already adapt online) | Theory |
| Cross-learning / pooling across 9 sites | High, especially for new sites with 6 weeks of data | Evidence (M5) |
| GARCH volatility | Low; only if residual variance clearly clusters | Weak evidence |
| Momentum / trend-following signals | Low | No evidence; captured by the trend/level component |
| High-frequency / microstructure methods | None | Analogy |
| Sharpe-style metrics, PBO on Sharpe | Low as-is; reframe with MASE/WAPE or pinball loss | Analogy |

- The key structural difference is the signal-to-noise ratio. In finance, almost all variance is noise and the edge is tiny, so overfitting control dominates. In restaurant sales, day-of-week plus bookings explain a large share of variance. The main risks are leakage of known-future information and unmodelled level shifts, not hunting for faint alpha.
- With 9 sites, the M5 "cross-learning" advantage is probably smaller than with 30,000 series, but pooling day-of-week shapes and holiday effects across sites is still the cleanest way to cope with sites that have only 6 weeks of history.

### Gaps
- No peer-reviewed study tests momentum or trend-following features in restaurant or retail sales forecasting. The claim that they add nothing is inference.
- No direct study of GARCH for daily restaurant or retail sales intervals was found.
- No restaurant study comparing combinations against single models was found. Combination evidence comes from M4 (mixed domains) and M5 (retail units, not restaurant £/covers).
- Robust statistics (median, winsorising) in sales forecasting: no specific empirical comparison was found this session.

## How should walk-forward backtesting be set up (rolling origin, horizons 1–14, no leakage of future bookings or weather actuals)?

### Takeaway
Use rolling-origin evaluation. At each origin date, fit only on data up to that day, forecast days 1 to 14 and score errors by horizon. Rebuild every input (bookings on the books, weather forecasts, the event calendar) *as it was known at the origin*, never as it turned out. Pre-register a small model set and report the spread of errors across origins, because selecting among many variants on one backtest overfits, as M5 showed empirically.

### Cited Findings
- FPP3: in time-series CV each test set uses only earlier observations ("evaluation on a rolling forecasting origin"). The earliest observations are excluded because tiny training sets give unreliable forecasts. Errors can be computed per horizon (`stretch_tsibble()` then `forecast(h = …)`), and error grows with horizon. Training-set accuracy is optimistic (in the example, training RMSE was 11.15 against CV RMSE of 11.27). Pick the model with the smallest CV error. — [Hyndman & Athanasopoulos, FPP3 §5.10](https://otexts.com/fpp3/tscv.html)
- `forecast::tsCV` fits on y₁…y_t for t = 1…T−h and records y_{t+h} − ŷ_{t+h|t}. A `window` argument gives a fixed rolling window (otherwise the window expands), `initial` sets a burn-in, and origins can be skipped. — [tsCV documentation](https://search.r-project.org/CRAN/refmans/forecast/html/tsCV.html)
- Expanding windows grow with each origin. Rolling windows hold size constant by dropping the oldest data, which suits non-stationary series with level shifts. — [Hewamalage, Ackermann & Bergmeir, Forecast evaluation for data scientists (arXiv 2203.10716)](https://arxiv.org/pdf/2203.10716)
- Standard K-fold CV is valid for purely autoregressive models *only* when the residuals are uncorrelated. Otherwise it fails, and `CVar` applies a Ljung-Box check. For models with exogenous inputs and possible level shifts, rolling-origin is the safer default. — [Bergmeir, Hyndman & Koo 2018 (IDEAS)](https://ideas.repec.org/a/eee/csdana/v120y2018icp70-83.html); [CVar docs](https://pkg.robjhyndman.com/forecast/reference/CVar.html); [Econometrics of ML in forecasting (arXiv 2308.10993)](https://arxiv.org/pdf/2308.10993)
- M5 Finding 6: the top four, and most of the top 50, validated on at least the last four 28-day windows. The winner also tracked the *standard deviation* of error across windows and combined a more accurate but unstable model with a stable one. Many teams "failed to choose the best method developed, probably due to misleading validation scores": with their best submission rather than their chosen one, 48.8% rather than 35.8% would have beaten sNaive. — [M5 results](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- M5 deliberately included holidays (e.g. Easter, Mother's Day) in its validation and test windows to capture demand deviations. — [M5 results](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)
- Leakage with weather: use weather *forecasts* for future periods, not observed weather. — [Xebia, 7 practical tips for demand forecasting](https://xebia.com/blog/7-practical-tips-for-demand-forecasting-experimentation-and-modeling/)
- In load forecasting, most academic work is ex-post (actual weather in the forecast period). Selecting models with real weather-forecast error improved accuracy by 2.4% on average over selection by ex-post accuracy. — [UNC Charlotte, Short-term ex-ante load forecasting](https://graduateschool.charlotte.edu/short-term-ex-ante-load-forecasting/)
- Ex-ante comparisons with explanatory variables are implicitly conditional on how accurately those variables were forecast. Run ex-ante *and* ex-post tests to separate model misspecification from input-forecast error. — [Utility forecasting paper (Stubbs)](https://philstubbs.com/wp-content/uploads/2024/04/utilfore.pdf)
- Bailey, Borwein, López de Prado & Zhu: hold-out validation is "unreliable and inaccurate" for investment backtests when many configurations are tried. They estimate the Probability of Backtest Overfitting (PBO) by combinatorially symmetric cross-validation (CSCV), which splits the sample into blocks and checks how often the in-sample best configuration ranks below the median out of sample. — [Bailey et al., The Probability of Backtest Overfitting (SSRN)](https://papers.ssrn.com/abstract=2326253); [J. Computational Finance](https://www.risk.net/journal-of-computational-finance/2471206/the-probability-of-backtest-overfitting); [R `pbo` vignette](https://ftp.fau.de/cran/web/packages/pbo/vignettes/pbo.html)
- López de Prado's purged K-fold (AFML ch. 7) removes training observations whose label windows overlap the test period. An "embargo" also drops observations just after the test fold to block serial-correlation leakage. — [Purged cross-validation (Wikipedia)](https://en.wikipedia.org/wiki/Purged_cross-validation) (secondary; the exact embargo sizes quoted online vary)

### Inferences
- Recommended protocol for Maginhawa:
  1. **Origins:** every day (or every day at 22:00 after the EOD report) over the last 8–12 weeks at minimum, more once there are years of data. This gives many origins per weekday and should include Christmas, Easter and bank holidays where history allows.
  2. **Window:** compare expanding and rolling (e.g. 1 year) windows, which is effectively the Pesaran–Timmermann question.
  3. **Horizons:** score h = 1…14 separately, and report by horizon and by weekday. Day 1 matters for prep and day 7–14 for rotas.
  4. **Point-in-time inputs:** store an "as-of" snapshot of bookings on the books (covers booked for date D as known at origin t), the weather forecast issued at t for D, and the event calendar as known at t. Never use final bookings, walk-ins or actual weather in a backtest. If historical weather forecasts cannot be obtained, also run an ex-post variant and label it optimistic.
  5. **Metrics:** use scale-free metrics (MASE against the seasonal-naive baseline, and WAPE in £), plus pinball loss or coverage for intervals. Always include sNaive (same weekday last week) and a 4-week same-weekday median as baselines.
  6. **Overfitting control:** fix a short list of candidate models before looking at the test period. Report the mean *and* the dispersion of error across origins (as the M5 winner did). Keep a final untouched holdout (e.g. the latest 4 weeks) for the chosen configuration only.
- Purging and embargo matter less here than in finance, because labels (day-D sales) do not overlap across samples the way multi-day return labels do. They become relevant if features use centred rolling windows or future-dated aggregates, for example a "7-day centred average" that leaks. The simplest guard is strictly causal feature construction plus rolling-origin CV. A small gap between train and test is harmless and protects against accidental leakage. This is Analogy.
- PBO/CSCV is designed around Sharpe ratios on strategy returns. It could be repurposed on per-origin MASE to estimate how often the best-looking variant underperforms, but I found no demand-forecasting application. It is worth doing only if many model variants are tuned. This is Analogy.

### Gaps
- No published restaurant study quantifies the accuracy gap between using final bookings or actual weather and using as-of bookings or forecast weather. The load-forecasting 2.4% figure is the closest analogue.
- Availability of archived historical UK weather *forecasts* (as opposed to actuals) for backtesting was not researched here.
- No source found applying PBO/CSCV to retail or hospitality demand.

## How can a local-level / structural time-series model with weekly seasonality (Kalman filter) be used for restaurant data, and what are its pros and cons against ETS?

### Takeaway
A basic structural model fits daily restaurant data naturally. It has a local level (random walk), an optional slow trend, a 7-day seasonal (dummy or trigonometric) and regression terms for bookings on the books, bank holidays, weather and events, estimated with the Kalman filter. The local-level part is mathematically equivalent in steady state to simple exponential smoothing (EWMA), so the gain over ETS is not accuracy for its own sake. The gain is handling regressors, missing days (closures), explicit interventions for level shifts, and coherent uncertainty in one framework. ETS is simpler, auto-selected and well benchmarked.

### Cited Findings
- Kalman local-level recursions: K_t = P_t/(P_t+1) and P_{t+1} = K_t + q, where q is the signal-to-noise ratio. In steady state the predictor takes the form of simple exponential smoothing. With a diffuse initial state, the first gain is 1. — [Exponentially weighted estimands and the exponential family (arXiv 2512.16745), citing Harvey 1989 and Durbin & Koopman 2012](https://arxiv.org/pdf/2512.16745)
- The univariate local-level model is a notable exception with a closed-form steady-state Riccati solution. — [Pelagatti & Sbrana, SIS 2018](https://meetings3.sis-statistica.org/index.php/sis2018/50th/paper/view/1324)
- Local level ≡ SES with smoothing constant related to q (a secondary source states α = q/(q+1); verify against Harvey or Durbin & Koopman). — [MetricGate local level model (secondary)](https://metricgate.com/docs/local-level-model/)
- ETS has its own innovations state-space framework, which gives likelihoods, AIC selection and prediction intervals. — [Hyndman, Koehler, Snyder & Grose 2002, A state space framework for automatic forecasting using exponential smoothing (IDEAS)](https://ideas.repec.org:443/a/eee/intfor/v18y2002i3p439-454.html)
- A restaurant application decomposed daily sales into time-dependent day-of-week, holiday and weather components with a state-space model. — [Chiba (CORE record)](https://core.ac.uk/works/155922109)
- Kalman filtering of retail sales: an early Federal Reserve application to provisional retail sales estimates reduced MSE by about one third. That was a data-revision problem rather than demand forecasting, but it shows the filter on retail series. — [Federal Reserve IFDP, December 1987](https://www.federalreserve.gov/econres/ifdp/improving-the-forecast-accuracy-of-provisional-data-an-application-of-the-kalman-filter-to-retail-sales-estimates.htm)
- A limitation: the basic Kalman filter assumes linear Gaussian dynamics, which suits low-count items poorly. — [US patent 10445689, Monte Carlo forecasting (USPTO)](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/10445689)
- M5 benchmark: exponential smoothing (bottom-up) was the best of 24 benchmarks. Adding exogenous promotion and event regressors to ES (ESX) improved it by 6%. Regressors matter, and the structural model or ETSX/regression with ETS errors is the natural carrier. — [M5 results](https://statmodeling.stat.columbia.edu/wp-content/uploads/2021/10/M5_accuracy_competition.pdf)

### Inferences
- Suggested specification per site, modelled on log sales or log covers so that effects are multiplicative:
  - y_t = μ_t + γ_t + β′x_t + ε_t, where μ_t is a local level (optionally a damped slope), γ_t is a 7-day seasonal allowed to drift slowly, and x_t holds log(1 + bookings-as-of-origin), bank holiday or event dummies, forecast temperature and rain, and school holidays.
  - Use the Kalman filter for one-step updates each night after the EOD report. This is naturally "online", and missing days (closures, refurbs) are handled by skipping the update step. Use the Kalman smoother for retrospective decomposition ("what was the underlying level last month?").
  - Interventions: add a level-shift dummy or temporarily inflate the level-state variance when a known change occurs (refurb reopening, menu change).
  - Hierarchy across 9 sites: share seasonal and holiday coefficients via a pooled or hierarchical prior, or a multivariate state-space with a common factor. This mirrors the M5 cross-learning finding.
- Pros against ETS: native regressors with time-varying coefficients; explicit missing-data handling; interventions and outlier dummies; interpretable components for managers; one likelihood for parameters and intervals; the same filter doubles as a change detector via standardised innovations.
- Cons against ETS: more tuning (variance parameters can collapse to zero or be poorly identified with 6 weeks of data); Gaussian assumptions (log-transform helps; covers are counts but large enough that Gaussian on log is usually fine); less automatic model selection; fewer turnkey JavaScript/TypeScript libraries (statsmodels `UnobservedComponents`, R `KFAS`/`StructTS` and similar are Python/R; training knowledge, not re-verified). ETS (`fable`/`statsforecast` AutoETS) gives a strong automatic baseline that is hard to beat without regressors.
- Pragmatic stance: run both. ETS (or seasonal naive × level) is the robust baseline, and the structural model with bookings and weather is the challenger. Combine them (equal weights) per the M4/M5 evidence.

### Gaps
- Full text of the Chiba restaurant SSM study (accuracy numbers, horizons) was not accessible (403).
- No head-to-head published comparison of BSM against ETS on restaurant data was found.
- Exact α–q mapping for local level ≡ SES taken from a secondary source. Verify in Harvey (1989) or Durbin & Koopman (2012).

## How to detect level shifts (refurb, new competitor, menu change) and adapt quickly

### Takeaway
Monitor forecast errors, not raw sales. A CUSUM or Trigg-style tracking signal on standardised one-step errors is the long-established demand-forecasting tool. BOCPD is a principled Bayesian online alternative that gives a probability of a recent change. On an alarm, adapt by increasing the level's adaptivity: inflate the Kalman level variance, add an intervention dummy, or shorten the window or average across windows (Pesaran–Timmermann). Do not chase every blip; require persistence across several days, because weekly seasonality and one-off events cause false alarms.

### Cited Findings
- Harrison & Davies (1964) applied CUSUM to the control of routine demand forecasts. The CUSUM tracking signal is the cumulative error sum divided by the MAD. Trigg's (1964) signal is smoothed error over smoothed absolute error. With β = 0.1, values above about 0.51 indicate non-random errors (Wikipedia formulas, partly garbled; verify). — [Tracking signal (Wikipedia)](https://en.wikipedia.org/wiki/Tracking_signal)
- Gardner (1985) compared CUSUM and smoothed-error signals for exponential smoothing. Prior research favoured CUSUM, but the smoothed-error signal improves with different smoothing parameters. — [Gardner 1985, CUSUM vs smoothed-error (UH PDF)](https://www.bauer.uh.edu/egardner/3301H%20Operations%20Management/ESG%20Publications/1985%20Cusum%20vs.%20smoothed%20error.pdf)
- Ravi (2014): a CUSUM signal built on unsmoothed MAD can flag bias even under unbiased i.i.d. normal errors, so a simple modification is proposed. — [Ravi 2014, JORS (IDEAS)](https://ideas.repec.org/a/pal/jorsoc/v65y2014i8p1189-1192.html)
- Even a "false alarm" from a tracking signal typically indicates real bias that will persist if uncorrected. — [Tracking signal (Wikipedia)](https://en.wikipedia.org/wiki/Tracking_signal)
- Lewis (1970) described CUSUM and Trigg as the two most widely used forecast-monitoring techniques of the time. A WVU thesis compared CUSUM, smoothed-error, backward CUSUM, autocorrelation and parabolic CUSUM signals by average run length. — [Lewis (SciSpace)](https://typeset.io/authors/c-d-lewis-shy09dj9hk); [WVU thesis](https://researchrepository.wvu.edu/etd/3261)
- BOCPD (Adams & MacKay 2007) does exact online inference of the most recent change point by tracking the posterior over "run length" since the last change with simple message passing. It is modular (any exponential-family predictive model) and was demonstrated on real datasets. I found no retail or demand application in the search. — [Adams & MacKay, arXiv 0710.3742](https://arxiv.org/pdf/0710.3742)
- After breaks, it can still be optimal to use some pre-break data (bias–variance trade-off). Window averaging reduces MSFE in many break scenarios. Break tests detect recent breaks only with a long lag, so "use only post-break data" is often infeasible right after a change. — [Pesaran & Timmermann 2007 (UCSD PDF)](https://rady.ucsd.edu/_files/faculty-research/timmermann/estimation-window.pdf); [follow-on discussion (CESifo WP)](https://cesifo.org/DocDL/cesifo_wp990.pdf)

### Inferences
- Recommended design (Analogy plus established practice):
  1. Compute standardised one-step errors e_t / σ̂ from the main model, per site, on log scale, so day-of-week is already removed. Run a two-sided CUSUM (Page-style, with reference value k ≈ 0.5σ and threshold h ≈ 4–5σ, standard SPC defaults; training knowledge) or a Trigg signal. Alarm only after the signal persists (e.g. at least 3 service days) to avoid single-event noise (a rainy Saturday, a match day).
  2. Optional: BOCPD with a Gaussian predictive on the residuals, giving a "P(change in last k days)" for the head-office dashboard. This is more principled than CUSUM but adds a hazard-rate hyperparameter. With 9 sites it is cheap to run.
  3. Known changes (refurb, menu launch, new nearby competitor opening) should be entered by managers as dated events. Treat them as intervention dummies or a variance spike in the level state rather than waiting for the detector to notice. That matches the M5 finding on the value of external information.
  4. Adapt: on alarm or known event, temporarily raise the level-state variance (Kalman) or the ETS α, which gives faster re-levelling, then let it decay back. Alternatively, average forecasts across short and long estimation windows (Pesaran–Timmermann averaging) until the new level is established.
  5. EWMA as a lightweight baseline: SES/EWMA of same-weekday values, or an EWMA of the deseasonalised level, is both the steady-state Kalman local level and the finance EWMA. A higher α adapts faster after shifts at the cost of noise.
- Robust statistics: medians of the last 4 same weekdays, and winsorised or clipped residuals (e.g. Huber-type) when updating level and seasonals, stop one-off events from dragging the level. This is the robust analogue of finance practice. I found no direct sales-forecasting evidence comparing these choices this session, so treat it as Analogy plus standard practice.
- Online/adaptive learning: the state-space and ETS recursions are already online learners. Heavier online-ML methods (drift detectors such as ADWIN, online gradient updates) add little with 9 daily series. Nightly re-fitting of a small pooled model is cheap and simpler.
- Uncertainty instead of GARCH: estimate interval width from empirical rolling-origin residuals by horizon and weekday (quantiles), or from the state-space model on log scale. Add a time-varying scale (e.g. EWMA of squared residuals) only if residual variance clearly clusters, for example after a shift or in December. This is a lightweight "volatility model" without GARCH estimation, and it is Analogy.

### Gaps
- No published application of BOCPD to restaurant or retail sales found. Its relative performance against CUSUM on demand data is unknown.
- No restaurant-specific evidence on how quickly level shifts (refurb, competitor) manifest or how large they typically are.
- CUSUM parameter defaults (k, h) above are standard SPC values from training knowledge, not verified against a demand-forecasting source this session.
- López de Prado's AFML also covers structural-break tests (e.g. CUSUM and SADF-type tests, ch. 17; training knowledge, not re-verified). Their transfer to sales was not assessed with sources.
