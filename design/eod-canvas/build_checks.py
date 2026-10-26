"""Generates the Checks module boards (c01–c08) into design/eod-canvas.
All figures, names and limits are made-up examples."""
import json, os, sys

OUT = sys.argv[1]

# ---------- icons ----------
def svg(path, size=19, sw=1.6, vb=18):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 {vb} {vb}" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{path}"></path></svg>')

I = {
    'thermo': svg('M7.5 10.6V3.8a1.5 1.5 0 0 1 3 0v6.8a3 3 0 1 1-3 0zM9 12.5v-4'),
    'truck': svg('M1.5 4.5h9v7h-9zM10.5 7h3.5l2.5 2.5v2h-6M4.5 14.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM13 14.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'),
    'wrench': svg('M11.5 2.5a3.5 3.5 0 0 0-3.3 4.6L2.8 12.5a1.4 1.4 0 0 0 2 2l5.4-5.4a3.5 3.5 0 0 0 4.6-4.6l-2 2-1.8-.3-.3-1.8z'),
    'book': svg('M3 3.5h4.5A1.5 1.5 0 0 1 9 5v10a1.5 1.5 0 0 0-1.5-1.5H3zM15 3.5h-4.5A1.5 1.5 0 0 0 9 5v10a1.5 1.5 0 0 1 1.5-1.5H15z'),
    'list': svg('M6.5 4.5h9M6.5 9h9M6.5 13.5h9M2.5 4.5h.01M2.5 9h.01M2.5 13.5h.01'),
    'lock': svg('M4 8h10v7.5H4zM6 8V5.5a3 3 0 0 1 6 0V8'),
    'camera': svg('M2 6h3l1.5-2h5L13 6h3v9H2zM9 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'),
    'play': svg('M5.5 3.5l9 5.5-9 5.5z', 14, 1.6),
    'qr': svg('M2.5 2.5h5v5h-5zM10.5 2.5h5v5h-5zM2.5 10.5h5v5h-5zM10.5 10.5h2v2h-2zM13.5 13.5h2v2h-2z'),
    'flame': svg('M9 16a5 5 0 0 0 5-5c0-3-2.5-4.5-3-8-2 1.5-3 3.5-3 5-1-.5-1.5-1.5-1.5-2.5C5 7 4 8.8 4 11a5 5 0 0 0 5 5z'),
    'snow': svg('M9 2v14M3 5l12 8M15 5L3 13'),
    'broom': svg('M11 2.5l-4 7M4.5 9.5h6l1 6h-8zM6.5 12v3.5M8.5 12v3.5'),
    'cert': svg('M3 2.5h12v9H3zM6 6h6M6 8.5h4M7 11.5l-1 4 3-1.5 3 1.5-1-4'),
    'phone': svg('M4 2.5h3l1.5 4-2 1.2a8 8 0 0 0 3.8 3.8l1.2-2 4 1.5v3A1.5 1.5 0 0 1 14 15.5 11.5 11.5 0 0 1 2.5 4 1.5 1.5 0 0 1 4 2.5z'),
    'mail': svg('M2.5 4h13v10h-13zM2.5 4.5l6.5 5 6.5-5'),
    'bell': svg('M4.5 12.5V8a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5h-12zM7.5 15.5a1.5 1.5 0 0 0 3 0'),
    'grip': svg('M7 4.5h.01M11 4.5h.01M7 9h.01M11 9h.01M7 13.5h.01M11 13.5h.01', 16, 2.4),
    'plus': svg('M9 3v12M3 9h12', 16, 2),
    'check': svg('M3.5 9.5l3.5 3.5L14.5 5', 15, 2.4),
    'x': svg('M4.5 4.5l9 9M13.5 4.5l-9 9', 14, 2.4),
    'bang': svg('M9 3.5v6.5M9 13.8v.1', 15, 2.6),
    'clock': svg('M9 16a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM9 5v4l2.5 1.5'),
    'shield': svg('M9 2l6 2.5V9c0 3.5-2.5 6-6 7-3.5-1-6-3.5-6-7V4.5z'),
    'people': svg('M6.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 15c0-2.5 2-4.5 4.5-4.5S11 12.5 11 15M12 3.5a2.5 2.5 0 0 1 0 4.5M13.5 10.8c1.5.6 2.5 2.2 2.5 4.2'),
    'export': svg('M9 2.5v9M5.5 6L9 2.5 12.5 6M3 11v4.5h12V11'),
}
CHEV = '<svg class="chev" viewBox="0 0 8 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 1.5L6.5 7l-5 5.5"></path></svg>'
BACK = '<svg width="10" height="17" viewBox="0 0 11 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2L2 9l7 7"></path></svg>'

def circ(kind, size=24):
    v = f'width="{size}" height="{size}" viewBox="0 0 20 20" aria-hidden="true"'
    if kind == 'done':
        return f'<svg {v}><circle cx="10" cy="10" r="9" style="fill: var(--ok)"></circle><path d="M6 10.2l2.7 2.6L14 7.5" style="fill: none; stroke: #ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
    if kind == 'fail':
        return f'<svg {v}><circle cx="10" cy="10" r="9" style="fill: var(--bad)"></circle><path d="M7 7l6 6M13 7l-6 6" style="fill: none; stroke: #ffffff" stroke-width="1.8" stroke-linecap="round"></path></svg>'
    if kind == 'prog':
        return f'<svg {v}><circle cx="10" cy="10" r="8.6" style="fill: none; stroke: var(--warn)" stroke-width="1.6"></circle><path d="M10 10V4.4a5.6 5.6 0 0 1 0 11.2z" style="fill: var(--warn)"></path></svg>'
    if kind == 'due':
        return f'<svg {v}><circle cx="10" cy="10" r="8.6" style="fill: none; stroke: var(--bad)" stroke-width="1.6"></circle></svg>'
    if kind == 'skip':
        return f'<svg {v}><circle cx="10" cy="10" r="8.6" style="fill: none; stroke: var(--sec); opacity: 0.45" stroke-width="1.6" stroke-dasharray="2.5 2.5"></circle></svg>'
    return f'<svg {v}><circle cx="10" cy="10" r="8.6" style="fill: none; stroke: var(--sec); opacity: 0.45" stroke-width="1.6"></circle></svg>'

def row(lead, title, sub='', right='', href=None, chev=True, extra=''):
    tag = 'a' if href else 'div'
    h = f' href="{href}"' if href else ''
    r = f'<span class="rt">{right}{CHEV if chev and href else ""}</span>' if (right or (chev and href)) else ''
    s = f'<small>{sub}</small>' if sub else ''
    return f'<{tag} class="li"{h}>{lead}<span class="tx"><span>{title}</span>{s}{extra}</span>{r}</{tag}>'

def pie(kind): return f'<span class="pie">{circ(kind)}</span>'
def av(content, cls=''): return f'<span class="av {cls}">{content}</span>'

def page(fname, title, props, body, logic=None):
    logic = logic or "class Component extends DCLogic {\n  renderVals() { return { theme: this.props.dark ? 'dark' : '' }; }\n}"
    html = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
