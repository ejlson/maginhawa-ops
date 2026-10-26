"""Builds the ER diagrams (Mermaid) from ../sharepoint/sharepoint-lists.json."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
spec = json.load(open(os.path.join(HERE, "..", "sharepoint", "sharepoint-lists.json")))
lists = {l["name"]: l for l in spec["lists"]}
# extra entity: the Policies document library (referenced by PolicyAcknowledgements)
lists["Policies"] = dict(group="People & handbook", name="Policies", columns=[
    dict(name="Title", type="Text", notes="", flags="R"), dict(name="Category", type="Choice", notes="", flags=""),
    dict(name="RequiresAck", type="Yes/No", notes="", flags=""), dict(name="AppliesToRoles", type="Choice (multi)", notes="", flags=""),
    dict(name="VersionLabel", type="Text", notes="", flags="")])
# relationships that are not SharePoint lookups (stored as item ids)
EXTRA = [("Checkpoints", "Responses", "CheckpointId", "||--o{"), ("Responses", "Responses", "Supersedes", "|o--o|"),
         ("Responses", "WorkOrders", "SourceResponse", "|o--o{"), ("Policies", "PolicyAcknowledgements", "PolicyFileId", "||--o{")]
EXTRA_FK = {(c, f) for _, c, f, _ in EXTRA}
TYPES = {"Text": "Text", "Multi-line text": "Note", "Multi-line text (append)": "Note", "Number": "Number", "Currency": "Currency",
         "Choice": "Choice", "Choice (multi)": "MultiChoice", "Date": "Date", "Date/Time": "DateTime", "Yes/No": "YesNo", "Hyperlink": "Link"}
CLASS = {"Reference": "ref", "Checklists": "chk", "Maintenance": "mnt", "Trading (EOD)": "trd", "People & handbook": "ppl"}
CLASSDEF = """  classDef ref fill:#ebe9fb,stroke:#5b52b8,color:#1b1640
  classDef chk fill:#e3f4f1,stroke:#1f6f5c,color:#0f2e27
  classDef mnt fill:#e5effa,stroke:#2d6ab0,color:#0f2440
  classDef trd fill:#e8f5e2,stroke:#3d8b37,color:#16330f
  classDef ppl fill:#fdf2df,stroke:#b7791f,color:#3d2a08
  classDef rst fill:#fde8e8,stroke:#b71c1c,color:#4a0b0b"""

def ty(t):
    if t.startswith("Lookup (multi)"): return "MultiLookup"
    if t.startswith("Lookup"): return "Lookup"
    return TYPES.get(t, re.sub(r"\W", "", t))

def entity(name, full=True):
    l = lists[name]; rows = ["    Number ID PK \"SharePoint item id\""]
    if full:
        for c in l["columns"]:
            keys = []
            if c["type"].startswith("Lookup") or (name, c["name"]) in EXTRA_FK: keys.append("FK")
            if "U" in c["flags"]: keys.append("UK")
            cm = []
            if "R" in c["flags"]: cm.append("required")
            if "I" in c["flags"] and "U" not in c["flags"]: cm.append("indexed")
            if "F" in c["flags"]: cm.append("set by flow")
            if c["name"] == "Title" and "Key =" in c["notes"]: cm.append(c["notes"].split("=")[1].split("(")[0].strip().replace("|", " + "))
            k = (" " + ",".join(keys)) if keys else ""
            cmt = f' "{", ".join(cm)}"' if cm else ""
            rows.append(f"    {ty(c['type'])} {c['name']}{k}{cmt}")
    return f"  {name} {{\n" + "\n".join(rows) + "\n  }"

def relations(names):
    rel = {}
    for n in names:
        for c in lists[n]["columns"]:
            m = re.match(r"Lookup(?: \(multi\))? → (\w+)", c["type"])
            if m and m.group(1) in names:
                p = m.group(1); card = "}o--o{" if "multi" in c["type"] else "||--o{"
                rel.setdefault((p, n, card), []).append(c["name"])
    for p, c, f, card in EXTRA:
        if p in names and c in names: rel.setdefault((p, c, card), []).append(f)
    return [f'  {p} {card} {c} : "{", ".join(sorted(set(v)))}"' for (p, c, card), v in rel.items()]

def classes(names, full_names):
    out = []
    for n in names:
        cl = "rst" if n == "FitnessToWork" else CLASS[lists[n]["group"]]
        out.append(f"  class {n} {cl}")
    return out

def diagram(names, stubs=()):
    allnames = list(names) + [s for s in stubs if s not in names]
    body = [entity(n, full=n in names) for n in allnames]
    return "erDiagram\n" + "\n".join(relations(set(allnames))) + "\n" + "\n".join(body) + "\n" + CLASSDEF + "\n" + "\n".join(classes(allnames, names)) + "\n"

groups = {}
for n, l in lists.items(): groups.setdefault(l["group"], []).append(n)
# full poster
open(os.path.join(HERE, "erd-full.mmd"), "w").write(diagram(list(lists)))
# per-group diagrams with stubs for referenced entities from other groups
def refs(names):
    s = set()
    for n in names:
        for c in lists[n]["columns"]:
            m = re.match(r"Lookup(?: \(multi\))? → (\w+)", c["type"])
            if m and m.group(1) not in names: s.add(m.group(1))
    for p, c, f, card in EXTRA:
        if c in names and p not in names: s.add(p)
        if p in names and c not in names: s.add(c)
    return sorted(s)
slug = {"Reference": "1-reference", "Checklists": "2-checklists", "Maintenance": "3-maintenance", "Trading (EOD)": "4-trading", "People & handbook": "5-people"}
for g, names in groups.items():
    open(os.path.join(HERE, f"erd-{slug[g]}.mmd"), "w").write(diagram(names, refs(names)))
print({g: len(v) for g, v in groups.items()}, "total", len(lists))
