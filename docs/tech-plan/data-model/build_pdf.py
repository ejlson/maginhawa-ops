import html, json, os
H = os.path.dirname(os.path.abspath(__file__))
STICKY = {
 "Sites": "Is EPOS 'gross' before or after discounts? This sets NetSalesRule for each site.",
 "Staff": "Kiosk-only staff have no Microsoft account. Confirm device-account licensing and the PIN reset process.",
 "RulesThresholds": "Every value starts unverified until a food-safety consultant signs off. Scotland reheat 82°C?",
 "Targets": "What does finance's targets workbook look like? One row per site per day? Which columns?",
 "ReasonCodes": "Discounts and comps share one reason list in the current form. Keep them separate?",
 "Responses": "Largest list (~300k a year). Archive yearly. Is a Purview 'record' label available on our plan?",
 "ChecklistRuns": "Add an event time to everything for a per-site timeline? BusinessDate + Created + ClientRecordedAt already exist.",
 "Checkpoints": "Which media formats for how-to guidance: images, short videos, PDFs? Size limits?",
 "WorkOrders": "How do contractors update jobs: reply to the email, or a Microsoft Forms link?",
 "ComplianceItems": "Inspection intervals to verify: gas CP42, TR19, EICR, fire alarm, LOLER, PSSR, legionella.",
 "TradingSessions": "Do any sites need an 'All day' session instead of a lunch/dinner split?",
 "DeliverySales": "Keep the 55% estimate, or capture actual payouts weekly from platform statements?",
 "ShiftStaff": "Hours and wage cost from a rota system later (Deputy / RotaCloud?)",
 "PolicyAcknowledgements": "Re-sign on every major version, or only for policies flagged RequiresAck?",
 "FitnessToWork": "Special category (health) data: confirm lawful basis, who can see it, retention. Never sent to AI.",
 "Policies": "Not yet modelled: allergen matrix, tip allocations, ERA 2025 holiday records (phase 2).",
}
GROUPS = [("1-reference", "Reference data", "Set up once and rarely changed: the restaurants, people, devices, food-safety limits, reason codes, delivery platforms and daily targets. Sites is the hub entity: almost every other list looks up to it.", ["Sites", "Staff", "Devices", "RulesThresholds", "ReasonCodes", "DeliveryPlatforms", "Targets"]),
 ("2-checklists", "Checklists and the compliance record", "Templates hold versioned checkpoints (the customisable questions with guidance and media). Each morning a ChecklistRun is created per schedule. Every answer is a Response, and failures create CorrectiveActions. Entities shown with only their ID belong to other areas.", ["ChecklistRuns", "Checkpoints", "Responses"]),
 ("3-maintenance", "Repairs and maintenance", "Assets (with QR codes), contractors, work orders and their invoices, the statutory compliance calendar and the visitor log. Work orders can come from failed responses, corrective actions or EOD feedback.", ["WorkOrders", "ComplianceItems"]),
 ("4-trading", "Trading / EOD (finance)", "One TradingDay per site per date, holding lunch/dinner TradingSessions with their discounts, comps and voids (Adjustments), the staff on shift, delivery sales and refunds, and feedback. Columns marked 'set by flow' are written by Power Automate flow F01.", ["TradingSessions", "DeliverySales", "ShiftStaff", "ReasonCodes"]),
 ("5-people", "People and handbook", "The policies library with versioned documents and e-signed acknowledgements, staff certificates, and the restricted fitness-to-work list.", ["PolicyAcknowledgements", "FitnessToWork", "Policies"]),
]
PERSONAL = ["Staff identifiers: name, work email / Microsoft account, home site",
 "Employment details: department, position, app role, shifts worked and hours",
 "Authentication data: kiosk PIN (stored only as a hash), device used",
 "Activity records: who recorded, completed, approved or voided what, with timestamps",
 "Training and qualifications: certificate types, issue and expiry dates, scans",
 "Guest data (minimal): guest names entered for comps, discounts, complaints and refunds",
 "Contractor and visitor details: names, company, phone, email, visit times",
 "Photos: check and fault photos (may incidentally show people)",
 "Special category data (restricted access):", "◦ Health data: fitness-to-work / illness exclusions", "◦ Health data: visitor and contractor health declarations"]
KEY = [("#ebe9fb", "#5b52b8", "Reference data"), ("#e3f4f1", "#1f6f5c", "Checklists & compliance record"), ("#e5effa", "#2d6ab0", "Repairs & maintenance"),
       ("#e8f5e2", "#3d8b37", "Trading / EOD (finance)"), ("#fdf2df", "#b7791f", "People & handbook"), ("#fde8e8", "#b71c1c", "Restricted / special category")]