<link href="checks.css" rel="stylesheet">
</helmet>
{body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{json.dumps(props)}'>
{logic}
</script>
</body>
</html>
'''
    open(os.path.join(OUT, fname), 'w').write(html)

def P(w, h, dark=False):
    return {"dark": {"editor": "boolean", "default": dark}, "$preview": {"width": w, "height": h}}

# ---------- shared tablet sidebar ----------
CUR = ' aria-current="page"'
MUTED = ' style="color: var(--sec)"'
def kitchen_side(active):
    items = [('Today\'s checks', 'list', 'c01-KitchenToday.dc.html', '4 left'),
             ('Temperatures', 'thermo', 'c02-RunChecklist.dc.html', ''),
             ('Deliveries', 'truck', 'c01-KitchenToday.dc.html', ''),
             ('Report a fault', 'wrench', 'c03-FixFailed.dc.html', ''),
             ('Handbook', 'book', 'c01-KitchenToday.dc.html', '1 to sign')]
    nav = ''.join(
        f'<a class="si{" on" if n == active else ""}" href="{h}"{CUR if n == active else ""}>'
        f'<span style="color: var(--sec); display: flex">{I[i]}</span>{n}<small>{b}</small></a>' for n, i, h, b in items)
    return f'''<nav class="side" aria-label="Kitchen">
<div style="display: flex; flex-direction: column; gap: 4px; padding: 0 12px 8px"><span style="font-size: 15px; color: var(--sec)">Tuesday 6 October</span><span style="font-size: 28px; font-weight: 700; letter-spacing: -0.035em">Bunso kitchen</span></div>
<div style="display: flex; flex-direction: column; gap: 2px">{nav}</div>
<div style="margin-top: auto; display: flex; align-items: center; gap: 12px; padding: 0 12px">{av("RT", "ink")}<span class="tx"><span style="font-size: 15px">[CDP]</span><small>Locks after 2 min idle</small></span><a href="l02-Pin.dc.html" style="color: var(--sec); display: flex" aria-label="Lock now">{I["lock"]}</a></div>
</nav>'''

# ======================= c01 Kitchen iPad · Today's checks =======================
c01 = f'''<div class="tb {{{{theme}}}}">
{kitchen_side("Today's checks")}
<main class="main">
<div class="top"><span style="font-size: 17px; font-weight: 600">Today's checks</span><span style="font-size: 13px; color: var(--sec)"><span class="dot ok"></span>Saved on this iPad · 14:12</span></div>
<div class="cont">
<div class="hero">
<div style="display: flex; flex-direction: column; gap: 12px; min-width: 300px">
<span class="hl">Checks done today</span>
<div class="big"><b>6</b><i>&nbsp;of 10</i></div>
<div class="segs" style="width: 300px"><span class="d"></span><span class="x"></span><span class="d"></span><span class="d"></span><span class="d"></span><span class="d"></span><span></span><span></span><span></span><span></span></div>
</div>
<div style="display: flex; gap: 22px">
<span class="hs" style="color: var(--heroBad)">1<small>Failed · walk-in fridge</small></span>
<span class="hs">14:40<small>Re-check due</small></span>
<span class="hs">15:00<small>Next · hot holding</small></span>
</div>
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 48px; align-items: start">
<section class="grp">
<div class="hd"><h2>To do</h2><span>4 left</span></div>
<div class="sub">
<div class="sl"><span>Now</span></div>
{row(pie("due"), "Re-check walk-in fridge", "From this morning's failed check · due 14:40", '<span class="pill p-bad">Due in 28 min</span>', "c02-RunChecklist.dc.html")}
{row(pie("todo"), "Hot holding temperatures", "Pass, bain-marie, soup well · due 15:00", '<span class="pill p-mut">In 48 min</span>', "c02-RunChecklist.dc.html")}
</div>
<div class="sub">
<div class="sl"><span>Later today</span></div>
{row(pie("todo"), "Closing checks", "12 checks · due 23:00", "23:00", "c02-RunChecklist.dc.html")}
{row(pie("todo"), "End-of-day cleaning", "8 tasks · due 23:30", "23:30", "c02-RunChecklist.dc.html")}
</div>
</section>
<section class="grp">
<div class="hd"><h2>Done</h2><span>6</span></div>
<div class="sub">
{row(pie("fail"), "Opening checks", "09:14 · [CDP] · 1 failed, action taken", "", "c02-RunChecklist.dc.html")}
{row(pie("done"), "Delivery · Brakes", "10:40 · [KP] · chilled 3.2°C", "", "c02-RunChecklist.dc.html")}
{row(pie("done"), "Morning fridge temperatures", "11:02 · [CDP] · all in range", "", "c02-RunChecklist.dc.html")}
{row(pie("done"), "Allergen briefing", "11:45 · signed by 6 people", "", "c02-RunChecklist.dc.html")}
</div>
<p class="note" style="margin: 0">+ 2 more done · cooling log, pre-service clean</p>
</section>
</div>
</div>
<div class="bar"><a class="btn b2" href="c01-KitchenToday.dc.html">Do an extra check</a><a class="btn b1" href="c02-RunChecklist.dc.html">Re-check walk-in fridge</a></div>
</main>
</div>'''
page('c01-KitchenToday.dc.html', "Kitchen iPad · Today's checks", P(1194, 834), c01)

# ======================= c02 Kitchen iPad · Doing a checklist (interactive) =======================
def temp_row(key, name, sub, limit_label):
    return (f'<label class="fr"><span class="tx"><span>{name}</span><small>{sub}</small></span>'
            f'<span style="display: flex; align-items: center; gap: 10px"><span class="pill {{{{t.{key}.pill}}}}">{{{{t.{key}.label}}}}</span>'
            f'<input class="in {{{{t.{key}.cls}}}}" type="text" inputmode="decimal" value="{{{{v.{key}}}}}" onChange="{{{{set.{key}}}}}" aria-label="{name} in degrees"></span></label>')

def yn_row(key, name, sub, how=False, photo=False):
    extra = ''
    if how: extra += f'<a class="how" href="c08-Builder.dc.html">{I["play"]}How to check</a>'
    if photo: extra += f'<a class="how" href="c02-RunChecklist.dc.html">{I["camera"]}Photo needed</a>'
    ex = f'<span style="display: flex; gap: 14px; margin-top: 2px">{extra}</span>' if extra else ''
    return (f'<div class="fr"><span class="tx"><span>{name}</span><small>{sub}</small>{ex}</span>'
            f'<span class="yn"><button class="y" aria-pressed="{{{{yn.{key}.y}}}}" onClick="{{{{yn.{key}.setY}}}}">Yes</button>'
            f'<button class="n" aria-pressed="{{{{yn.{key}.n}}}}" onClick="{{{{yn.{key}.setN}}}}">No</button></span></div>')

c02_side = f'''<nav class="side" aria-label="Checklist sections">
<a class="back" href="c01-KitchenToday.dc.html" style="padding: 0 4px">{BACK}Today's checks</a>
<div style="display: flex; flex-direction: column; gap: 4px; padding: 0 12px 8px"><span style="font-size: 15px; color: var(--sec)">Due 09:30 · started 09:02</span><span style="font-size: 28px; font-weight: 700; letter-spacing: -0.035em">Opening checks</span></div>
<div class="sg">Sections</div>
<div style="display: flex; flex-direction: column; gap: 2px">
<a class="si on" href="c02-RunChecklist.dc.html" aria-current="page">{circ("prog", 22)}Fridges &amp; freezers<small>{{{{fridgeDone}}}}</small></a>
<a class="si" href="c02-RunChecklist.dc.html">{circ("done", 22)}Kitchen safety<small>4 of 4</small></a>
<a class="si" href="c02-RunChecklist.dc.html">{circ("todo", 22)}Cleaning<small>0 of 3</small></a>
<a class="si" href="c02-RunChecklist.dc.html">{circ("todo", 22)}Pests &amp; premises<small>0 of 2</small></a>
</div>
<div style="margin-top: auto; display: flex; align-items: center; gap: 12px; padding: 0 12px">{av("RT", "ink")}<span class="tx"><span style="font-size: 15px">[CDP]</span><small>Doing this check</small></span></div>
</nav>'''

c02 = f'''<div class="tb {{{{theme}}}}">
{c02_side}
<main class="main">
<div class="top"><span style="font-size: 17px; font-weight: 600">Fridges &amp; freezers</span><span style="font-size: 13px; color: var(--sec)"><span class="dot ok"></span>Saved on this iPad · 09:14</span></div>
<div class="cont">
<div class="hero">
<div style="display: flex; flex-direction: column; gap: 12px; min-width: 300px">
<span class="hl">Opening checks</span>
<div class="big"><b>{{{{doneCount}}}}</b><i>&nbsp;of 12 done</i></div>
</div>
<div style="display: flex; gap: 22px">
<span class="hs">16 min<small>Left before 09:30</small></span>
<span class="hs" style="{{{{failStyle}}}}">{{{{failCount}}}}<small>Failed</small></span>
</div>
</div>
<div style="display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 48px; align-items: start">
<section class="grp">
<div class="gh"><h2>Temperatures</h2><p>Probe the middle of each unit and type the reading.</p></div>
<div class="sub">
{temp_row("walk", "Walk-in fridge", "8°C or below", "")}
{temp_row("reach", "Reach-in fridge 1", "8°C or below", "")}
{temp_row("freezer", "Freezer", "−18°C or below", "")}
</div>
<sc-if value="{{{{anyFail}}}}" hint-placeholder-val="{{{{ true }}}}">
<div style="display: flex; gap: 14px; align-items: flex-start; padding: 16px; border-radius: 18px; background: var(--badbg)">
<span class="av bad" style="background: var(--bg)">{I["bang"]}</span>
<span class="tx"><span style="font-weight: 600">{{{{failTitle}}}}</span><small style="color: var(--text); opacity: .75">Say what you did about it before you finish. A re-check is set for you.</small></span>
<a class="mini" href="c03-FixFailed.dc.html" style="background: var(--bad); color: #fff; display: flex; align-items: center; text-decoration: none; flex: none">Fix this</a>
</div>
</sc-if>
</section>
<section class="grp">
<div class="gh"><h2>Seals &amp; doors</h2><p>Tap Yes or No.</p></div>
<div class="sub">
{yn_row("seals", "Door seals clean, no gaps", "All fridges and freezers", how=True)}
{yn_row("covered", "Food covered and labelled", "Use-by dates on everything")}
{yn_row("floor", "Nothing stored on the floor", "Walk-in and dry store", photo=True)}
</div>
</section>
</div>
</div>
<div class="bar"><a class="btn b2" href="c01-KitchenToday.dc.html">Save for later</a><a class="btn {{{{nextCls}}}}" href="{{{{nextHref}}}}">{{{{nextLabel}}}}</a></div>
</main>
</div>'''

c02_logic = r'''class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { walk: '9.2', reach: '4.1', freezer: '-19', seals: 'y', covered: 'y', floor: '' };
  }
  renderVals() {
    const v = this.state;
    const num = (x) => { const r = parseFloat(String(x).replace('−', '-').replace(/[^0-9.\-]/g, '')); return isFinite(r) ? r : null; };
    const lim = { walk: 8, reach: 8, freezer: -18 };
    const t = {}; let fails = []; let filled = 0;
    const names = { walk: 'Walk-in fridge', reach: 'Reach-in fridge 1', freezer: 'Freezer' };
    Object.keys(lim).forEach((k) => {
      const n = num(v[k]);
      if (n === null) { t[k] = { pill: 'p-mut', label: 'To do', cls: '' }; return; }
      filled++;
      if (n > lim[k]) { t[k] = { pill: 'p-bad', label: 'Too warm', cls: 'bad' }; fails.push(names[k] + ' is ' + String(n).replace('-', '−') + '°C'); }
      else t[k] = { pill: 'p-ok', label: 'OK', cls: '' };
    });
    const set = {};
    Object.keys(lim).forEach((k) => { set[k] = (e) => this.setState({ [k]: e.target.value }); });
    const yn = {}; let ynDone = 0;
    ['seals', 'covered', 'floor'].forEach((k) => {
      if (v[k]) ynDone++;
      yn[k] = { y: v[k] === 'y' ? 'true' : 'false', n: v[k] === 'n' ? 'true' : 'false', setY: () => this.setState({ [k]: 'y' }), setN: () => this.setState({ [k]: 'n' }) };
    });
    const sectionDone = filled + ynDone;
    const done = 4 + sectionDone;
    const anyFail = fails.length > 0;
    const complete = sectionDone === 6;
    return {
      theme: this.props.dark ? 'dark' : '',
      v, t, set, yn,
      doneCount: String(done),
      fridgeDone: sectionDone + ' of 6',
      fridgeCirc: '',
      anyFail,
      failTitle: fails.join(' · ') + ' (limit 8°C)',
      failCount: String(fails.length),
      failStyle: anyFail ? 'color: var(--heroBad)' : '',
      nextCls: anyFail || !complete ? 'bd' : 'b1',
      nextHref: anyFail ? 'c03-FixFailed.dc.html' : 'c02-RunChecklist.dc.html',
      nextLabel: anyFail ? 'Fix the failed check first' : (complete ? 'Next: Cleaning' : (6 - sectionDone) + ' left in this section')
    };
  }
}'''
page('c02-RunChecklist.dc.html', 'Kitchen iPad · Opening checks', P(1194, 834), c02, c02_logic)

# ======================= c03 Fix a failed check (iPad sheet) =======================
c03 = f'''<div class="tb {{{{theme}}}}" style="background: rgba(0,0,0,.42); align-items: center; justify-content: center">
<div style="width: 900px; height: 740px; border-radius: 28px; background: var(--bg); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 40px 80px -20px rgba(0,0,0,.5)">
<div style="height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; flex: none; border-bottom: .5px solid var(--sep)">
<a href="c02-RunChecklist.dc.html" style="color: var(--link); text-decoration: none">Cancel</a><span style="font-weight: 600">Fix a failed check</span><span style="width: 52px"></span></div>
<div style="flex: 1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px; padding: 28px; overflow: hidden">
<div style="display: flex; flex-direction: column; gap: 36px">
<div class="hero" style="flex-direction: column; align-items: stretch; gap: 14px">
<span class="hl">Walk-in fridge · 09:14 · [CDP]</span>
<div class="big"><b style="color: var(--heroBad)">9.2</b><i>°C</i></div>
<span style="font-size: 14px; color: var(--herosec)">Limit is 8°C or below. 1.2°C too warm.</span>
</div>
<section class="grp">
<div class="gh"><h2>What did you do?</h2><p>Pick everything that applies.</p></div>
<div style="display: flex; flex-wrap: wrap; gap: 8px">
<sc-for list="{{{{acts}}}}" as="a" hint-placeholder-count="5"><button class="mini" aria-pressed="{{{{a.on}}}}" onClick="{{{{a.flip}}}}">{{{{a.label}}}}</button></sc-for>
</div>
<textarea class="ta" placeholder="Anything else? e.g. door was propped open during delivery" aria-label="Notes"></textarea>
</section>
</div>
<div style="display: flex; flex-direction: column; gap: 36px">
<section class="grp">
<div class="gh"><h2>Food</h2></div>
<div class="sub">
<div class="fr"><span class="tx"><span>Did any food go in the bin?</span><small>Follow your safe method for chilled food</small></span><span class="yn"><button class="y" aria-pressed="{{{{binN}}}}" onClick="{{{{setBinN}}}}">No</button><button class="n" aria-pressed="{{{{binY}}}}" onClick="{{{{setBinY}}}}">Yes</button></span></div>
<sc-if value="{{{{binned}}}}" hint-placeholder-val="{{{{ false }}}}"><textarea class="ta" placeholder="What and how much, e.g. 2 tubs of coleslaw" aria-label="Food thrown away" style="margin-top: 8px"></textarea></sc-if>
</div>
</section>
<section class="grp">
<div class="gh"><h2>Re-check</h2><p>We'll remind the kitchen iPad when it's due.</p></div>
<div class="sub">
<div class="fr"><span>Check again in</span><span class="seg"><sc-for list="{{{{times}}}}" as="m" hint-placeholder-count="3"><a href="c03-FixFailed.dc.html" class="{{{{m.on}}}}" onClick="{{{{m.pick}}}}">{{{{m.label}}}}</a></sc-for></span></div>
<div class="fr"><span style="color: var(--sec)">Due</span><span style="font-weight: 600">{{{{dueAt}}}}</span></div>
</div>
</section>
<section class="grp">
<div class="gh"><h2>Repair</h2></div>
<div class="sub">
<div class="fr"><span class="tx"><span>Report a fault on this fridge</span><small>Opens a repair job for Walk-in fridge · QR WF-01</small></span><button class="mini" aria-pressed="{{{{repair}}}}" onClick="{{{{flipRepair}}}}" style="flex: none">{{{{repairLabel}}}}</button></div>
</div>
</section>
</div>
</div>
<div style="height: 88px; flex: none; display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 0 28px; border-top: .5px solid var(--sep)">
<span style="font-size: 14px; color: var(--sec); margin-right: auto">{{{{footNote}}}}</span>
<a class="btn {{{{saveCls}}}}" href="c01-KitchenToday.dc.html">Save and set re-check</a></div>
</div>
</div>'''
c03_logic = r'''class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { acts: { 'Moved food to another fridge': true, 'Door was left open, closed it': false, 'Turned the thermostat down': true, 'Called the manager': false }, bin: 'n', mins: 30, repair: true };
  }
  renderVals() {
    const s = this.state;
    const acts = Object.keys(s.acts).map((k) => ({ label: k, on: s.acts[k] ? 'true' : 'false', flip: () => this.setState({ acts: Object.assign({}, s.acts, { [k]: !s.acts[k] }) }) }));
    const picked = Object.values(s.acts).filter(Boolean).length;
    const due = new Date(2026, 9, 6, 9, 14 + s.mins);
    const pad = (n) => String(n).padStart(2, '0');
    return {
      theme: this.props.dark ? 'dark' : '',
      acts,
      binY: s.bin === 'y' ? 'true' : 'false', binN: s.bin === 'n' ? 'true' : 'false', binned: s.bin === 'y',
      setBinY: () => this.setState({ bin: 'y' }), setBinN: () => this.setState({ bin: 'n' }),
      times: [15, 30, 60].map((m) => ({ label: m + ' min', on: s.mins === m ? 'on' : '', pick: (e) => { e.preventDefault(); this.setState({ mins: m }); } })),
      dueAt: pad(due.getHours()) + ':' + pad(due.getMinutes()) + ' today',
      repair: s.repair ? 'true' : 'false', repairLabel: s.repair ? 'Will report' : 'Report',
      flipRepair: () => this.setState({ repair: !s.repair }),
      saveCls: picked ? 'b1' : 'bd',
      footNote: picked ? 'Your manager sees this straight away.' : 'Pick at least one thing you did.'
    };
  }
}'''
page('c03-FixFailed.dc.html', 'Kitchen iPad · Fix a failed check', P(1194, 834), c03, c03_logic)

# ======================= c04 Phone · What needs you =======================
def act_row(kind, icon, title, sub, buttons):
    btns = ''.join(f'<a class="sm{" pri" if i == 0 else ""}" href="{h}" style="display: inline-flex; align-items: center; text-decoration: none">{b}</a>' for i, (b, h) in enumerate(buttons))
    return f'<div class="li" style="align-items: flex-start; padding: 14px 0">{av(icon, kind)}<span class="tx"><span style="font-weight: 600">{title}</span><small>{sub}</small><span class="acts">{btns}</span></span></div>'

c04 = f'''<div class="ph {{{{theme}}}}" style="min-height: 1300px">
<div class="nav" style="padding: 0 20px"><span style="font-size: 13px; color: var(--sec)"><span class="dot ok"></span>Updated 14:12</span><span style="font-weight: 600">Bunso</span><a href="c06-Compliance.dc.html" style="font-size: 17px; text-decoration: none; color: var(--link)">Sites</a></div>
<div class="body">
<div style="display: flex; flex-direction: column; gap: 20px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; color: var(--sec)">Tuesday 6 October</span><h1 style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.035em">Checks</h1><p style="font-size: 15px; color: var(--sec); margin: 4px 0 0; line-height: 1.4">Only what needs you. Everything else is on track.</p></div>
<div class="hero">
<span class="hl">Checks on time today</span>
<div class="big"><b>6</b><i>&nbsp;of 7 due so far</i></div>
<div class="segs"><span class="d"></span><span class="x"></span><span class="d"></span><span class="d"></span><span class="d"></span><span class="d"></span><span class="d"></span><span></span><span></span><span></span></div>
<div class="hm"><span style="color: var(--heroBad)">1<small>Failed</small></span><span>0<small>Missed</small></span><span>2<small>Repairs open</small></span></div>
</div>
</div>
<section class="grp">
<div class="hd"><h2>Needs you</h2><span>2</span></div>
<div class="sub">
{act_row("bad", I["thermo"], "Walk-in fridge 9.2°C at opening", "Food moved, thermostat turned down by [CDP]. Re-check due 14:40.", [("Sign off", "c04-ManagerFeed.dc.html"), ("See check", "c03-FixFailed.dc.html")])}
{act_row("warn", I["book"], "Allergen policy v3 not signed", "2 kitchen staff still to sign · changed 1 Oct", [("Remind them", "c04-ManagerFeed.dc.html")])}
</div>
</section>
<section class="grp">
<div class="hd"><h2>Repairs</h2><span>2 open</span></div>
<div class="sub">
{row(av(I["flame"]), "Fryer 2 · not heating", "Engineer booked Thu 8 Oct, 08:00", '<span class="pill p-ok">Booked</span>', "c05-Repair.dc.html")}
{row(av(I["snow"]), "Walk-in fridge · running warm", "Reported 09:20 · sent to [Contractor]", '<span class="pill p-warn">Waiting</span>', "c05-Repair.dc.html")}
</div>
</section>
<section class="grp quiet">
<div class="sub">
<div class="sl"><span>On track</span></div>
{row(pie("done"), "6 checks done on time", "Opening, delivery, fridges, allergens, cooling, clean", "", "c07-Grid.dc.html")}
{row(pie("todo"), "Next: hot holding at 15:00", "Then closing checks 23:00, cleaning 23:30", "", "c01-KitchenToday.dc.html")}
{row(av(I["cert"]), "Gas safety certificate", "Due in 23 days · [Contractor] booked", "", "c06-Compliance.dc.html")}
</div>
</section>
</div>
<div class="foot"><a class="btn b1" href="c05-Repair.dc.html">{I["qr"]}Report a fault</a></div>
</div>'''
page('c04-ManagerFeed.dc.html', 'Phone · Checks, what needs you', P(390, 1300), c04)

# ======================= c05 Phone · Repair job =======================
def step(kind, title, sub):
    return f'<div class="li" style="min-height: 60px">{pie(kind)}<span class="tx"><span{MUTED if kind == "todo" else ""}>{title}</span><small>{sub}</small></span></div>'

c05 = f'''<div class="ph {{{{theme}}}}" style="min-height: 1340px">
<div class="nav"><a class="back" href="c04-ManagerFeed.dc.html">{BACK}Checks</a><span style="font-weight: 600">Repair</span><span style="font-size: 13px; color: var(--sec)">RJ-0142</span></div>
<div class="body">
<div class="hero">
<div style="display: flex; justify-content: space-between; align-items: center"><span class="hl">Bunso · kitchen</span><span class="pill" style="background: rgba(255,105,97,.18); color: var(--heroBad)">Urgent</span></div>
<div style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 40px; font-weight: 600; letter-spacing: -0.045em; line-height: 1.05">Fryer 2</span><span style="font-size: 17px; color: var(--herosec)">Not heating past 120°C</span></div>
<div class="hm"><span>2 days<small>Open</small></span><span>Thu 08:00<small>Engineer visit</small></span><span>£0.00<small>Cost so far</small></span></div>
</div>
<section class="grp">
<div class="hd"><h2>Progress</h2><span>2 of 5</span></div>
<div class="sub">
{step("done", "Reported", "Mon 5 Oct, 18:20 · [Head chef] · 2 photos")}
{step("done", "Sent to contractor", "Mon 18:31 · emailed [Contractor] with photos and fryer details")}
{step("prog", "Visit booked", "Thu 8 Oct, 08:00 · they replied by email")}
{step("todo", "Fixed and checked", "Kitchen confirms it heats to temperature")}
{step("todo", "Invoice and cost", "Finance adds the cost to Fryer 2")}
</div>
</section>
<section class="grp">
<div class="hd"><h2>Details</h2></div>
<div class="sub">
<div class="li" style="align-items: flex-start; padding: 12px 0"><span style="display: flex; gap: 8px"><span style="width: 92px; height: 92px; border-radius: 14px; background: var(--fill); display: flex; align-items: center; justify-content: center; color: var(--sec)">{I["camera"]}</span><span style="width: 92px; height: 92px; border-radius: 14px; background: var(--fill); display: flex; align-items: center; justify-content: center; color: var(--sec)">{I["camera"]}</span></span></div>
{row(av(I["qr"]), "Fryer 2 · kitchen line", "QR FR-02 · under warranty until Mar 2027", "", "c08-Builder.dc.html")}
{row(av(I["thermo"], "bad"), "Linked check: hot holding failed", "Mon 18:00 · fries 52°C, limit 63°C", "", "c02-RunChecklist.dc.html")}
</div>
</section>
<section class="grp">
<div class="hd"><h2>Contractor</h2></div>
<div class="sub">
{row(av("CE", "ink"), "[Contractor]", "Catering equipment · replies by email, no login needed")}
{row(av(I["phone"]), "Call", "[phone number]", "", "c05-Repair.dc.html")}
{row(av(I["mail"]), "Send an update", "Adds to this job's history", "", "c05-Repair.dc.html")}
</div>
</section>
</div>
<div class="foot"><a class="btn b1" href="c04-ManagerFeed.dc.html">Mark as fixed</a><a class="btn b2" href="c05-Repair.dc.html" style="height: 44px; font-size: 15px">Add a note or photo</a></div>
</div>'''
page('c05-Repair.dc.html', 'Phone · Repair job', P(390, 1340), c05)

# ======================= desktop header =======================
def admin_top(active):
    tabs = [('Today', 'a01-Admin.dc.html'), ('Checks', 'c06-Compliance.dc.html'), ('Repairs', 'c05-Repair.dc.html'),
            ('Forecast', 'a03-AdminForecast.dc.html'), ('Reports', 'a01-Admin.dc.html'), ('Ask your logs', 'a01-Admin.dc.html'), ('Settings', 'a02-AdminSettings.dc.html')]
    t = ''.join(f'<a class="tab{" on" if n == active else ""}" href="{h}">{n}</a>' for n, h in tabs)
    return f'''<header class="atop">
