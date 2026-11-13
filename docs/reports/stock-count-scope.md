# Stock count module: scope

*Draft, 12 Nov 2026. Not agreed with the client yet. All figures are examples.*

**Status, 13 Nov 2026: phase 1 built in demo mode** (data on the device, like food safety). Rules and tests: `packages/core/src/stock.ts`. Screens: `/stock` (anyone), `/stock/count/:id`, `/stock/count/:id/area/:area` (one item at a time), `/stock/count/:id/send`, and for head office `/head-office/stock` and `/head-office/stock/items`. Permissions: `can.countStock`, `correctStock`, `seeStockValue`, `editStockItems` in `apps/eod-web/app/lib/auth.ts`. **Not done yet:** connected mode (SharePoint lists), seeing who is counting on another device live, managers editing areas and shelf order, typing purchases, and GP% (phase 2).

## Why

Stock counts tell each site what's on the shelves and what it's worth. Add the sales the EOD already collects and you get the figure finance cares about: **gross profit (GP%) per site per period**. Spot counts of costly items (spirits, meat, seafood) also catch waste and theft early.

## What's already in the app

| Already built | How stock counts use it |
|---|---|
| EOD net sales per day (`packages/core`) | The sales side of GP% |
| **Suppliers** and **Deliveries** lists (food safety, §8a) | Become "goods in" (purchases), once each delivery line has a cost |
| Void codes split into waste (W) and no-waste | A rough waste figure until a proper waste log exists |
| Handover note type "Stock" | Stays for "low on limes" notes; no change |
| Checklist **Number** check | Can run spot counts today with no new build (phase 0) |

## Who can count

**Anyone** (user's decision, 12 Nov 2026): staff, supervisors, managers and head office can all start, count and submit a stock count for the sites they have access to. A correction after submitting needs supervisor or above, with a reason, as with food-safety records. Item lists, costs and count schedules stay with head office (and managers for their own site's areas and shelf order).

## How it works on the floor

1. **Start a count.** Choose Full stocktake or Spot count. The count opens on the date it's for, with the time taken from the server.
2. **Count by area, in shelf order.** Walk-in → Freezer → Dry store → Bar → Cellar. Each area is a list. Each item has big number fields in its own units (*3 cases + 7 bottles*), and spirits allow tenths of a bottle (0.4). Enter moves to the next item, as with temperatures.
3. **Several people at once.** Two people can count different areas on two devices. Each area shows who is counting it, and each line keeps the latest answer (the sync rules in §4).
4. **Review.** One main card shows the stock value and the change since the last count. Below it, a list of big swings ("Prosecco: 4 bottles, usually 18 · Check") and items with no cost. Each one can be marked **It's right** or **Fix**, as in the EOD.
5. **Submit.** The count is locked. After that, a correction needs a reason and adds a new version, the same rule as food-safety records.

It works offline in a cold walk-in with no signal: drafts are saved on the device and sent later.

## What head office gets

- Stock value per site, for the latest count and over time.
- **GP% per period:** cost of sales = opening stock + purchases − closing stock (+/− transfers). GP% = (net sales − cost of sales) ÷ net sales.
- A variance list across sites: the biggest swings and items left uncounted.
- Item list and costs: one group list, with each site choosing the items it stocks and its storage areas.
- CSV export, with the same SharePoint and Power Query route as the EOD.

## Calculations (`packages/core`, unit-tested)

| Figure | Rule |
|---|---|
| Line quantity | Cases × pack size + units + part units, in the item's base unit |
| Line value | Quantity × unit cost (ex VAT) at the time of the count |
| Stock value | Sum of the line values |
| Cost of sales | Opening value + purchases in the period − closing value ± transfers |
| GP% | (Net sales − cost of sales) ÷ net sales. Net sales are the EOD day totals for the period |
| Swing warning | Quantity differs from the item's last 4 counts by more than a threshold (head office sets it) |

## Data (SharePoint lists, following the §4 rules)

| List | Holds | Rough size |
|---|---|---|
| `StockItems` | Name, category, base unit, pack size, unit cost, supplier, active | About 400 rows |
| `SiteStockItems` | Which items each site stocks, its storage area and its shelf order | About 3k rows |
| `StockCounts` | Site, date, type (full/spot), status, totals (*set by server*). Unique `Site\|date\|type` | About 200 a year |
| `StockCountLines` | Count, item, quantity, cost used, who, when | About 100k a year (full counts every 4 weeks plus daily spot counts) |
| `StockCostHistory` | Every change to an item's cost | Small |

**Later:** `StockWaste` and `StockTransfers`. A cost column on `DeliveryItems` would bring purchases in automatically.

## Phases

| Phase | What | Rough effort |
|---|---|---|
| **0 · Now, no build** | A "Bar spot count" checklist using **Number** checks for 10–20 costly items | Set up in the checklist builder |
| **1 · Stocktake** | Item list and costs (head office), count by area, offline, review, submit and lock, stock value, head-office view, CSV export. Purchases are typed in per period | About 3 weeks |
| **2 · GP and waste** | GP% from EOD sales, purchases taken from deliveries with costs, a waste log (replacing the void-code guess), transfers between sites, swing warnings | About 3 weeks |
| **3 · Ordering** | Par levels, "order this" suggestions per supplier, low-stock alert to the opener | About 2 weeks |
| **Later** | Invoice capture (photo → lines), recipe costing, and theoretical vs actual usage. That last one needs till data, which v1 deliberately leaves out (§3 decision 5) | — |

These assume one developer. They should fit after the EOD roll-out (Jan 2027), alongside the Mar–Apr modules in §9.

## Open questions for the client

1. **How do sites count today?** On a spreadsheet, on paper, or through an external stocktaker? If an external firm does the 4-weekly count, phase 1 may only need spot counts and the GP view.
2. **How often?** Full counts weekly or every 4 weeks, and which spot counts and how often.
3. **Where do costs come from?** Supplier price lists, an accounting tool (Xero, Dext…), or typed in by hand?
4. Is there a group item list already, or does each site have its own?
5. Do sites move stock between each other (for example the three Mamasons)?
6. Should a count be blocked if the probe or fridge checks failed that day? (Probably no, but worth asking.)
