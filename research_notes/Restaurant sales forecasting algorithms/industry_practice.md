# Industry practice in restaurant, food-service and retail demand forecasting

Scope: what large platforms, retailers and restaurant-tech vendors document publicly about forecasting daily sales, covers and orders. The aim is to choose a method for a 9-site London group: daily net sales and covers per site and per service (lunch, dinner, delivery), 1 to 14 days ahead. Researched 27 Oct 2026.

Source-quality note: several primary pages (the DoorDash engineering posts on careersatdoordash.com and the 7shifts help-centre article) returned HTTP 403 to direct fetching. Their details below come from search-engine extracts of those pages and are marked "(via search extract)". Treat them as slightly less certain than pages I read in full.

## 1. What large platforms and retailers publish about their demand-forecasting models (algorithms and features)

### Takeaway
Industry practice at scale has settled on one global gradient-boosted tree model (LightGBM or XGBoost) trained across many related series, with calendar, holiday, weather and event features. Probabilistic deep models (Amazon's DeepAR and MQ-CNN family) are used where there are tens of thousands of series. Classical methods (exponential smoothing, Theta, ARIMA) remain the baseline that everything is benchmarked against. Nearly all of this evidence comes from delivery platforms and big retailers. Restaurant chains themselves publish very little.

### Cited Findings
**DoorDash (2023)**
- DoorDash uses a gradient boosting machine to forecast supply and demand for thousands of small ZIP-code groupings. The forecasts drive Dasher recruitment and decisions on when to add extra pay. (via search extract, Aug 2023 post) — [DoorDash Engineering: holiday predictions via cascade ML](https://careersatdoordash.com/blog/how-doordash-improves-holiday-predictions-via-cascade-ml-approach/) (also [careersatdoordash.com/?p=9878](https://careersatdoordash.com/?p=9878))
- A related DoorDash post frames forecasting as a regression problem and uses LightGBM. The main reasons given are that LightGBM can train thousands of regional forecasts in one run and allows fast iteration. (via search extract) — [DoorDash Engineering](https://careersatdoordash.com/?p=5078)
- DoorDash also presented AI in its logistics engine at O'Reilly AI NY in 2018. I found the slides but did not read them. — [O'Reilly AI NY 2018 slides](https://conferences.oreilly.com/artificial-intelligence/ai-ny-2018/cdn.oreillystatic.com/en/assets/1/event/280/How%20DoorDash%20leverages%20AI%20in%20its%20world-class%20on-demand%20logistics%20engine%20Presentation.pdf)

**Uber (2017 to 2018)**
- "Forecasting at Uber: An Introduction" (Smyl and Bell, 6 Sep 2018) lists three groups of methods. The classical group is ARIMA, exponential smoothing (Holt-Winters) and Theta, which it describes as the M3 winner and cheap to compute. The ML group is RNNs, quantile regression forests, gradient boosting trees, SVR and Gaussian process regression. It also mentions the M4-winning hybrid, which combines exponential smoothing with dilated LSTMs. — [Uber Blog, 2018](https://www.uber.com/blog/forecasting-introduction/)
- Uber's 2017 work on forecasting "extreme events" such as holidays uses LSTM neural networks (Laptev, Yosinski, Li, Smyl, ICML 2017 workshop). It is about rides, not food orders. — [Uber Research](https://eng.uber.com/research/time-series-extreme-event-forecasting-with-neural-networks-at-uber/)
- I found no Uber Eats-specific engineering post on forecasting order volume.

**Amazon (2017 to 2021, research lineage)**
- DeepAR (Salinas, Flunkert, Gasthaus) is an autoregressive RNN trained across many related series that produces probabilistic forecasts. The paper reports about 15% accuracy gains over the state of the art on several datasets and is motivated by retail inventory planning. — [arXiv 1704.04110](https://arxiv.org/pdf/1704.04110)
- MQ-RNN/MQ-CNN ("A Multi-Horizon Quantile Recurrent Forecaster", 2017) was tested on weekly demand for about 60,000 Amazon products, 1 to 52 weeks ahead, and outputs P10, P50 and P90 quantiles directly. MQ-RNN was the most accurate at every horizon. The Log-Gaussian benchmark's 80% intervals were almost twice as wide. — [arXiv 1711.11053](https://arxiv.org/pdf/1711.11053)
- MQTransformer (2020) uses MQ-CNN as its baseline. It reports that MQ-CNN beats MQ-RNN and DeepAR on Amazon's demand data. — [arXiv 2009.14799](https://arxiv.org/pdf/2009.14799); [Amazon Science](https://amazon.science/publications/mqtransformer-multi-horizon-forecasts-with-context-dependent-attention-and-optimal-bregman-volatility)
- These are research papers. They do not confirm which systems Amazon runs in production today.

**Walmart and M5 (2020 to 2022)**
- The M5 competition covered 42,840 hierarchical Walmart unit-sales series. Top solutions were pure ML and beat all statistical benchmarks. LightGBM was the most widely used method, and the winners used cross-learning, meaning one model trained across many series. — [Makridakis et al., IJF 2022 (abstract)](https://ideas.repec.org/a/eee/intfor/v38y2022i4p1346-1364.html); [M5 page, Univ. of Nicosia](https://www.unic.ac.cy/iff/research/forecasting/m5-competition/); [KU Leuven follow-up](https://lirias.kuleuven.be/retrieve/636194)
- A separate M5 Uncertainty track evaluated quantile forecasts. — [M5 Uncertainty results](https://pure.unic.ac.cy/en/publications/the-m5-uncertainty-competition-results-findings-and-conclusions/)
- According to an NVIDIA case study (vendor source), Walmart forecasts about 500 million item-by-store combinations weekly and reported a 4% accuracy gain after moving to GPU training. — [NVIDIA PDF](https://nvidia.com/content/dam/en-zz/Solutions/industries/retail/NVIDIA-AI-Accelerated-Retail-Forecasting.pdf)

**Instacart, Grubhub and Swiggy**
- Instacart's shopper-staffing pipeline runs in three stages: marketplace forecasting, then supply planning, then real-time capacity. It is measured on availability, idleness and unmet demand. — [Instacart Tech: No order left behind](https://tech.instacart.com/no-order-left-behind-no-shopper-left-idle-24ba0600f04f)
- Instacart also uses Monte Carlo simulation to balance supply and demand. — [Instacart Tech: Instacart Anytime](https://tech.instacart.com/instacart-anytime-a-data-science-paradigm-33eb25a5c32d)
- Grubhub's forecasts set driver scheduling and are updated as new information arrives. An AWS-sponsored article says Grubhub regenerates forecasts for every location every five minutes. — [NRN / AWS sponsored content](https://www.nrn.com/supplier-news/piping-hot-food-delivered-fast-with-cutting-edge-forecasting)
- Swiggy Instamart reportedly uses hierarchical forecasting with Google's TimesFM foundation model for orders-per-day and rider fleet planning. This comes from a secondary write-up. — [daily.dev summary](https://daily.dev/posts/instamart-s-generative-ai-forecasting-scaling-from-flat-forecasts-to-deep-hierarchies-sm44pwri5)
- A 2023 Swiggy talk on "Adaptive Metric Alignment" argues that evaluation metrics should match the business metric. — [Fifth Elephant 2023](https://hasgeek.com/fifthelephant/2023-08/sub/adaptive-metric-alignment-for-demand-forecasting-i-XqLQxwWhh5j2KoqqefSeqs)

**Restaurant chains (Domino's, McDonald's, Starbucks)**
- Domino's UK & Ireland replaced "hundreds of spreadsheets" with Microsoft Dynamics 365 AI demand planning, using history, economic indicators, market trends and weather. This is a vendor case study. — [Microsoft customer story](https://microsoft.com/en/customers/story/1698105041618606470-dominos-microsoft-dynamics-365-united-kingdom)
- Domino's Pizza Enterprises (Australia) uses ML forecasts to anticipate orders and reduce waste. This comes from AWS-sponsored content. — [NRN](https://www.nrn.com/supplier-news/piping-hot-food-delivered-fast-with-cutting-edge-forecasting)
- McDonald's Georgia, a franchise market, adopted a vendor ML demand-forecast tool. — [SMART business](https://sdh.smart-it.com/en/news-post/how-the-implementation-of-smart-demand-forecast-improved-the-accuracy-of-demand-forecasting-at-mcdonalds-georgia/)
- McDonald's bought Dynamic Yield in 2019 (about $300m) for menu personalisation by weather and time of day. This is commentary, not a documented forecasting system. — [ILOS](https://en.ilos.com.br/transformacao-digital-no-supply-chain-do-mcdonalds-machine-learning-para-entender-antecipar-e-influenciar-a-demanda/)

**Deliveroo**
- Deliveroo's public material covers dispatch ("Frank", 2017) and ML-predicted prep and travel times. The predictions use order type and time of day. — [Silicon Republic, 2017](https://www.siliconrepublic.com/machines/deliveroo-algorithm-frank-machine-learning)
- Job ads mention "demand forecasting models, rider availability models, and restaurant scheduling models". Deliveroo now sits within DoorDash engineering. — [Deliveroo job ad](https://www.jobfluent.com/jobs/senior-data-scientist-applied-machine-learning-london-25354b); [Deliveroo careers](https://careers.deliveroo.co.uk/?p=320152)

**Academic study of a European meal-delivery platform**
- Machine learning only becomes competitive once average daily demand passes a threshold. Below that, exponential smoothing on demand history alone performed best, given at least about two months of history. — [Hess, Spinler, Winkenbach preprint](https://code.webartifex.biz/alexander/urban-meal-delivery-demand-forecasting/raw/tag/v0.1.0/paper.pdf)

**Features reported across sources**
- Calendar (day of week, seasonality), holidays, weather and local events appear repeatedly: DoorDash; Tenzo ([Tenzo](https://www.gotenzo.com/forecast-demand)); Lineup.ai and PredictHQ events ([PredictHQ case study](https://www.predicthq.com/customers/lineup)); Domino's (weather).
- Promotions and guest counts are named by Fourth. — [Fourth](https://fourth.com/solution/workforce-management/labor-forecasting)

### Inferences
- The documented industry default for many related series is one global LightGBM model across all sites and services, with day-of-week, holiday, weather and event features plus lags. That maps well onto 9 sites × 3 services, which gives 27 series.
- Deep probabilistic models (DeepAR, MQ-CNN) were built for tens of thousands of series. With 27 series they are unlikely to beat a simpler model. The meal-delivery study suggests exponential smoothing may win at low volumes.
- No restaurant chain publishes a detailed method. Most chain evidence is vendor case studies.

### Gaps
- No technical disclosures from Starbucks, Uber Eats or Deliveroo on order or sales forecasting.
- I could not read the DoorDash posts in full (403), so holiday-accuracy improvement figures and metrics are unconfirmed.
- No public evidence on bookings or reservations used as a feature by the large platforms. That is expected, since they are delivery businesses.

## 2. What restaurant-tech vendors say about their methods and claimed accuracy

### Takeaway
Every vendor describes "AI/ML" using POS history plus weather, holidays and events. None publishes a reproducible methodology. Their accuracy claims are self-reported, use different metrics and usually compare against a weak baseline (a four-week rolling average), so they are marketing rather than evidence. Common product features are human override of forecasts and minimum-history requirements of 30 to 90 days.

### Cited Findings
| Vendor | Method stated | Claimed accuracy | Caveats |
|---|---|---|---|
| Tenzo (UK) | ML on POS transactions plus weather, events, seasonality and holidays. Needs at least 90 days of history. | "30-50% more accurate" than gut feel or a four-week rolling average. Manager approval or adjustment adds "a further 5%". — [Tenzo forecast page](https://www.gotenzo.com/forecast-demand); [Tenzo support](https://support.gotenzo.com/docs/forecasting-your-future-sales/) | Relative to a weak baseline. No metric is defined. |
| Tenzo, Nando's Singapore case | 3-month pilot at 4 sites, then rollout | 30% better forecast accuracy and 15% better labour productivity — [Tenzo case study PDF](https://www.gotenzo.com/wp-content/uploads/2023/05/Nandos-Case-Study.pdf) | Vendor-published |
| Tenzo, methods guide | Describes the four-week same-weekday rolling average as the most common manual method — [Tenzo guide](https://www.gotenzo.com/resources/insight/sales-forecasting-methods-a-comprehensive-guide-for-restaurants/) | n/a | A useful baseline definition |
| 7shifts | ML trained on daily POS sales across historical periods | "95% accuracy" with POS integration. Average daily error of 3.61% in 2022, kept below 5%. Misses blamed on unusual weather or volume swings. (via search extract) — [7shifts KB](https://kb.7shifts.com/hc/en-us/articles/14620377028627) | Probably aggregated across all customers. The metric is unclear (likely MAPE). |
| Fourth (UK/US) | "AI forecasting" on sales, guest counts, promotions and holidays. Claims data from 100,000+ locations. Continuous retraining against actuals. | Chili's case: 20% better accuracy — [Fourth labour forecasting](https://fourth.com/solution/workforce-management/labor-forecasting); [Fourth press release, May 2023](https://www.businesswire.com/news/home/20230511005550/en) | Vendor case study |
| Nory (UK/IE) | AI hourly sales forecasts per venue. 15-minute intervals at Black Sheep Coffee (130 sites). | "Within 90-95% accuracy" — [Nory](https://nory.ai/?p=624); [Restaurant Technology News, Jun 2026](https://restauranttechnologynews.com/2026/06/nory-brings-agentic-ai-to-restaurant-forecasting-labor-optimization-inventory-management-and-profitability/) | No metric is defined |
| Lineup.ai (now TimeForge) | Historical sales, weather and PredictHQ events | "Up to 60% more accurate" on the roughly 33% of days when sales are ±20% away from the four-week rolling average — [BusinessWire, Dec 2020](https://www.businesswire.com/news/home/20201209005074/en); [PredictHQ case](https://www.predicthq.com/customers/lineup); [TimeForge](https://timeforge.com/?p=30903) | Applies to a subset of days and a weak baseline |
| Toast | Advanced Sales Projections, US only. Lite: 7 days ahead. Essentials: up to 28 days. Needs at least 30 days on the platform. Excludes weather and local events, which users must adjust for manually. — [Toast support](https://support.toasttab.com/fr-CA/article/Toast-Benchmarking-Advanced-Sales-Projections) | None found | |
| ClearCOGS | Predictive ingredient-usage forecasting, integrated with Toast — [Toast support](https://support.toasttab.com/en/article/Get-Started-with-the-ClearCOGS-Integration) | None found | |
| SevenRooms / OpenTable | Reporting on covers, no-shows and pacing that is "used for staffing". No covers-forecast model described. — [SevenRooms](https://sevenrooms.com/platform/table-management/); [OpenTable](https://www.opentable.com/restaurant-solutions/intel/) | None | |

### Inferences
- "95% accurate" is best read as about 5% MAPE or WAPE, probably at daily total-site level, which is the easiest level to forecast. Service-level forecasts (lunch, dinner, delivery) will have much higher error.
- The common baseline across vendors, the same-weekday four-week rolling average, gives Maginhawa a ready-made benchmark. Any model we build should be judged against it and against a seasonal-naive forecast.
- Manager override is a standard feature. Tenzo claims it improves accuracy.

### Gaps
- Nothing found on Restaurant365 or Avero forecasting methods.
- No independent or third-party audit of any vendor's accuracy.
- No vendor documents how it uses reservations or bookings as a covers-forecast input.

## 3. How companies handle prediction intervals and uncertainty, and how forecasts drive staffing

### Takeaway
The platforms treat uncertainty as essential: they publish quantile forecasts (P10, P50, P90) and use the upper quantiles to set capacity and buffers. Restaurant vendors, by contrast, mostly show a single point forecast that is converted into labour hours. Staffing is a downstream step after the forecast (forecast, then supply plan, then real-time adjustment).

### Cited Findings
- Uber says prediction intervals should always be reported. Two identical point forecasts can carry very different intervals, and a wider interval implies more reserve capacity. Interval width depends on data volume, variability, horizon and method. — [Uber Blog, 2018](https://www.uber.com/blog/forecasting-introduction/)
- Amazon's MQ-RNN/CNN directly outputs P10, P50 and P90 for each horizon, trained with quantile loss. Well-calibrated intervals were about half as wide as a mis-specified parametric benchmark. — [arXiv 1711.11053](https://arxiv.org/pdf/1711.11053)
- DeepAR produces full predictive distributions for inventory decisions. — [arXiv 1704.04110](https://arxiv.org/pdf/1704.04110)
- The M5 Uncertainty track scored quantiles at levels from 0.005 to 0.995 across the hierarchy. — [M5 Uncertainty results](https://pure.unic.ac.cy/en/publications/the-m5-uncertainty-competition-results-findings-and-conclusions/)
- Instacart uses q=0.9 quantile regression for delivery-time upper bounds. Its staffing is planned in stages (forecast, then supply planning, then real-time capacity) and measured on idleness against unmet demand. — [Instacart quantile regression](https://tech.instacart.com/how-instacart-delivers-on-time-using-quantile-regression-2383e2e03edb); [Instacart staffing](https://tech.instacart.com/no-order-left-behind-no-shopper-left-idle-24ba0600f04f)
- DoorDash forecasts feed Dasher recruitment and extra-pay decisions. (via search extract) — [DoorDash](https://careersatdoordash.com/?p=9878)
- Grubhub sets driver schedules from forecasts and updates earlier forecasts as new information arrives. — [NRN](https://www.nrn.com/supplier-news/piping-hot-food-delivered-fast-with-cutting-edge-forecasting)
- Restaurant vendors (Tenzo, Fourth, 7shifts, Nory, Lineup) tie forecasts to labour scheduling and productivity. Tenzo's Nando's case reports +15% labour productivity. — [Tenzo Nando's PDF](https://www.gotenzo.com/wp-content/uploads/2023/05/Nandos-Case-Study.pdf); [Fourth](https://fourth.com/solution/workforce-management/labor-forecasting)

### Inferences
- For rota decisions, a P50 forecast plus a P80 or P90 "busy-case" figure per service is the platform pattern, scaled down. LightGBM supports quantile objectives, and empirical residual quantiles from backtests are a cheaper alternative.
- Staffing should be a separate rule layer, for example covers per server or sales per labour hour, applied to the forecast. That keeps the forecasting model simple and auditable.

### Gaps
- No vendor documents whether it shows uncertainty bands to managers.
- No public source describes an asymmetric cost of under-staffing versus over-staffing for restaurants specifically.

## 4. Lessons on simple vs complex models, cold start, holidays and special days

### Takeaway
Simple baselines are hard to beat with little data or low volume. Tree models need explicit help on holidays (DoorDash adds a linear "cascade" layer). Cold start is handled by pooling across similar series or stores and by requiring a minimum history (vendors ask for 30 to 90 days).

### Cited Findings
**Simple vs complex**
- Uber says classical methods are simpler, more interpretable and faster, while ML is more flexible but opaque. Its advice is to compare several methods on the same data, always against a naive or seasonal-naive benchmark. — [Uber Blog, 2018](https://www.uber.com/blog/forecasting-introduction/)
- Uber recommends chronological backtests with sliding or expanding windows, using an expanding window when data is limited. It built a parallel backtesting framework, "Omphalos". — [Uber Blog, 2018](https://www.uber.com/blog/forecasting-introduction/)
- In meal delivery, exponential smoothing on demand history was optimal below a daily-volume threshold, and ML only became competitive above it. — [Hess et al. preprint](https://code.webartifex.biz/alexander/urban-meal-delivery-demand-forecasting/raw/tag/v0.1.0/paper.pdf)
- In M5, cross-learning LightGBM won at Walmart scale. — [M5 results](https://ideas.repec.org/a/eee/intfor/v38y2022i4p1346-1364.html)

**Holidays and special days**
- DoorDash reports that gradient boosting and XGBoost struggle on high-variance, data-poor holiday periods. Its fix is a cascade: a linear model handles holiday effects alongside the GBM, which it says substantially improved holiday accuracy. (via search extract) — [DoorDash holiday cascade](https://careersatdoordash.com/blog/how-doordash-improves-holiday-predictions-via-cascade-ml-approach/)
- Uber built LSTM models specifically for "extreme events" such as holidays. — [Uber Research, 2017](https://eng.uber.com/research/time-series-extreme-event-forecasting-with-neural-networks-at-uber/)
- Lineup.ai reports that about 33% of restaurant days fall more than 20% away from the four-week rolling average. It positions event and weather data as the fix. — [BusinessWire, 2020](https://www.businesswire.com/news/home/20201209005074/en)
- Toast's forecast excludes weather and events and asks users to adjust manually. 7shifts attributes its misses to unusual weather and volume swings. — [Toast support](https://support.toasttab.com/fr-CA/article/Toast-Benchmarking-Advanced-Sales-Projections); [7shifts KB](https://kb.7shifts.com/hc/en-us/articles/14620377028627)

**Cold start**
- Vendor minimum-history requirements: Tenzo 90 days, Toast 30 days. — [Tenzo support](https://support.gotenzo.com/docs/forecasting-your-future-sales/); [Toast support](https://support.toasttab.com/fr-CA/article/Toast-Benchmarking-Advanced-Sales-Projections)
- General cold-start techniques are padding, feature engineering, borrowing from similar items or stores, and transfer learning. — [PyCon DE 2024 talk](https://2024.pycon.de/program/H3X3AX/); [DataRobot cold-start accelerator](https://docs.datarobot.com/en/docs/api/accelerators/use-cases-accel/cold-start.html)
- A Quantiphi engine claims "Day 1" forecasts for new stores. This is a vendor claim reported via a search summary.
- Cross-learning (one global model across series), as used by the M5 winners, is what lets new series borrow strength from existing ones. — [M5 results](https://ideas.repec.org/a/eee/intfor/v38y2022i4p1346-1364.html)

### Inferences
- For Maginhawa, the evidence points to:
  - Baselines: seasonal-naive and the same-weekday four-week average.
  - Simple statistical models: ETS or a regression model per series.
  - One global LightGBM model across all 27 site-service series, with holiday and event flags, weather, and site and service as categorical features.
  - A separate holiday and special-day adjustment, either a linear layer or explicit multipliers, because trees extrapolate poorly on rare days.
- A new site can use the global model with site-level features (size, format, location type), scaled to early actuals, until about 60 to 90 days of history exist.
- Metric choice matters. Vendors' "95%" figures are not comparable. Pick one metric, such as WAPE per service per day, and backtest with a rolling origin.

### Gaps
- No public restaurant-specific study compares simple and ML methods at single-site, per-service granularity.
- No large company documents its cold-start method for new restaurant sites.
- No source found on how UK bank holidays, Ramadan or other London-specific calendar effects are modelled by UK vendors.
