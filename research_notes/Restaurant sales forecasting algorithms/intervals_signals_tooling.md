# Prediction intervals, external signals and tooling for daily restaurant sales forecasts (Maginhawa, 9 London sites)

Scope: daily net sales and covers per site × service (lunch, dinner, delivery), 1–14 days ahead, 6 weeks to a few years of history, SharePoint data, serverless Node (Netlify Functions) back end, must be explainable and unit-testable. Researched 27 Oct 2026. Items marked "(not verified this session)" are from background knowledge, not from a page fetched during this research. The report writer should treat them as lower confidence.

## (a) Prediction intervals and evaluation metrics: how to get reliable intervals, how many residuals are needed, and how to score them

### Takeaway
Use a simple point model (seasonal median or ETS by weekday) with **split or rolling conformal intervals** built from the model's own out-of-sample residuals, kept separately for each forecast horizon. Then add **adaptive conformal inference (ACI)** so coverage corrects itself when trading conditions change. Everything here is a few dozen lines of TypeScript and easy to unit-test. Score point accuracy with **MASE** (or RMSSE) plus **WAPE** for managers. Score intervals with **empirical coverage, mean width and the Winkler (interval) score**, or with pinball loss if several quantiles are produced.

### Cited Findings
- **ACI (Gibbs & Candès, NeurIPS 2021)**: works with any black-box predictor. It treats the target miscoverage level as a single parameter that is re-estimated online, giving long-run coverage guarantees under distribution shift without assuming exchangeability. — [NeurIPS 2021 abstract](https://proceedings.neurips.cc/paper/2021/hash/0d441de75945e5acbc865406fc9a2559-Abstract.html); [arXiv 2106.00170](https://arxiv.org/abs/2106.00170v3)
- **Follow-up (Gibbs & Candès 2022, "Conformal Inference for Online Prediction with Arbitrary Distribution Shifts")**: says earlier methods over-weight history and react slowly. It tunes the ACI step size over time and gets low regret over every local window. — [arXiv 2208.08401](https://arxiv.org/pdf/2208.08401v2)
- **EnbPI (Xu & Xie, ICML 2021; arXiv 2010.09107, later retitled "Conformal prediction for time series", last revised Feb 2023)**: wraps ensemble (bootstrap) predictors. It needs no data splitting and no retraining, so it suits producing intervals one step at a time. It gives approximately valid finite-sample marginal coverage for time series with strongly mixing errors, and the conditional and marginal coverage gaps shrink to zero asymptotically under extra assumptions. — [arXiv 2010.09107](https://arxiv.org/abs/2010.09107v15); [ICML 2021 oral](https://icml.cc/virtual/2021/oral/10470)
- **Conformalized Quantile Regression (Romano, Patterson & Candès, NeurIPS 2019)**: fits lower and upper quantile models on a training split, computes conformity scores on a calibration split, and widens or narrows the band by the empirical quantile of those scores. The coverage guarantee is distribution-free, finite-sample and marginal, under exchangeability. It tends to give shorter intervals than other conformal methods because the band adapts to heteroscedasticity. — [NeurIPS 2019 paper](https://proceedings.neurips.cc/paper_files/paper/2019/file/5103c3584b063c431bd1268e9b5e76fb-Paper.pdf)
- **MASE (Hyndman & Koehler 2006, IJF 22:679–688)**: the authors found that many accuracy measures used in the M and M3 competitions were inadequate and "degenerate in commonly occurring situations", and proposed MASE as the standard for comparing accuracy across series. — [EconPapers working-paper abstract](https://econpapers.repec.org/paper/mshebswps/2005-13.htm); [Monash repository](https://bridges.monash.edu/articles/journal_contribution/Another_look_at_measures_of_forecast_accuracy/5091436)
- **MASE definition**: the MAE of the forecasts divided by the in-sample MAE of the one-step naive forecast. Below 1 means better than the naive benchmark, above 1 means worse. The scaling makes it comparable across series of different size. — [R metrica docs](https://search.r-project.org/CRAN/refmans/metrica/html/MASE.html)

### Inferences
- **Why not percentage errors for this data (from Hyndman & Koehler's argument, applied here)**: MAPE and sMAPE are unstable for series with near-zero values, such as a quiet delivery day or a closed lunch. sMAPE is also asymmetric. Delivery and lunch covers on slow days are exactly this case, so MAPE and sMAPE should not be the main metric.
- **Recommended metric set**:
  - **MASE with a seasonal-naive (lag-7) denominator** for comparing models across sites and services. This is the seasonal MASE variant in FPP3 (not verified this session: otexts.com/fpp3/accuracy.html).
  - **RMSSE** if the cost of errors is quadratic. RMSSE was the M5 competition's metric (not verified this session).
  - **WAPE** (Σ|e| / Σ actual) as the figure managers see ("forecast was 8% out this week"). It aggregates safely over zeros and is in £ terms.
  - **Bias** (mean error), so systematic over-staffing or under-staffing shows up.
- **Small-sample arithmetic for split conformal (standard result, not verified this session; see Angelopoulos & Bates, "A Gentle Introduction to Conformal Prediction", arXiv 2107.07511)**:
  - With n calibration residuals, take the ⌈(n+1)(1−α)⌉-th smallest |residual|.
  - The interval stays finite only if n ≥ (1/α) − 1. That means at least 4 residuals for an 80% interval, 9 for 90% and 19 for 95%.
  - Realised coverage on a given calibration set follows a Beta distribution. Its spread is about ±1/√n, so around 50–100 residuals are needed for coverage to be stable within a few percentage points.
- **What this means for Maginhawa**:
  - Each site × service × weekday has only about 6 residuals after 6 weeks of history. So for new sites:
    - pool residuals across weekdays as relative errors (actual ÷ forecast − 1), and/or pool across sites;
    - default to 80% intervals, which are also easier for managers to read than 95%;
    - widen intervals until about 20 or more residuals exist.
  - With a year or more of history, weekday-specific and horizon-specific residual pools of 50 or more are feasible.
- **Horizon matters**: keep a separate residual pool for each horizon h (1–14 days), or at least for buckets (1–3, 4–7, 8–14). Intervals for 14 days ahead should be wider than for tomorrow. A rolling-origin backtest naturally produces these per-horizon residuals.
- **Recommended pipeline (all hand-writable in TypeScript)**:
  1. Point forecast, for example the median of the last k same-weekday values multiplied by event and weather adjustments, or ETS.
  2. A rolling-origin backtest over the last N weeks gives per-horizon relative residuals.
  3. Empirical quantiles of those residuals give the 10%, 50% and 90% bands, using the conformal (n+1) correction.
  4. ACI update: α_t+1 = α_t + γ(α − err_t), with γ around 0.005–0.05. The step size is from Gibbs & Candès (not verified this session for the exact recommended values). Applied per series, this nudges the band after each day's actual figures arrive.

  This is deterministic, explainable ("80% of past forecasts were within this range") and easy to test with fixed fixtures.
- **Choosing between methods**:
  - **CQR or LightGBM quantile regression** is only worth it if a gradient-boosted model is adopted, because it needs a calibration split, and the data is small.
  - **EnbPI** needs an ensemble of bootstrap models. That is heavier and adds little over rolling residual quantiles plus ACI at this scale.
- **Interval scoring (standard definitions, not verified this session)**:
  - **Pinball loss** for quantile q: (q − 1{y<ŷ_q})(y − ŷ_q).
  - **Winkler or interval score** for a (1−α) interval [l, u]: (u − l) + (2/α)(l − y)·1{y<l} + (2/α)(y − u)·1{y>u}.
  - **CRPS**, which needs the full predictive distribution and is roughly the average pinball loss over many quantiles.
  - Report coverage and width side by side. Coverage alone rewards very wide intervals.

### Gaps
- I did not fetch FPP3 chapters (otexts.com/fpp3) or the Angelopoulos & Bates tutorial in this session. The small-sample arithmetic and the metric formulas above are standard results but have no fetched citation.
- I did not confirm the exact (n+1)(1−α) expression in the Romano et al. paper text (only the abstract and summary were seen).
- I found no published study on conformal intervals for **restaurant** sales in particular. Evidence on coverage in this domain would have to come from Maginhawa's own backtests.
- I found no LightGBM quantile objective documentation in this session.

## (b) External signals and their measured effect: weather, bank and school holidays, events, bookings pickup, and free UK data sources

### Takeaway
The evidence on weather is mixed, comes mostly from the US, and is often from vendors. Rain tends to affect mood and reviews more than total visits. The effect depends on format (pubs and terraces suffer in rain, indoor restaurants can gain) and on **temperature relative to the seasonal norm**. Bank holidays and **bookings on the books (pickup)** are likely the strongest and cheapest signals. Hotel forecasting research (Weatherford & Kimes 2003) found pickup methods among the most robust. Free UK sources exist for bank holidays (gov.uk JSON) and weather (Open-Meteo for non-commercial use; Met Office DataHub free tier with 360 calls a day). School term dates have no national API.

### Cited Findings
**Weather**
- **Ohio State, Bujisic et al.**:
  - Diner comment cards and word-of-mouth were more negative in unpleasant weather.
  - The researcher said rain did not affect sales.
  - Temperature had the largest effect, and it was non-linear (too hot reduced positivity). A related report said lunch sales were the meal most affected by temperature.
  - Published in the *Journal of Hospitality and Tourism Research*. Some findings were reported before publication.
  - Sources: [OSU news](https://news.osu.edu/was-the-restaurant-really-that-bad--or-was-it-just-the-rain/); [ScienceDaily 2019](https://www.sciencedaily.com/releases/2019/04/190422082243.htm); [Restaurant Dive](https://www.restaurantdive.com/news/fair-weather-diners-how-temperature-influences-consumer-cravings/549897/)
- **Rain and reviews, China, 2026**: a study of about 150,000 reviews across more than 1,100 restaurants found rainy days linked to *more positive* reviews. The effect was strongest in spring and winter, and cloudy weather did not have the same effect. This concerns sentiment, not sales. — [Restaurant Online, 16 Jun 2026](https://www.restaurantonline.co.uk/Article/2026/06/16/rain-rain-dont-go-away-drizzle-makes-diners-heart-grow-fonder-study-finds/)
- **Foursquare / AccuWeather (New York, Chicago, Atlanta)**: quick-service restaurants are less affected by weather than casual dining, and rain had minimal influence on autumn traffic. — [QSR Web](https://www.qsrweb.com/news/the-weather-effect-report-tracks-weather-trends-related-to-dining-traffic)
- **UK industry, 2012**: heavy rain hit pubs, especially wet-led ones, hardest, while casual dining saw gains. An analyst summed it up as "sunny → pub; wet → restaurants". — [The Caterer](https://www.thecaterer.com/news/restaurant/bad-weather-affects-sales-at-pub-and-restaurant-groups)
- **Tenzo (UK forecasting vendor, not peer-reviewed)**: the effect of rain saturates beyond a certain amount, and **temperature extremes relative to the seasonal norm** cause the significant sales deviations. — [Tenzo blog](https://www.gotenzo.com/?p=1383)

**Bookings pickup (hotel and airline revenue management)**
- **Weatherford & Kimes (2003), "A comparison of forecasting methods for hotel revenue management", *International Journal of Forecasting* 19(3):401–415**:
  - On Choice Hotels data, pickup methods and regression had the lowest error, while booking-curve and combination forecasts were fairly inaccurate.
  - On Marriott data, exponential smoothing, pickup and moving-average models were the most robust.
  - Sources: [Cornell eCommons PDF](https://ecommons.cornell.edu/bitstream/handle/1813/72130/Kimes30_Comparison_of_Forecasting.pdf); [eCommons record](https://ecommons.cornell.edu/entities/publication/046131d9-289a-4ee2-8249-23c59a5362f0)
- **Comparative analysis of pickup methods for airport car-park arrivals (SciTePress 2016)**: applies classical and advanced pickup methods outside hotels, showing the approach carries over to other booking-led demand. — [SciTePress](https://www.scitepress.org/Papers/2016/56319/)

**Free UK data sources**
- **gov.uk bank holidays JSON (`https://www.gov.uk/bank-holidays.json`)**:
  - Top-level keys are `england-and-wales`, `scotland` and `northern-ireland`. Each holds `{division, events[]}`, and each event has `title`, `date` (YYYY-MM-DD), `notes` (for example "Substitute day") and `bunting` (boolean).
  - As fetched on 27 Oct 2026, England and Wales events run from 2019-01-01 to 2028-12-26.
  - Source: [gov.uk bank-holidays.json](https://www.gov.uk/bank-holidays.json)
- **Open-Meteo**:
  - The free API is for **non-commercial use only**, with no uptime guarantee. Limits are 600 calls a minute, 5,000 an hour, 10,000 a day and 300,000 a month. Commercial use needs a paid plan.
  - Paid plans are Standard (1M calls a month), Professional (5M) and Enterprise (50M+), all at fixed monthly prices that are not shown on the page.
  - The FAQ says the historical, climate, ensemble and satellite APIs need **Professional or higher**. The comparison table is ambiguous, so confirm this.
  - Source: [Open-Meteo pricing](https://open-meteo.com/en/pricing)
- **Met Office Weather DataHub, Global Spot (site-specific) forecasts**:
  - The free tier allows up to 360 calls a day.
  - Paid tiers are 900 calls a day for £8 a month and 3,600 a day for £30 a month, excluding VAT, with enterprise above that.
  - Limits are counted per day and unused calls do not carry over.
  - Sources: [DataHub site-specific pricing](https://datahub.metoffice.gov.uk/pricing/site-specific); [DataHub FAQs](https://datahub.metoffice.gov.uk/support/faqs)
- **School term dates**:
  - There is no national machine-readable feed. London boroughs publish PDFs or web pages (for example, Barking & Dagenham PDFs for 2021-22 to 2026-27).
  - Wandsworth says its dates follow those agreed by the London Inter Authority Admissions Group, and that academies, free schools and voluntary-aided schools may set their own.
  - The data.gov.uk "school term times" CSV found (Leeds) only covers 1993/94 to 2020/21.
  - Sources: [LBBD term dates](https://www.lbbd.gov.uk/schools-and-learning/schools-borough/school-term-dates-and-planned-closures); [Wandsworth term dates](https://wandsworth.gov.uk/termdates); [data.gov.uk school term times](https://www.data.gov.uk/dataset/aad853ad-b0d8-47a9-8491-a630b703b8a9/school-term-times)

### Inferences
- **Order of signals for v1, cheapest and most reliable first**:
  1. Weekday seasonality.
  2. Bank-holiday flags, from the gov.uk JSON cached weekly, with "day before" and "day after" flags as well.
  3. Bookings on the books for dinner, as an additive or multiplicative pickup model. This needs a bookings feed or a manager-entered "covers booked" figure.
  4. School-holiday flags from a hand-maintained table of London term dates, one row a year, entered by head office.
  5. Weather as a *temperature anomaly versus the seasonal norm* plus a rain-saturation term. Measure it on Maginhawa's own data before trusting it.
- **The two pickup models**:
  - Additive: forecast = booked_at_lead_L + mean historical (final − booked_at_L) for that weekday and lead time.
  - Multiplicative: forecast = booked_at_L × mean(final ÷ booked_at_L).
  - Both are one-line formulas that explain themselves and are easy to unit-test.
  - Weatherford & Kimes found pickup robust across both hotel datasets, so it is the obvious method for dinner covers where reservations exist.
- **Weather by service**: weather probably matters more for **delivery** (rain likely lifts it) and for terrace-heavy or footfall-led lunch sites than for booked dinners. No restaurant-delivery-specific study was found in this session, so this is a hypothesis to test.
- **Choosing a weather source**:
  - Commercial use of Open-Meteo's free tier is not allowed. A restaurant group's internal operations app is commercial use, so either buy an Open-Meteo plan or use the Met Office DataHub free tier.
  - DataHub easily covers 9 sites, since one call per site per day is about 9 to 18 calls against the 360 allowed.
  - Historical weather for training is a separate need. Possible routes are the Open-Meteo Professional plan, Met Office observations, or a one-off download.
- **Events**:
  - No free consolidated London events API was researched.
  - A simple manager-entered "event nearby" flag, or a head-office calendar list in SharePoint, is the explainable option for v1.

### Gaps
- I found no peer-reviewed UK study that measures the elasticity of restaurant sales to rain or temperature, such as "% change per °C". The available evidence is US-based, sentiment-based or from vendors. Effect sizes must be estimated from Maginhawa's own history.
- I found no measured effect of UK bank holidays or school holidays on restaurant sales. The direction is intuitive (London city-centre lunch probably falls, suburban sites probably rise), but this is unverified.
- I did not see the full text of Weatherford & Kimes, so error figures by method are not available.
- I did not verify whether Get Information about Schools (DfE) exposes term dates (it probably does not).
- The Met Office historical observations pricing page appeared in results but I did not fetch it.

## (c) Implementation options and costs: TypeScript/Node on Netlify, Python hosted elsewhere, and hosted forecasting APIs

### Takeaway
At 9 sites × 3 services = 27 series a day, **hand-written TypeScript in `packages/core` is the best fit**:
- seasonal median or ETS for the point forecast;
- conformal residual quantiles and ACI for intervals;
- pickup for bookings.

It runs in milliseconds, well inside Netlify's 30-second scheduled-function limit, is fully unit-testable with Vitest and is explainable. Python (statsforecast) run as a scheduled GitHub Action or Azure Function is a credible phase-2 benchmark. Hosted APIs are optional. Amazon Forecast is closed to new customers, TimeGPT is pay-per-token through Azure or Nixtla, and Google bills per forecast data point.

### Cited Findings
**Netlify limits**
- Synchronous functions run for **60 seconds**, scheduled functions for **30 seconds** and background functions for **15 minutes**. None of these is configurable.
- Default memory is 1024 MB, configurable from 1024 to 4096 MB on credit-based Pro and Enterprise plans.
- Payload limits are 6 MB buffered, 20 MB streamed and **256 KB for background functions**.
- The default region is `cmh` (Ohio). **`lhr` (London)** and `dub` are available on Pro and Enterprise, which is relevant to UK GDPR data residency.
- Source: [Netlify functions configuration](https://docs.netlify.com/build/functions/configuration.md)
- Background functions return 202 straight away, retry after 1 minute and then after 2 more minutes on error, and return no response, so results must be written somewhere else (for example SharePoint). — [Netlify background functions](https://docs.netlify.com/build/functions/background-functions.md)

**JavaScript and TypeScript libraries**
- **`arima` on npm (zemlyansky)**:
  - An Emscripten/WASM port of the C library ctsa. Supports ARIMA, SARIMA, SARIMAX and AutoARIMA (`new ARIMA({auto:true}).fit(ts).predict(12)`).
  - In the browser, Chrome blocks compiling WASM modules over 4 kB on the main thread, so it needs a Web Worker or `arima/async`.
  - Docs disagree between versions (0.2.5 on the npm page, 0.2.8 in the jsDelivr README).
  - A third-party health score is 54/100 ("low health").
  - Sources: [npm arima](https://www.npmjs.com/package/arima); [jsDelivr README 0.2.8](https://cdn.jsdelivr.net/npm/arima@0.2.8/README.md); [depscope](https://depscope.dev/pkg/npm/arima)

**Hosted APIs**
- **Amazon Forecast**: AWS documentation states it is "no longer available to new customers", although existing customers can keep using it. AWS points to SageMaker Canvas for migration. The closure was announced in mid-2024 (date not re-verified on the page). — [AWS Forecast docs](https://docs.aws.amazon.com/forecast/latest/dg/API_Types.html); [document history](https://docs.aws.amazon.com/en_us/forecast/latest/dg/doc-history.html)
- **Nixtla TimeGPT**:
  - Available on Microsoft Foundry (Azure), billed as standard Azure consumption inside the customer's own subscription. Variants include TimeGPT-1, TimeGPT-1-long-horizon and TimeGPT-2-mini, and the catalogue also lists TimeGPT-2.1. — [Nixtla blog](https://www.nixtla.io/blog/timegpt-azure-marketplace); [Azure catalogue TimeGPT-2.1](https://ai.azure.com/catalog/models/TimeGPT-2.1)
  - Nixtla's docs listed pay-as-you-go rates of **$0.00013 per 1,000 input tokens and $0.00038 per 1,000 output tokens**, rising to $0.00035 and $0.00105 for fine-tuned models. These are labelled for TimeGEN-1 (the Azure-optimised TimeGPT), so they may be out of date for TimeGPT-2.x. — [Nixtla docs, subscription plans and pricing (search snippet; page now redirects)](https://docs.nixtla.io/docs/getting-started-timegpt_subscription_plans_and_pricing)
  - Software directories list a "starting price US$12,000, flat rate" with a free trial. This is unconfirmed by Nixtla and conflicts with the per-token model. — [Capterra](https://www.capterra.com/p/10028915/TimeGPT/)
  - Enterprise and self-hosting are quoted on request. — [ki-syndikat.de](https://www.ki-syndikat.de/tools/nixtla-timegpt/)
- **Google Vertex AI and BigQuery**:
  - Vertex AI forecasting training is $21.252 an hour.
  - AutoML forecasting prediction is $0.20 per 1,000 data points for the first million a month, then $0.10, then $0.02. One data point is one time step in the horizon.
  - BigQuery ARIMA_PLUS prediction is $5.00 per 1,000.
  - BigQuery `AI.FORECAST`, with the embedded TimesFM foundation model, is billed at BigQuery ML on-demand evaluation and prediction rates.
  - Sources: [Vertex AI pricing](https://cloud.google.com/vertex-ai/pricing?hl=he); [BigQuery AI.FORECAST docs](https://docs.cloud.google.com/bigquery/docs/reference/standard-sql/bigqueryml-syntax-ai-forecast); [Google blog: TimesFM in BigQuery](https://cloud.google.com/blog/products/data-analytics/bigquery-ml-timesfm-models-now-in-preview)
- **Azure Foundry models in general**: charged per 1,000 tokens, counting both input and output. — [Microsoft Learn, manage costs](https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/how-to/manage-costs)

### Inferences
- **Compute size**: 27 series × 14-day horizon = 378 forecast points a day. The training data is at most about 3 years × 365 days × 27 series, roughly 30,000 numbers. A seasonal median, Holt-Winters or ETS fit plus a 26-week rolling backtest for residuals takes well under a second in plain TypeScript. It fits the 30-second scheduled limit and the 1 GB memory default by orders of magnitude. The main latency risk is **reading from SharePoint through Graph**, not the maths.
  - Suggested design: a scheduled Netlify function at about 05:00 Europe/London (cron is in UTC, so allow for BST) that reads history, writes forecasts to a SharePoint list, and fans out to a background function if Graph paging is slow.
- **Hand-writing versus libraries** (library facts below are general knowledge, not verified this session):
  - `simple-statistics` provides quantiles, medians and linear regression, and is enough for residual quantiles and pickup regressions.
  - `ml.js` (ml-regression and related packages) and `@tensorflow/tfjs` are overkill and hard to explain.
  - `danfo.js` is a pandas-like data-frame library and adds nothing needed here.
  - `timeseries-analysis` is old and unmaintained.
  - The `arima` WASM port works but is a black box with a low health score.
  - So the recommendation is to hand-write about 300 lines in `packages/core`: seasonal-naive, weekday median, simple ETS(A,N,A) or Holt-Winters with fixed or grid-searched parameters, pickup, residual-quantile and conformal intervals, ACI, and the MASE, WAPE, coverage and Winkler metrics. Each is a pure function with golden-file Vitest tests, which matches the project rule that calculations live in one tested core module.
- **Python benchmark (phase 2)**:
  - Nixtla's `statsforecast` (AutoETS, AutoARIMA, MSTL, with conformal intervals built in) is the strongest free benchmark.
  - It could run nightly in a GitHub Action (cron) or an Azure Function (Python), reading from SharePoint through Graph and writing back.
  - At 27 series it would run in seconds. GitHub Actions minutes for private repositories would be well inside free allowances (not verified this session).
  - The value is checking whether the TypeScript model is within a few percent of state-of-the-art statistical models, not replacing it.
  - Darts and sktime are heavier and suit ML-model experiments.
- **Hosted API cost at this scale is trivial but not free of other costs**:
  - Google AutoML: about 378 points a day × 30 ≈ 11,000 points a month ≈ $2.30 a month.
  - TimeGPT on Azure: a few thousand tokens a day, so pennies a month at the listed rates.
  - The real costs are vendor lock-in, data leaving the Microsoft 365 tenant (a UK GDPR and DPIA consideration, although sales data is mostly not personal data), US default regions, and reduced explainability ("the foundation model said so").
  - Foundation models such as TimeGPT and TimesFM also cannot use manager-entered bookings unless they are passed as exogenous variables.
- **Avoid Amazon Forecast**, because it is closed to new customers.

### Gaps
- I could not reach Nixtla's current public pricing page (404 and redirect). Current TimeGPT-2.x prices on Azure were not confirmed.
- I did not fetch the BigQuery ML on-demand rate for `AI.FORECAST` and TimesFM.
- I did not research an Azure-native AutoML forecasting price (Azure ML AutoML forecasting is billed on compute).
- I did not fetch or verify npm pages for simple-statistics, ml.js, danfo.js, timeseries-analysis or tfjs (maintenance status, last publish dates).
- I did not confirm GitHub Actions free-minute allowances or Azure Functions Python consumption pricing in this session.
- I did not obtain the exact closure-announcement date for Amazon Forecast from AWS's own page (commonly reported as July 2024).