<span style="font-size: 17px; font-weight: 700; letter-spacing: -0.02em">Maginhawa <span style="color: var(--sec); font-weight: 500">Head office</span></span>
<nav class="tabs" aria-label="Admin">{t}</nav>
<span style="margin-left: auto; display: flex; align-items: center; gap: 10px"><span style="font-size: 13px; color: var(--sec)">Admin</span><span class="av ink" style="width: 34px; height: 34px; font-size: 12px">AD</span></span>
</header>'''

def subnav(active):
    items = [('Overview', 'c06-Compliance.dc.html'), ('Grid', 'c07-Grid.dc.html'), ('Checklists', 'c08-Builder.dc.html')]
    return '<div class="seg">' + ''.join(f'<a class="{"on" if n == active else ""}" href="{h}">{n}</a>' for n, h in items) + '</div>'

# ======================= c06 Desktop · All sites compliance =======================
sites = [
    ('Ramo', 'R', '82%', 'warn', '0', '3', 'bad', '1', '—', 'Closing checks missed last night'),
    ('Bunso', 'B', '86%', 'warn', '1', '0', '', '2', '—', 'Walk-in fridge 9.2°C, re-check due'),
    ('Hoodwood', 'H', '96%', 'ok', '0', '1', 'warn', '0', 'Gas · 12 days', 'Certificate due soon'),
    ('Belly', 'Be', '97%', 'ok', '1', '0', '', '1', '—', 'Fryer quote waiting approval'),
    ('Guanabana', 'G', '98%', 'ok', '0', '0', '', '0', '—', 'All on track'),
    ('Bintang', 'Bi', '99%', 'ok', '0', '0', '', '1', '—', 'All on track'),
    ('Cafe Mamasons', 'CM', '100%', 'ok', '0', '0', '', '0', 'TR19 · 26 days', 'All on track'),
    ('Mamasons China Town', 'CT', '94%', 'ok', '1', '1', 'warn', '1', '—', 'Cooling log late'),
    ('Mamasons Kentish Town', 'KT', '91%', 'ok', '0', '2', 'warn', '0', '—', 'Hot holding late twice'),
]
COLS = 'minmax(240px,2.4fr) repeat(5,minmax(84px,1fr)) 20px'
rows_html = ''
for n, ini, ot, otc, fa, mi, mic, rep, cert, st in sites:
    tone = 'bad' if (fa != '0' or mi not in ('0',) and mic == 'bad') else ('warn' if mi != '0' or cert != '—' else 'm')
    rows_html += (f'<a href="c07-Grid.dc.html" style="display: grid; grid-template-columns: {COLS}; gap: 16px; align-items: center; min-height: 64px; color: var(--text); text-decoration: none; position: relative; border-top: .5px solid var(--sep)">'
                  f'<span style="display: flex; align-items: center; gap: 14px">{av(ini)}<span class="tx"><span style="font-weight: 600">{n}</span><small class="{tone}">{st}</small></span></span>'
                  f'<span style="text-align: right; font-weight: 600" class="{otc}">{ot}</span>'
                  f'<span style="text-align: right" class="{"bad" if fa != "0" else "m"}">{fa if fa != "0" else "—"}</span>'
                  f'<span style="text-align: right" class="{mic or "m"}">{mi if mi != "0" else "—"}</span>'
                  f'<span style="text-align: right" class="{"" if rep != "0" else "m"}">{rep if rep != "0" else "—"}</span>'
                  f'<span style="text-align: right" class="{"warn" if cert != "—" else "m"}">{cert}</span>{CHEV}</a>')

def attn(kind, ini, title, sub, btns):
    b = ''.join(f'<button class="sm{" pri" if i == 0 else ""}">{x}</button>' for i, x in enumerate(btns))
    return f'<div class="li" style="align-items: flex-start; padding: 12px 0; min-height: 0">{av(ini, kind)}<span class="tx"><span style="font-weight: 600">{title}</span><small style="white-space: normal">{sub}</small><span class="acts">{b}</span></span></div>'

c06 = f'''<div class="ad {{{{theme}}}}" style="min-height: 1060px">
{admin_top("Checks")}
<div class="wrap">
<div class="mainc">
<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; color: var(--sec)">Tuesday 6 October · 14:12</span><h1 style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.035em">Checks · all sites</h1></div>
<div style="display: flex; gap: 12px">{subnav("Overview")}<div class="seg"><a class="on" href="c06-Compliance.dc.html">Today</a><a href="c06-Compliance.dc.html">Week</a><a href="c06-Compliance.dc.html">Month</a></div></div>
</div>
<div class="hero">
<div style="display: flex; flex-direction: column; gap: 10px">
<span class="hl">Checks done on time · 9 sites</span>
<div class="big"><b>94</b><i>%</i></div>
<span style="font-size: 14px; color: var(--herosec)">63 of 67 due so far today</span>
</div>
<div style="display: flex; gap: 22px; align-items: flex-end">
<span class="hs" style="color: var(--heroBad)">3<small>Failed</small></span>
<span class="hs" style="color: var(--heroWarn)">7<small>Late or missed</small></span>
<span class="hs">6<small>Repairs open</small></span>
<span class="hs">2<small>Certificates due in 30 days</small></span>
</div>
</div>
<section class="grp" style="gap: 8px">
<div class="hd"><h2>Sites</h2><span>Worst first · example figures</span></div>
<div>
<div style="display: grid; grid-template-columns: {COLS}; gap: 16px; font-size: 12px; color: var(--sec); padding-bottom: 8px"><span>Site</span><span style="text-align: right">On time</span><span style="text-align: right">Failed</span><span style="text-align: right">Late / missed</span><span style="text-align: right">Repairs</span><span style="text-align: right">Certificates</span><span></span></div>
{rows_html}
</div>
</section>
</div>
<aside class="rail">
<div class="panel">
<div class="hd" style="padding-bottom: 4px"><h2>Needs attention</h2><span>4</span></div>
{attn("bad", "R", "Ramo · closing checks missed", "Last night, no one signed. 3 checks missed in a row.", ["Nudge manager", "Call site"])}
{attn("bad", "B", "Bunso · walk-in fridge 9.2°C", "Food moved, re-check due 14:40. Repair raised.", ["Open check"])}
{attn("warn", "H", "Hoodwood · gas safety", "Certificate expires 18 Oct. No visit booked.", ["Book visit"])}
{attn("warn", "Be", "Belly · fryer quote £420", "[Contractor] quote waiting for approval.", ["Approve", "Query"])}
</div>
<div class="panel">
<div class="hd" style="padding-bottom: 4px"><h2>Due this month</h2></div>
{row(av(I["cert"]), "Gas safety · Hoodwood", "18 Oct")}
{row(av(I["shield"]), "TR19 duct clean · Cafe Mamasons", "1 Nov")}
{row(av(I["book"]), "4-weekly review · all sites", "Fri 9 Oct")}
</div>
</aside>
</div>
</div>'''
page('c06-Compliance.dc.html', 'Desktop · Checks, all sites', P(1440, 1060), c06)

# ======================= c07 Desktop · Grid =======================
c07 = f'''<div class="ad {{{{theme}}}}" style="min-height: 1040px">
{admin_top("Checks")}
<div style="padding: 32px 40px 56px; display: flex; flex-direction: column; gap: 32px">
<div style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; color: var(--sec)">Wed 30 Sep – Tue 6 Oct</span><h1 style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.035em">Bunso · last 7 days</h1></div>
<div style="display: flex; gap: 12px; align-items: center">{subnav("Grid")}<button class="sm" style="height: 36px; display: inline-flex; align-items: center; gap: 6px">{I["export"]}Export to Excel</button></div>
</div>
<div style="display: flex; gap: 20px; font-size: 13px; color: var(--sec); flex-wrap: wrap">
<span><span class="dot ok"></span>In range or Yes</span><span><span class="dot bad"></span>Failed, action taken</span><span><span class="dot warn"></span>Done late</span><span><span class="dot" style="color: var(--sep)"></span>Missed</span><span style="margin-left: auto">Tap any cell to see who, when and the photo</span>
</div>
<div style="display: flex; flex-direction: column; gap: 32px">
<sc-for list="{{{{groups}}}}" as="g" hint-placeholder-count="3">
<section style="display: flex; flex-direction: column">
<div style="display: grid; grid-template-columns: minmax(260px, 2fr) repeat(7, minmax(84px, 1fr)); gap: 8px; align-items: end; padding-bottom: 8px">
<span style="font-size: 20px; font-weight: 700; letter-spacing: -0.025em">{{{{g.name}}}}</span>
<sc-for list="{{{{days}}}}" as="d" hint-placeholder-count="7"><span style="text-align: center; font-size: 12px; color: var(--sec)">{{{{d}}}}</span></sc-for>
</div>
<sc-for list="{{{{g.rows}}}}" as="r" hint-placeholder-count="4">
<div style="display: grid; grid-template-columns: minmax(260px, 2fr) repeat(7, minmax(84px, 1fr)); gap: 8px; align-items: center; min-height: 48px; border-top: .5px solid var(--sep)">
<span class="tx"><span style="font-size: 15px">{{{{r.name}}}}</span><small style="font-size: 13px">{{{{r.rule}}}}</small></span>
<sc-for list="{{{{r.cells}}}}" as="c" hint-placeholder-count="7"><span style="height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; {{{{c.style}}}}">{{{{c.v}}}}</span></sc-for>
</div>
</sc-for>
</section>
</sc-for>
</div>
</div>
</div>'''
c07_logic = r'''class Component extends DCLogic {
  renderVals() {
    const ok = 'background: var(--okbg); color: var(--ok)';
    const bad = 'background: var(--badbg); color: var(--bad)';
    const late = 'background: var(--warnbg); color: var(--warn)';
    const miss = 'background: transparent; color: var(--sec); box-shadow: inset 0 0 0 1px var(--sep)';
    const cell = (v) => {
      if (v === '-') return { v: 'Missed', style: miss };
      if (v === '') return { v: '', style: 'background: transparent' };
      if (v.startsWith('!')) return { v: v.slice(1), style: bad };
      if (v.startsWith('~')) return { v: v.slice(1), style: late };
      return { v, style: ok };
    };
    const r = (name, rule, vals) => ({ name, rule, cells: vals.map(cell) });
    return {
      theme: this.props.dark ? 'dark' : '',
      days: ['Wed 30', 'Thu 1', 'Fri 2', 'Sat 3', 'Sun 4', 'Mon 5', 'Tue 6'],
      groups: [
        { name: 'Opening checks', rows: [
          r('Walk-in fridge', '8°C or below', ['4.2°', '4.0°', '3.8°', '4.4°', '4.1°', '5.6°', '!9.2°']),
          r('Reach-in fridge 1', '8°C or below', ['3.9°', '4.1°', '4.0°', '3.7°', '~4.2°', '4.0°', '4.1°']),
          r('Freezer', '−18°C or below', ['−19°', '−20°', '−19°', '−19°', '−18°', '−19°', '−19°']),
          r('Door seals clean', 'Yes / No', ['✓', '✓', '✓', '✓', '✓', '✓', '✓'])
        ] },
        { name: 'Hot holding', rows: [
          r('Pass · 12:00', '63°C or above', ['71°', '68°', '70°', '69°', '-', '72°', '70°']),
          r('Pass · 15:00', '63°C or above', ['66°', '67°', '~65°', '68°', '66°', '!52°', '']),
          r('Soup well · 18:00', '63°C or above', ['74°', '75°', '73°', '76°', '74°', '75°', ''])
        ] },
        { name: 'Closing checks', rows: [
          r('Fridges at close', '8°C or below', ['4.5°', '4.2°', '4.6°', '~4.8°', '4.3°', '4.4°', '']),
          r('Kitchen cleaned', 'Signed by closer', ['✓', '✓', '✓', '✓', '✓', '✓', '']),
          r('Doors locked, alarm set', 'Yes / No', ['✓', '✓', '✓', '✓', '-', '✓', ''])
        ] }
      ]
    };
  }
}'''
page('c07-Grid.dc.html', 'Desktop · Checks grid', P(1440, 1040), c07, c07_logic)

# ======================= Custom checklists: shared bits =======================
TYPES = [
    ('yesno', 'Yes / No', 'check', 'A quick tick, e.g. "Ice machine cleaned?"'),
    ('temp', 'Temperature', 'thermo', 'A °C reading with a pass range'),
    ('number', 'Number', 'hash', 'Any amount with a unit: £, kg, pH, count'),
    ('text', 'Text', 'text', 'A short note or a longer comment'),
    ('photo', 'Photo', 'camera', 'Taken live with the camera, 1 to 3 photos'),
    ('choice', 'Pick from a list', 'choice', 'One or several options you write'),
    ('date', 'Date or time', 'cal', 'e.g. a use-by date or a delivery time'),
    ('sign', 'Signature', 'pen', 'Signed by the person or a manager'),
]
I['hash'] = svg('M6.5 2.5l-1.5 13M13 2.5l-1.5 13M3 6.5h12.5M2.5 11.5H15')
I['text'] = svg('M3 4h12M3 8h12M3 12h8')
I['choice'] = svg('M3 4.5h.01M3 9h.01M3 13.5h.01M6.5 4.5h9M6.5 9h9M6.5 13.5h9', 19, 2)
I['cal'] = svg('M3 4.5h12v10.5H3zM3 7.5h12M6 3v3M12 3v3')
I['pen'] = svg('M2.5 15.5c2-1 3-3 4.5-3s1 2 2.5 2 2-2.5 3.5-2.5M11 3l3 3-6.5 6.5H4.5v-3z')
TYPE_ICON = {k: I[ic] for k, _, ic, _ in TYPES}

def type_icon(var):
    """sc-if chain that shows the right icon for {{var.t.<type>}}."""
    return ''.join(f'<sc-if value="{{{{{var}.t.{k}}}}}" hint-placeholder-val="{{{{ false }}}}">{TYPE_ICON[k]}</sc-if>' for k, _, _, _ in TYPES)

TYPES_JS = json.dumps({k: {'label': l, 'desc': d} for k, l, _, d in TYPES})

# ======================= c08 Desktop · Checklist builder (live) =======================
lists_group = [('Opening checks', 'Daily · 09:30 · 12 checks'), ('Hot holding', 'Daily · 12:00, 15:00, 18:00'),
               ('Closing checks', 'Daily · 23:00 · 12 checks'), ('End-of-day cleaning', 'Daily · 23:30 · 8 tasks')]
lists_site = [('Bar opening', 'Bunso · daily 16:30', True), ('Lechon roast log', 'Guanabana · each roast', False),
              ('Brunch set-up', 'Cafe Mamasons · Sat, Sun', False)]
def lnk(n, s, on=False):
    return (f'<a href="c08-Builder.dc.html" style="display: flex; flex-direction: column; gap: 2px; padding: 11px 14px; border-radius: 12px; text-decoration: none; color: var(--text); {"background: var(--sel)" if on else ""}">'
            f'<span style="font-weight: {600 if on else 500}">{n}</span><small style="font-size: 13px; color: var(--sec)">{s}</small></a>')
nav08 = ('<div class="sl" style="padding: 0 14px 4px">Group · all sites</div>' + ''.join(lnk(n, s) for n, s in lists_group) +
         '<div class="sl" style="padding: 20px 14px 4px">Site lists · made by managers</div>' + ''.join(lnk(n, s, on) for n, s, on in lists_site))

def seg_bind(listvar):
    return (f'<span class="seg" style="align-self: flex-start"><sc-for list="{{{{{listvar}}}}}" as="o" hint-placeholder-count="3">'
            f'<a href="c08-Builder.dc.html" class="{{{{o.on}}}}" onClick="{{{{o.pick}}}}">{{{{o.label}}}}</a></sc-for></span>')

def tog(label, sub, var, flip):
    s = f'<small>{sub}</small>' if sub else ''
    return (f'<div class="fr" style="min-height: 54px"><span class="tx"><span style="font-size: 15px">{label}</span>{s}</span>'
            f'<button class="tg {{{{{var}}}}}" onClick="{{{{{flip}}}}}" aria-label="{label}"><span></span></button></div>')

def field(label, var, setter, ph='', w='100%', align='left'):
    return (f'<label style="display: flex; flex-direction: column; gap: 6px"><span style="font-size: 13px; font-weight: 600; color: var(--sec)">{label}</span>'
            f'<input class="in" style="width: {w}; text-align: {align}" type="text" value="{{{{{var}}}}}" onChange="{{{{{setter}}}}}" placeholder="{ph}"></label>')

def iff(cond, html):
    return f'<sc-if value="{{{{{cond}}}}}" hint-placeholder-val="{{{{ false }}}}">{html}</sc-if>'

settings_specific = (
    iff('cur.t.yesno', f'<div class="sub" style="gap: 8px"><div class="sl"><span>Which answer is a fail?</span></div>{seg_bind("failOnOpts")}</div>') +
    iff('cur.t.temp', f'<div class="sub" style="gap: 8px"><div class="sl"><span>Pass if between</span><span>°C · example values</span></div><div style="display: flex; gap: 10px; align-items: center">{field("Lowest", "cur.min", "setMin", "e.g. 11", "110px", "right")}<span style="padding-top: 22px; color: var(--sec)">to</span>{field("Highest", "cur.max", "setMax", "e.g. 13", "110px", "right")}</div></div>') +
    iff('cur.t.number', f'<div class="sub" style="gap: 8px"><div class="sl"><span>Pass if between</span><span>Leave blank for no rule</span></div><div style="display: flex; gap: 10px; align-items: flex-end">{field("Unit", "cur.unit", "setUnit", "£, kg, pH", "80px")}{field("Lowest", "cur.min", "setMin", "", "100px", "right")}{field("Highest", "cur.max", "setMax", "", "100px", "right")}</div></div>') +
    iff('cur.t.text', f'<div class="sub" style="gap: 8px"><div class="sl"><span>Answer length</span></div>{seg_bind("lenOpts")}</div>') +
    iff('cur.t.photo', f'<div class="sub" style="gap: 8px"><div class="sl"><span>How many photos</span><span>Camera only, no uploads</span></div>{seg_bind("countOpts")}</div>') +
    iff('cur.t.choice', f'''<div class="sub" style="gap: 8px"><div class="sl"><span>Options</span><span>{{{{optCount}}}}</span></div>{seg_bind("multiOpts")}
