# Per-site recipes and stock items

16 Nov 2026. The user's decisions, which replace "one group item list" in `stock-count-scope.md` §2 and open question 4.

## Decisions

| | Who can change it | Scope |
|---|---|---|
| Stock items: name, unit, cost, whether it's counted | Supervisors, managers, head office | Each site has its own list |
| Recipes: name, section, ingredients and amounts, extras, steps and tips, plates a day | Supervisors, managers, head office | Each site has its own |
| Menu price | Head office only (Menu costing) | Per site |
| Allergens on a dish | Never removed in the editor. If an ingredient carries an allergen the dish doesn't list, the editor flags it and saving adds it, so a dish never reads "No listed allergens" when an ingredient carries one. The food-safety allergen record should be checked too; the two aren't linked yet. | — |

Head office sees Items and costs and Menu costing for one site at a time, with a site picker. The main card adds a group summary, such as dishes below target across all sites.

## How it's built

- **Data.** `StockItem` and `Recipe` gain `siteCode`. Item ids can repeat across sites ("pork" at Bunso and at Belly are separate items). Each is identified by site plus id, so counts, areas, pars, orders and waste keep working, since all of them already carry a site.
- **Migration.** Data saved before this change has no `siteCode`. On load, each item and recipe is copied to every site, so every site starts with today's group list and they drift apart from there. The demo data does the same.
- **Site screens** see only their own site's items and recipes. `useStock().data.items` and `useOps().data.recipes` are already filtered to the site.
- **Head office screens** read every site's items and recipes (`allItems`, `itemsFor(site)`, `recipesFor(site)`). Core functions that value a count (`countValue`, `costsNow`, `stockCsv`, `areasFor`) only look at items from that count's site.
- **New price accepted** (Ordering): it updates the item's cost at the site whose invoice showed it.
- **New screens:**
  - `/stock/items`: Items and costs at a site (supervisor and up). Head office's Items and costs gets a site picker.
  - `/recipes/new` and `/recipes/:id/edit`: the recipe editor (supervisor and up). Head office edits another site's recipe with `?site=CODE`, and also sees the price there.

## Not in this change

- A site opened later starts with no items or recipes. It adds its own, and Log waste says so until it has some.
- A new dish has no price until head office sets one. Menu costing shows it as "No price yet", not below target.
- Copying a recipe or item from one site to another.
- A history of who changed a recipe. To follow with the SharePoint lists.
- Supplier pack prices per site. They stay per supplier.