def key_html():
    rows = "".join(f"<div class='kr'><span class='sw' style='background:{f};border-color:{s}'></span>{t}</div>" for f, s, t in KEY)
    return f"""<div class='key'><h3>Diagram key</h3>{rows}
<div class='kr'><span class='sticky mini'></span>Open question to resolve</div>
<p><b>PK</b> SharePoint item id &nbsp; <b>FK</b> lookup to another list &nbsp; <b>UK</b> unique (enforce unique values)</p>
<p><b>Types</b> are SharePoint column types: Text, Note (multi-line), Number, Currency, Choice, MultiChoice, Date, DateTime, YesNo, Link, Lookup.</p>
<p><b>Lines</b> (crow's foot): <b>||</b> exactly one · <b>|o</b> zero or one · <b>o{{</b> zero or many. Comments: <i>required</i>, <i>indexed</i>, <i>set by flow</i> (written only by Power Automate), key pattern.</p></div>"""
def personal_html():
    lis = "".join(f"<li class='{'sub' if p.startswith('◦') else ''}'>{html.escape(p.lstrip('◦ '))}</li>" for p in PERSONAL)
    return f"<div class='pd'><h3>Categories of personal data</h3><p>The following types of personal data are processed (UK GDPR). Lawful basis and retention are to be confirmed:</p><ul>{lis}</ul></div>"
def stickies(names):
    return "".join(f"<div class='sticky'><b>{n}</b><br>{html.escape(STICKY[n])}</div>" for n in names if n in STICKY)
CSS = """
body{margin:0;font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif;color:#1d2433;background:#fff}
@page poster{size:1700mm 900mm;margin:12mm}
@page dom{size:A3 landscape;margin:10mm}
.poster{page:poster;display:grid;grid-template-columns:330mm 1fr;gap:12mm;height:874mm;page-break-after:always}
.side h1{font-size:30pt;margin:0 0 2mm;color:#1b1640}.side .sub{font-size:13pt;color:#556;margin:0 0 8mm}
.key,.pd{border:1px solid #dcdfe5;border-radius:4mm;padding:5mm 6mm;margin-bottom:7mm;font-size:12pt;line-height:1.45}
.key h3,.pd h3{margin:0 0 3mm;font-size:16pt;color:#1f3a8a}.pd h3{color:#1e40af}
.kr{display:flex;align-items:center;gap:4mm;margin:2mm 0}.sw{display:inline-block;width:14mm;height:7mm;border:2px solid;border-radius:1.5mm}
.pd ul{margin:2mm 0 0 6mm;padding:0}.pd li{margin:1mm 0}.pd li.sub{margin-left:8mm;list-style:circle}
.qs{display:grid;grid-template-columns:1fr 1fr;gap:5mm}
.sticky{background:#fff3a6;box-shadow:2px 3px 6px rgba(0,0,0,.18);padding:4mm 5mm;font-size:11pt;line-height:1.35;border-radius:1mm;transform:rotate(-0.6deg)}
.sticky:nth-child(even){transform:rotate(0.7deg)}.sticky b{color:#5a4a00}
.sticky.mini{display:inline-block;width:14mm;height:7mm;padding:0;box-shadow:1px 2px 3px rgba(0,0,0,.2)}
.erd{display:flex;align-items:center;justify-content:center;border:1px solid #e3e7ec;border-radius:4mm;padding:4mm;min-height:0}
.erd img{max-width:100%;max-height:100%}
.dom{page:dom;height:277mm;display:flex;flex-direction:column;page-break-after:always}.dom:last-child{page-break-after:auto}
.dom .sec{color:#1f6f5c;font-size:9pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.dom h2{margin:1mm 0 2mm;font-size:18pt;color:#1b1640}.dom p{margin:0 0 3mm;font-size:10pt;color:#445;max-width:330mm}
.dom .body{flex:1;min-height:0;display:grid;grid-template-columns:1fr 70mm;gap:6mm}
.dom .erd{padding:3mm}.dom .stk{display:flex;flex-direction:column;gap:5mm;padding-top:2mm}.dom .sticky{font-size:9.5pt}
"""
poster = f"""<div class='poster'><div class='side'><h1>Data model v0.1</h1><p class='sub'>Restaurant operations app · SharePoint lists (Microsoft 365) · October 2026<br>32 entities: 31 lists + the Policies library. Generated from sharepoint-lists.json.</p>
{key_html()}{personal_html()}<h3 style='font-size:16pt;margin:0 0 4mm'>Open questions</h3><div class='qs'>{stickies(STICKY.keys())}</div></div>
<div class='erd'><img src='erd-full.svg'></div></div>"""
doms = "".join(f"""<div class='dom'><div class='sec'>Area {i+1} of {len(GROUPS)}</div><h2>{t}</h2><p>{d}{"" if i==1 else " Entities shown with only their ID belong to other areas."}</p><div class='body'><div class='erd'><img src='erd-{s}.svg'></div><div class='stk'>{stickies(st)}</div></div></div>""" for i, (s, t, d, st) in enumerate(GROUPS))
open(os.path.join(H, "Data model v0.1.html"), "w").write(f"<!doctype html><html><head><meta charset='utf-8'><title>Data model v0.1</title><style>{CSS}</style></head><body>{poster}{doms}</body></html>")