<sc-for list="{{{{opts}}}}" as="o" hint-placeholder-count="4"><div style="display: flex; gap: 8px; align-items: center"><input class="in" style="flex: 1; width: auto; text-align: left" type="text" value="{{{{o.v}}}}" onChange="{{{{o.set}}}}" aria-label="Option"><button class="sm" onClick="{{{{o.del}}}}" aria-label="Remove option">{I["x"]}</button></div></sc-for>
<button class="sm" style="align-self: flex-start; color: var(--link)" onClick="{{{{addOpt}}}}">+ Add option</button></div>''') +
    iff('cur.t.date', f'<div class="sub" style="gap: 8px"><div class="sl"><span>Ask for</span></div>{seg_bind("dateOpts")}</div>{tog("Fail if the date has passed", "Good for use-by dates", "cur.failPastOn", "flipFailPast")}') +
    iff('cur.t.sign', f'<div class="sub" style="gap: 8px"><div class="sl"><span>Who signs</span></div>{seg_bind("whoOpts")}</div>')
)

preview = (
    iff('cur.t.yesno', '<div class="fr"><span class="tx"><span>{{cur.titleShown}}</span><small>{{cur.help}}</small></span><span class="yn"><button class="y">Yes</button><button class="n">No</button></span></div>') +
    iff('cur.t.temp', '<div class="fr"><span class="tx"><span>{{cur.titleShown}}</span><small>{{ruleText}}</small></span><input class="in" type="text" placeholder="°C" aria-label="Preview"></div>') +
    iff('cur.t.number', '<div class="fr"><span class="tx"><span>{{cur.titleShown}}</span><small>{{ruleText}}</small></span><input class="in" type="text" placeholder="{{cur.unit}}" aria-label="Preview"></div>') +
    iff('cur.t.text', '<div style="display: flex; flex-direction: column; gap: 8px; padding: 8px 0"><span class="tx"><span>{{cur.titleShown}}</span><small>{{cur.help}}</small></span><sc-if value="{{cur.long}}" hint-placeholder-val="{{ false }}"><textarea class="ta" placeholder="Type here"></textarea></sc-if><sc-if value="{{cur.short}}" hint-placeholder-val="{{ false }}"><input class="in" style="width: 100%; text-align: left" placeholder="Type here"></sc-if></div>') +
    iff('cur.t.photo', f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 0"><span class="tx"><span>{{{{cur.titleShown}}}}</span><small>{{{{cur.help}}}}</small></span><div style="display: flex; gap: 8px"><sc-for list="{{{{photoSlots}}}}" as="p" hint-placeholder-count="1"><span style="width: 84px; height: 84px; border-radius: 14px; border: 1.5px dashed var(--sep); display: flex; flex-direction: column; gap: 4px; align-items: center; justify-content: center; color: var(--link); font-size: 12px; font-weight: 600">{I["camera"]}Take photo</span></sc-for></div></div>') +
    iff('cur.t.choice', '<div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 0"><span class="tx"><span>{{cur.titleShown}}</span><small>{{pickHint}}</small></span><div style="display: flex; flex-wrap: wrap; gap: 8px"><sc-for list="{{opts}}" as="o" hint-placeholder-count="4"><span class="mini" style="display: inline-flex; align-items: center">{{o.v}}</span></sc-for></div></div>') +
    iff('cur.t.date', '<div class="fr"><span class="tx"><span>{{cur.titleShown}}</span><small>{{cur.help}}</small></span><input class="in" type="text" placeholder="{{datePh}}" aria-label="Preview"></div>') +
    iff('cur.t.sign', '<div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 0"><span class="tx"><span>{{cur.titleShown}}</span><small>{{signHint}}</small></span><span style="height: 84px; border-radius: 14px; border: 1.5px dashed var(--sep); display: flex; align-items: flex-end; padding: 12px 14px; color: var(--sec); font-size: 14px">Sign here with your finger</span></div>')
)

c08 = f'''<div class="ad {{{{theme}}}}" style="min-height: 1180px">
{admin_top("Checks")}
<div style="padding: 32px 40px 0; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; color: var(--sec)">Build your own lists, with any kind of answer</span><h1 style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.035em">Checklists</h1></div>
<div style="display: flex; gap: 12px; align-items: center">{subnav("Checklists")}<button class="sm pri" style="height: 36px">New checklist</button></div>
</div>
<div style="display: grid; grid-template-columns: 250px minmax(0, 1fr) 400px; gap: 32px; padding: 28px 40px 56px; align-items: start">
<nav style="display: flex; flex-direction: column; gap: 2px">{nav08}</nav>
<section style="display: flex; flex-direction: column; gap: 32px">
<div class="hero">
<div style="display: flex; flex-direction: column; gap: 8px"><span class="hl">Bunso only · made by [Manager] · draft</span><span style="font-size: 36px; font-weight: 600; letter-spacing: -0.045em; line-height: 1">Bar opening</span></div>
<div style="display: flex; gap: 22px"><span class="hs">16:30<small>Due · daily</small></span><span class="hs">Bar team<small>Who does it</small></span><span class="hs">{{{{checkCount}}}}<small>Checks</small></span></div>
</div>
<div class="grp" style="gap: 12px">
<div class="hd"><h2>Checks</h2><span>Tap one to edit it</span></div>
<div class="sub" style="gap: 4px">
<sc-for list="{{{{list}}}}" as="c" hint-placeholder-count="8">
<a href="c08-Builder.dc.html" onClick="{{{{c.pick}}}}" style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 0 12px; border-radius: 12px; color: var(--text); text-decoration: none; {{{{c.style}}}}">
<span style="color: var(--sec); opacity: .55; display: flex">{I["grip"]}</span>
<span class="av">{type_icon("c")}</span>
<span class="tx"><span style="font-size: 15px">{{{{c.title}}}}</span><small style="font-size: 13px">{{{{c.sub}}}}</small></span>
<span style="font-size: 13px; color: var(--sec)">{{{{c.req}}}}</span>
</a>
</sc-for>
</div>
<button onClick="{{{{openPicker}}}}" style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 12px; color: var(--link); background: none; border: 0; font: inherit; font-weight: 500; cursor: pointer"><span class="av" style="background: transparent; border: 1.5px dashed var(--sep); color: var(--link)">{I["plus"]}</span>Add a check</button>
<sc-if value="{{{{picker}}}}" hint-placeholder-val="{{{{ false }}}}">
<div class="panel" style="gap: 14px">
<div class="hd"><h2 style="font-size: 18px">{{{{pickerTitle}}}}</h2><button class="sm" onClick="{{{{closePicker}}}}">Cancel</button></div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
<sc-for list="{{{{types}}}}" as="c" hint-placeholder-count="8">
<button onClick="{{{{c.pick}}}}" style="display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; border: 0; background: var(--bg); box-shadow: 0 0 0 .5px var(--sep); text-align: left; font: inherit; color: var(--text); cursor: pointer">
<span class="av">{type_icon("c")}</span><span class="tx"><span style="font-size: 15px; font-weight: 600">{{{{c.label}}}}</span><small style="font-size: 13px">{{{{c.desc}}}}</small></span></button>
</sc-for>
</div>
</div>
</sc-if>
</div>
</section>
<aside style="display: flex; flex-direction: column; gap: 20px; position: sticky; top: 24px">
<div class="panel" style="gap: 22px">
<div class="hd"><h2 style="font-size: 20px">Check {{{{curNum}}}}</h2><button class="sm" style="color: var(--bad)" onClick="{{{{removeCur}}}}">Remove</button></div>
{field("Question staff see", "cur.title", "setTitle", "e.g. Ice machine cleaned?")}
{field("Help text (optional)", "cur.help", "setHelp", "e.g. Empty, wipe and refill")}
<div class="sub" style="gap: 8px"><div class="sl"><span>Answer type</span></div>
<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 14px; background: var(--bg)"><span class="av">{type_icon("cur")}</span><span class="tx"><span style="font-weight: 600; font-size: 15px">{{{{cur.label}}}}</span><small style="font-size: 13px">{{{{cur.desc}}}}</small></span><button class="sm" onClick="{{{{changeType}}}}">Change</button></div></div>
{settings_specific}
<div class="sub">
<div class="sl"><span>Rules</span></div>
{tog("Must be answered", "", "cur.reqOn", "flipReq")}
<sc-if value="{{{{cur.canFail}}}}" hint-placeholder-val="{{{{ true }}}}">
{tog("Ask for a photo if it fails", "", "cur.photoFailOn", "flipPhotoFail")}
{tog("Report a fault if it fails", "Opens a repair job", "cur.faultOn", "flipFault")}
</sc-if>
</div>
</div>
<div style="display: flex; flex-direction: column; gap: 10px">
<div class="sl" style="padding: 0 4px"><span>Staff will see this on the iPad</span></div>
<div style="border-radius: 22px; background: var(--bg); box-shadow: 0 0 0 .5px var(--sep), 0 20px 40px -24px rgba(0,0,0,.35); padding: 8px 20px; font-size: 17px">{preview}</div>
</div>
<button class="btn b1" style="height: 46px; font-size: 15px">Publish · starts tomorrow</button>
</aside>
</div>
</div>'''

c08_logic = '''const TYPES = ''' + TYPES_JS + r''';
const DEFAULTS = {
  yesno: { failOn: 'No', photoFail: true, fault: false },
  temp: { min: '', max: '', photoFail: true, fault: true },
  number: { unit: '', min: '', max: '', photoFail: false, fault: false },
  text: { long: false },
  photo: { count: 1 },
  choice: { multi: false, options: ['Option 1', 'Option 2'], photoFail: false, fault: false },
  date: { mode: 'Date', failPast: false },
  sign: { who: 'Person doing it' }
};
class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { sel: 2, picker: false, replace: false, nextId: 9, checks: [
      { id: 1, type: 'yesno', title: 'Ice machine cleaned', help: 'Empty, wipe and refill', required: true, failOn: 'No', photoFail: true, fault: false },
      { id: 2, type: 'temp', title: 'Beer cellar temperature', help: 'Read the cellar display', required: true, min: '11', max: '13', photoFail: true, fault: true },
      { id: 3, type: 'number', title: 'Float in the till', help: 'Count the notes and coins', required: true, unit: '£', min: '150', max: '150', photoFail: false, fault: false },
      { id: 4, type: 'choice', title: 'Garnishes prepped', help: '', required: true, multi: true, options: ['Lemons', 'Limes', 'Mint', 'Calamansi'], photoFail: false, fault: false },
      { id: 5, type: 'photo', title: 'Photo of the bar top', help: 'Clean and set up', required: true, count: 1 },
      { id: 6, type: 'date', title: 'Open juice use-by date', help: 'Check the label', required: true, mode: 'Date', failPast: true },
      { id: 7, type: 'text', title: 'Anything to report?', help: 'Breakages, low stock', required: false, long: true },
      { id: 8, type: 'sign', title: 'Signed off by', help: '', required: true, who: 'Person doing it' }
    ] };
  }
  renderVals() {
    const s = this.state;
    const flags = (t) => { const o = {}; Object.keys(TYPES).forEach((k) => { o[k] = k === t; }); return o; };
    const cur = s.checks.find((c) => c.id === s.sel) || s.checks[0];
    const upd = (patch) => this.setState({ checks: s.checks.map((c) => (c.id === cur.id ? Object.assign({}, c, patch) : c)) });
    const range = (c, u) => {
      const a = c.min, b = c.max; if (!a && !b) return '';
      if (a && b) return a === b ? (u === '£' ? '£' + a : a + u) : (u === '£' ? '£' + a + '–£' + b : a + '–' + b + u);
      return a ? (u === '£' ? '£' : '') + a + (u === '£' ? '' : u) + ' or more' : (u === '£' ? '£' : '') + b + (u === '£' ? '' : u) + ' or less';
    };
    const summary = (c) => {
      let x = TYPES[c.type].label;
      if (c.type === 'temp') { const r = range(c, '°C'); if (r) x += ' · pass ' + r; }
      if (c.type === 'number') { const r = range(c, c.unit === '£' ? '£' : (c.unit ? ' ' + c.unit : '')); if (r) x += ' · pass ' + r; }
      if (c.type === 'yesno' && c.failOn !== 'Neither') x += ' · fail if ' + c.failOn;
      if (c.type === 'choice') x += ' · ' + c.options.length + ' options · ' + (c.multi ? 'pick any' : 'pick one');
      if (c.type === 'photo') x += ' · ' + c.count + (c.count === 1 ? ' photo' : ' photos');
      if (c.type === 'date') x += ' · ' + c.mode.toLowerCase() + (c.failPast ? ' · fail if passed' : '');
      if (c.type === 'text') x += c.long ? ' · long' : ' · short';
      if (c.type === 'sign') x += ' · ' + c.who.toLowerCase();
      return x;
    };
    const list = s.checks.map((c) => ({ title: c.title || 'Untitled check', sub: summary(c), req: c.required ? '' : 'Optional', t: flags(c.type),
      style: c.id === cur.id ? 'background: var(--side); box-shadow: inset 0 0 0 1.5px var(--link)' : '',
      pick: (e) => { e.preventDefault(); this.setState({ sel: c.id, picker: false }); } }));
    const types = Object.keys(TYPES).map((k) => ({ label: TYPES[k].label, desc: TYPES[k].desc, t: flags(k), pick: () => {
      if (s.replace) { this.setState({ picker: false, checks: s.checks.map((c) => (c.id === cur.id ? Object.assign({ id: c.id, title: c.title, help: c.help, required: c.required, type: k }, DEFAULTS[k]) : c)) }); }
      else { const id = s.nextId; this.setState({ picker: false, sel: id, nextId: id + 1, checks: s.checks.concat([Object.assign({ id, type: k, title: '', help: '', required: true }, JSON.parse(JSON.stringify(DEFAULTS[k])))]) }); }
    } }));
    const opt = (key, labels) => labels.map((l) => ({ label: l, on: cur[key] === l ? 'on' : '', pick: (e) => { e.preventDefault(); upd({ [key]: l }); } }));
    const optB = (key, pairs) => pairs.map(([l, v]) => ({ label: l, on: cur[key] === v ? 'on' : '', pick: (e) => { e.preventDefault(); upd({ [key]: v }); } }));
    const opts = (cur.options || []).map((v, i) => ({ v, set: (e) => { const o = cur.options.slice(); o[i] = e.target.value; upd({ options: o }); }, del: () => upd({ options: cur.options.filter((_, j) => j !== i) }) }));
    const unit = cur.type === 'temp' ? '°C' : (cur.unit === '£' ? '£' : (cur.unit ? ' ' + cur.unit : ''));
    const r = (cur.type === 'temp' || cur.type === 'number') ? range(cur, unit) : '';
    const canFail = ['yesno', 'temp', 'number', 'choice'].includes(cur.type);
    return {
      theme: this.props.dark ? 'dark' : '',
      list, types, checkCount: String(s.checks.length),
      curNum: String(s.checks.indexOf(cur) + 1),
      cur: Object.assign({}, cur, { t: flags(cur.type), label: TYPES[cur.type].label, desc: TYPES[cur.type].desc, titleShown: cur.title || 'Your question', canFail,
        reqOn: cur.required ? 'on' : '', photoFailOn: cur.photoFail ? 'on' : '', faultOn: cur.fault ? 'on' : '', failPastOn: cur.failPast ? 'on' : '', short: !cur.long }),
      picker: s.picker, pickerTitle: s.replace ? 'Change the answer type' : 'What kind of answer?',
      openPicker: () => this.setState({ picker: true, replace: false }),
      changeType: () => this.setState({ picker: true, replace: true }),
      closePicker: () => this.setState({ picker: false }),
      removeCur: () => { if (s.checks.length < 2) return; const rest = s.checks.filter((c) => c.id !== cur.id); this.setState({ checks: rest, sel: rest[0].id }); },
      setTitle: (e) => upd({ title: e.target.value }), setHelp: (e) => upd({ help: e.target.value }),
      setMin: (e) => upd({ min: e.target.value }), setMax: (e) => upd({ max: e.target.value }), setUnit: (e) => upd({ unit: e.target.value }),
      flipReq: () => upd({ required: !cur.required }), flipPhotoFail: () => upd({ photoFail: !cur.photoFail }), flipFault: () => upd({ fault: !cur.fault }), flipFailPast: () => upd({ failPast: !cur.failPast }),
      failOnOpts: opt('failOn', ['No', 'Yes', 'Neither']),
      lenOpts: optB('long', [['Short', false], ['Long', true]]),
      countOpts: optB('count', [['1', 1], ['2', 2], ['3', 3]]),
      multiOpts: optB('multi', [['Pick one', false], ['Pick any', true]]),
      dateOpts: opt('mode', ['Date', 'Time', 'Both']),
      whoOpts: opt('who', ['Person doing it', 'A manager']),
      opts, optCount: (cur.options || []).length + ' options',
      addOpt: () => upd({ options: (cur.options || []).concat(['Option ' + ((cur.options || []).length + 1)]) }),
      ruleText: r ? 'Pass if ' + r : (cur.help || 'No pass rule'),
      pickHint: cur.multi ? 'Pick any that apply' : 'Pick one',
      photoSlots: Array.from({ length: cur.count || 1 }, (_, i) => i),
      datePh: cur.mode === 'Time' ? '--:--' : (cur.mode === 'Both' ? 'dd/mm/yyyy --:--' : 'dd/mm/yyyy'),
      signHint: cur.who === 'A manager' ? 'A manager signs with their PIN' : 'The person who did the check signs'
    };
  }
}'''
page('c08-Builder.dc.html', 'Desktop · Checklist builder', P(1440, 1180), c08, c08_logic)

# ======================= c09 iPad · Every answer type, as staff see it (live) =======================
c09_side = f'''<nav class="side" aria-label="Checks in this list">
<a class="back" href="c01-KitchenToday.dc.html" style="padding: 0 4px">{BACK}Today's checks</a>
<div style="display: flex; flex-direction: column; gap: 4px; padding: 0 12px 8px"><span style="font-size: 15px; color: var(--sec)">Due 16:30 · Bunso bar</span><span style="font-size: 28px; font-weight: 700; letter-spacing: -0.035em">Bar opening</span></div>
<div class="sg">8 checks · made by [Manager]</div>
<div style="display: flex; flex-direction: column; gap: 2px">
<sc-for list="{{{{side}}}}" as="x" hint-placeholder-count="8"><a class="si" href="c09-AnswerTypes.dc.html" style="min-height: 44px; font-size: 15px"><span class="pie" style="width: 22px">{iff("x.done", circ("done", 20))}{iff("x.fail", circ("fail", 20))}{iff("x.todo", circ("todo", 20))}</span>{{{{x.n}}}}</a></sc-for>
</div>
<div style="margin-top: auto; display: flex; align-items: center; gap: 12px; padding: 0 12px">{av("DP", "ink")}<span class="tx"><span style="font-size: 15px">[Bartender]</span><small>Doing this check</small></span></div>
</nav>'''

c09 = f'''<div class="tb {{{{theme}}}}">
{c09_side}
<main class="main">
<div class="top"><span style="font-size: 17px; font-weight: 600">Bar opening</span><span style="font-size: 13px; color: var(--sec)"><span class="dot ok"></span>Saved on this iPad · 16:21</span></div>
<div class="cont" style="gap: 26px">
<div class="hero" style="padding: 20px 28px">
<div style="display: flex; flex-direction: column; gap: 6px"><span class="hl">Bar opening</span><div class="big"><b style="font-size: 48px">{{{{doneCount}}}}</b><i style="font-size: 24px">&nbsp;of 8 done</i></div></div>
<div style="display: flex; gap: 22px"><span class="hs">9 min<small>Left before 16:30</small></span><span class="hs" style="{{{{failStyle}}}}">{{{{failCount}}}}<small>Failed</small></span></div>
</div>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 44px; align-items: start">
<div class="sub">
<div class="fr"><span class="tx"><span>Ice machine cleaned</span><small>Yes / No · empty, wipe and refill</small></span><span class="yn"><button class="y" aria-pressed="{{{{ice.y}}}}" onClick="{{{{ice.setY}}}}">Yes</button><button class="n" aria-pressed="{{{{ice.n}}}}" onClick="{{{{ice.setN}}}}">No</button></span></div>
<label class="fr"><span class="tx"><span>Beer cellar temperature</span><small>Temperature · pass 11–13°C</small></span><span style="display: flex; align-items: center; gap: 10px"><span class="pill {{{{cellar.pill}}}}">{{{{cellar.label}}}}</span><input class="in {{{{cellar.cls}}}}" type="text" inputmode="decimal" value="{{{{v.cellar}}}}" onChange="{{{{setCellar}}}}" style="width: 96px" aria-label="Cellar temperature"></span></label>
<label class="fr"><span class="tx"><span>Float in the till</span><small>Number · should be £150</small></span><span style="display: flex; align-items: center; gap: 10px"><span class="pill {{{{flt.pill}}}}">{{{{flt.label}}}}</span><input class="in {{{{flt.cls}}}}" type="text" inputmode="decimal" value="{{{{v.flt}}}}" onChange="{{{{setFlt}}}}" style="width: 96px" aria-label="Float in pounds"></span></label>
<div class="fr" style="flex-direction: column; align-items: stretch; gap: 10px; padding: 12px 0"><span class="tx"><span>Garnishes prepped</span><small>Pick from a list · pick any</small></span><div style="display: flex; flex-wrap: wrap; gap: 8px"><sc-for list="{{{{garn}}}}" as="g" hint-placeholder-count="4"><button class="mini" aria-pressed="{{{{g.on}}}}" onClick="{{{{g.flip}}}}">{{{{g.label}}}}</button></sc-for></div></div>
</div>
<div class="sub">
<div class="fr" style="padding: 10px 0"><span class="tx"><span>Photo of the bar top</span><small>Photo · camera only</small></span><span style="width: 76px; height: 64px; border-radius: 12px; background: linear-gradient(135deg, #8a6a4a, #3b2c20); display: flex; align-items: flex-end; justify-content: flex-end; padding: 6px; box-sizing: border-box; flex: none"><span class="pill p-ok" style="height: 22px; font-size: 11px; background: rgba(255,255,255,.9)">16:18</span></span></div>
<label class="fr"><span class="tx"><span>Open juice use-by date</span><small>Date · fails if it has passed</small></span><span style="display: flex; align-items: center; gap: 10px"><span class="pill p-ok">In date</span><input class="in" type="text" value="09/10/2026" style="width: 132px" aria-label="Use-by date"></span></label>
<div class="fr" style="flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 0"><span class="tx"><span>Anything to report?</span><small>Text · optional</small></span><textarea class="ta" style="min-height: 56px" placeholder="e.g. 2 pint glasses broken, low on tonic"></textarea></div>
<div class="fr" style="flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 0"><span class="tx"><span>Signed off by</span><small>Signature · the person doing it</small></span><span style="height: 60px; border-radius: 14px; border: 1.5px dashed var(--sep); display: flex; align-items: center; padding: 0 14px; color: var(--sec); font-size: 14px">Sign here with your finger</span></div>
</div>
</div>
</div>
<div class="bar"><a class="btn b2" href="c01-KitchenToday.dc.html">Save for later</a><a class="btn {{{{finishCls}}}}" href="c01-KitchenToday.dc.html">{{{{finishLabel}}}}</a></div>
</main>
</div>'''
c09_logic = r'''class Component extends DCLogic {
  constructor(props) { super(props); this.state = { ice: 'y', cellar: '12', flt: '150', garn: { Lemons: true, Limes: true, Mint: false, Calamansi: true } }; }
  renderVals() {
    const s = this.state;
    const num = (x) => { const r = parseFloat(String(x).replace(/[£,\s]/g, '')); return isFinite(r) ? r : null; };
    const c = num(s.cellar), f = num(s.flt);
    const cellar = c === null ? { pill: 'p-mut', label: 'To do', cls: '' } : (c < 11 || c > 13 ? { pill: 'p-bad', label: c > 13 ? 'Too warm' : 'Too cold', cls: 'bad' } : { pill: 'p-ok', label: 'OK', cls: '' });
    const flt = f === null ? { pill: 'p-mut', label: 'To do', cls: '' } : (f !== 150 ? { pill: 'p-bad', label: (f < 150 ? '£' + (150 - f).toFixed(2) + ' short' : '£' + (f - 150).toFixed(2) + ' over'), cls: 'bad' } : { pill: 'p-ok', label: 'OK', cls: '' });
    const fails = [s.ice === 'n', cellar.cls === 'bad', flt.cls === 'bad'].filter(Boolean).length;
    const garnDone = Object.values(s.garn).some(Boolean);
    const done = [s.ice, c !== null, f !== null, garnDone, true, true].filter(Boolean).length;
    const names = ['Ice machine', 'Cellar temperature', 'Float', 'Garnishes', 'Bar top photo', 'Juice use-by', 'Anything to report', 'Sign off'];
    const st = [s.ice ? (s.ice === 'n' ? 'fail' : 'done') : 'todo', c === null ? 'todo' : (cellar.cls ? 'fail' : 'done'), f === null ? 'todo' : (flt.cls ? 'fail' : 'done'), garnDone ? 'done' : 'todo', 'done', 'done', 'todo', 'todo'];
    return {
      theme: this.props.dark ? 'dark' : '',
      v: s, cellar, flt,
      setCellar: (e) => this.setState({ cellar: e.target.value }), setFlt: (e) => this.setState({ flt: e.target.value }),
      ice: { y: s.ice === 'y' ? 'true' : 'false', n: s.ice === 'n' ? 'true' : 'false', setY: () => this.setState({ ice: 'y' }), setN: () => this.setState({ ice: 'n' }) },
      garn: Object.keys(s.garn).map((k) => ({ label: k, on: s.garn[k] ? 'true' : 'false', flip: () => this.setState({ garn: Object.assign({}, s.garn, { [k]: !s.garn[k] }) }) })),
      side: names.map((n, i) => ({ n, done: st[i] === 'done', fail: st[i] === 'fail', todo: st[i] === 'todo' })),
      doneCount: String(done), failCount: String(fails), failStyle: fails ? 'color: var(--heroBad)' : '',
      finishCls: fails ? 'bd' : 'b1', finishLabel: fails ? 'Fix ' + fails + ' failed check' + (fails > 1 ? 's' : '') + ' first' : 'Sign and finish'
    };
  }
}'''
page('c09-AnswerTypes.dc.html', 'Kitchen iPad · Every answer type', P(1194, 834), c09, c09_logic)

# ======================= c10 Phone · Manager creates a checklist =======================
def mrow(k, title, sub):
    return (f'<div class="li" style="min-height: 62px"><span style="color: var(--sec); opacity: .5; display: flex">{I["grip"]}</span>'
            f'<span class="av">{TYPE_ICON[k]}</span><span class="tx"><span style="font-size: 16px">{title}</span><small>{sub}</small></span></div>')
days = ''.join(f'<button class="mini" aria-pressed="true" style="min-width: 0; padding: 0; width: 40px">{d}</button>' for d in ['M', 'T', 'W', 'T', 'F', 'S', 'S'])
c10 = f'''<div class="ph {{{{theme}}}}" style="min-height: 1790px">
<div class="nav"><a class="back" href="c04-ManagerFeed.dc.html">{BACK}Checks</a><span style="font-weight: 600">New checklist</span><span style="font-size: 13px; color: var(--sec)">Draft</span></div>
<div class="body">
<div class="hero">
<span class="hl">Bunso only · your site</span>
<span style="font-size: 38px; font-weight: 600; letter-spacing: -0.045em; line-height: 1.05">Bar opening</span>
<div class="hm"><span>16:30<small>Due daily</small></span><span>Bar team<small>Who does it</small></span><span>8<small>Checks</small></span></div>
</div>
<section class="grp">
<div class="gh"><h2>Basics</h2></div>
<div class="sub">
<label class="fr"><span>Name</span><input class="in" style="width: 200px; text-align: right" value="Bar opening"></label>
<a class="fr" href="c10-NewChecklist.dc.html" style="color: var(--text); text-decoration: none"><span>Who does it</span><span class="rt">Bar team{CHEV}</span></a>
<div class="fr"><span>Where</span><span class="rt">Bunso only</span></div>
</div>
</section>
<section class="grp">
<div class="gh"><h2>When</h2><p>It shows on the iPad at these times, and you hear about it if it's missed.</p></div>
<div class="sub" style="gap: 12px">
<div style="display: flex; justify-content: space-between">{days}</div>
<div>
<label class="fr"><span>Due by</span><input class="in" style="width: 100px" value="16:30"></label>
<a class="fr" href="c10-NewChecklist.dc.html" style="color: var(--text); text-decoration: none"><span>Missed if not done within</span><span class="rt">30 min{CHEV}</span></a>
</div>
</div>
</section>
<section class="grp">
<div class="gh"><h2>Checks</h2><p>Drag to reorder. Tap one to change it.</p></div>
<div class="sub">
{mrow("yesno", "Ice machine cleaned", "Yes / No · fail if No")}
{mrow("temp", "Beer cellar temperature", "Temperature · pass 11–13°C")}
{mrow("number", "Float in the till", "Number · pass £150")}
{mrow("choice", "Garnishes prepped", "Pick from a list · 4 options")}
{mrow("photo", "Photo of the bar top", "Photo · 1 photo")}
{mrow("date", "Open juice use-by date", "Date · fail if passed")}
{mrow("text", "Anything to report?", "Text · optional")}
{mrow("sign", "Signed off by", "Signature")}
<a class="li" href="c11-AddCheck.dc.html" style="color: var(--link); font-weight: 500"><span style="width: 16px"></span><span class="av" style="background: transparent; border: 1.5px dashed var(--sep); color: var(--link)">{I["plus"]}</span><span class="tx">Add a check</span></a>
</div>
</section>
<section class="grp quiet">
<p class="note" style="margin: 0">Head office lists, like Opening checks, can't be changed here. You can add your own lists for your site at any time.</p>
</section>
</div>
<div class="foot"><a class="btn b1" href="c09-AnswerTypes.dc.html">Save · starts tomorrow</a><a class="btn b2" href="c09-AnswerTypes.dc.html" style="height: 44px; font-size: 15px">Preview on the iPad</a></div>
</div>'''
page('c10-NewChecklist.dc.html', 'Phone · New checklist', P(390, 1790), c10)

# ======================= c11 Phone sheet · Add a check (type picker) =======================
trows = ''.join(
    f'<a class="li" href="c10-NewChecklist.dc.html" style="min-height: 68px"><span class="av">{TYPE_ICON[k]}</span><span class="tx"><span style="font-size: 16px; font-weight: 600">{l}</span><small>{d}</small></span><span class="rt">{CHEV}</span></a>'
    for k, l, _, d in TYPES)
c11 = f'''<div class="ph {{{{theme}}}}" style="min-height: 920px; background: rgba(0,0,0,.42); justify-content: flex-end">
<div style="background: var(--bg); border-radius: 28px 28px 0 0; padding: 10px 20px 34px; display: flex; flex-direction: column; gap: 24px">
<span style="width: 40px; height: 5px; border-radius: 3px; background: var(--sep); align-self: center"></span>
<div style="display: flex; justify-content: space-between; align-items: center"><a href="c10-NewChecklist.dc.html" style="color: var(--link); text-decoration: none">Cancel</a><span style="font-weight: 600">Add a check</span><span style="width: 52px"></span></div>
<div class="gh"><h2>What kind of answer?</h2><p>You can set the pass rule on the next step.</p></div>
<div class="sub">{trows}</div>
</div>
</div>'''
page('c11-AddCheck.dc.html', 'Phone · Add a check', P(390, 920), c11)

# ======================= h01 Phone · App home =======================
I['moon'] = svg('M14.5 10.5A6 6 0 0 1 7.5 3.5a6 6 0 1 0 7 7z')
I['trend'] = svg('M3 13l4.5-5 3.5 3 4-5M12 6h3v3')
I['handover'] = svg('M3 9h11M10 5l4 4-4 4')
h01 = f'''<div class="ph {{{{theme}}}}" style="min-height: 1480px">
<div class="nav" style="padding: 0 20px"><a href="h01-Home.dc.html" style="display: flex; align-items: center; gap: 4px; color: var(--text); text-decoration: none; font-weight: 600">Bunso <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 1l4 4 4-4"></path></svg></a><span style="font-size: 13px; color: var(--sec)"><span class="dot ok"></span>Synced 22:41</span><span class="av ink" style="width: 32px; height: 32px; font-size: 12px">JM</span></div>
<div class="body">
<div style="display: flex; flex-direction: column; gap: 20px">
<div style="display: flex; flex-direction: column; gap: 4px"><span style="font-size: 15px; color: var(--sec)">Tuesday 6 October</span><h1 style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.035em">Good evening, [Manager]</h1></div>
<a class="hero" href="m01-Start.dc.html" style="text-decoration: none">
<div style="display: flex; justify-content: space-between; align-items: center"><span class="hl">Today's close</span><span style="font-size: 13px; color: var(--herosec)">Due by 04:00</span></div>
<div style="display: flex; flex-direction: column; gap: 6px"><div class="big"><b>£850</b><i>.00</i></div><span style="font-size: 14px; color: var(--herosec)">Net so far · forecast £2,560 tonight</span></div>
<div style="display: flex; flex-direction: column; gap: 10px"><div class="segs"><span class="d"></span><span class="d" style="opacity: .5"></span><span></span><span></span><span></span><span></span><span></span><span></span></div><span style="font-size: 13px; color: var(--herosec)">1 of 8 sections done · Dinner in progress</span></div>
</a>
</div>
<section class="grp">
<div class="hd"><h2>Needs you</h2><span>3</span></div>
<div class="sub">
{row(av(I["thermo"], "bad"), "Walk-in fridge 9.2°C at opening", "Checks · re-check passed 4.0°C · sign it off", '<span class="pill p-bad">Sign off</span>', "c04-ManagerFeed.dc.html")}
{row(av(I["book"], "warn"), "Allergen policy v3", "Handbook · 2 kitchen staff still to sign", "", "c04-ManagerFeed.dc.html")}
{row(av(I["flame"]), "Fryer 2 repair", "Repairs · engineer visit Thu 08:00", "", "c05-Repair.dc.html")}
</div>
</section>
<section class="grp">
<div class="hd"><h2>Today</h2></div>
<div class="sub">
{row(av(I["list"]), "Checks", "9 of 10 on time · next: closing checks 23:00", '<span class="pill p-ok">On track</span>', "c04-ManagerFeed.dc.html")}
{row(av(I["handover"]), "Handover from last night", "3 notes from [Duty manager] · 1 repair raised", "", "m04-Review.dc.html")}
{row(av(I["trend"]), "Tomorrow: £2,370 expected", "Wages could hit 32% with 9 on the rota", "", "m06-Trends.dc.html")}
</div>
</section>
<section class="grp quiet">
<div class="sub">
<div class="sl"><span>Quick actions</span></div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding-top: 6px">
<a href="c11-AddCheck.dc.html" style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 6px; border-radius: 18px; background: var(--fill); color: var(--text); text-decoration: none; font-size: 13px; font-weight: 600; text-align: center">{I["wrench"]}Report a fault</a>
<a href="c10-NewChecklist.dc.html" style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 6px; border-radius: 18px; background: var(--fill); color: var(--text); text-decoration: none; font-size: 13px; font-weight: 600; text-align: center">{I["plus"]}New checklist</a>
<a href="m06-Trends.dc.html" style="display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 6px; border-radius: 18px; background: var(--fill); color: var(--text); text-decoration: none; font-size: 13px; font-weight: 600; text-align: center">{I["trend"]}Trends</a>
</div>
</div>
</section>
</div>
<div class="foot"><a class="btn b1" href="m01-Start.dc.html">Continue today's close</a><a class="btn b2" href="c04-ManagerFeed.dc.html" style="height: 44px; font-size: 15px">Go to Checks</a></div>
</div>'''
page('h01-Home.dc.html', 'Phone · Home', P(390, 1480), h01)

print('ok')
