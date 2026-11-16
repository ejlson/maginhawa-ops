/**
 * Settings › Sites and colours (head office). Each site's colour says where you are: its badge,
 * main card, selected tab and progress circles. Pick a tested swatch or drag for a custom shade;
 * the text colour on it is worked out so it stays readable. Status colours never change.
 * Desktop (D3): the list beside the editor, saved as you pick. Phone (P7): pick a site, then one
 * screen for its colour with a Save button, and Undo for 10 seconds.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { COLOUR_PRESETS, DEFAULT_SITE_COLOURS, SITES, siteColour, siteMonogram, type SiteColourChoice } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { colourVars, SiteMono, useSiteColourChoices } from '../lib/site-colours';
import { useWide } from '../lib/wide';
import { Foot, Icon, Nav } from '../components/ui';
import { ICONS } from '../components/ui-helpers';

export default function HoSites() {
  const { choices, colourOf, setChoice } = useSiteColourChoices();
  const wide = useWide();
  const [sel, setSel] = useState<string>(SITES[0]?.code ?? 'BUN');
  // Phone only: which site is open (in the address, so Back works), and the colour picked but not saved yet.
  const [params, setParams] = useSearchParams();
  const open = SITES.some((s) => s.code === params.get('site')) ? params.get('site') : null;
  const [rawDraft, setDraft] = useState<SiteColourChoice | null | undefined>(undefined);
  const [undo, setUndo] = useState<{ code: string; choice: SiteColourChoice | null } | null>(null);
  // On the phone, Undo goes after 10 seconds, as P7 says.
  useEffect(() => {
    if (wide || !undo) return;
    const t = setTimeout(() => setUndo(null), 10_000);
    return () => clearTimeout(t);
  }, [undo, wide]);

  // An unsaved pick belongs to the open phone screen only: leaving it (Back, or the screen widening) drops it.
  useEffect(() => { setDraft(undefined); }, [open, wide]);
  const draft = wide || !open ? undefined : rawDraft;
  const code = wide ? sel : open ?? sel;
  const site = SITES.find((s) => s.code === code) ?? SITES[0]!;
  const editing = draft !== undefined ? (draft ? { ...choices, [code]: draft } : Object.fromEntries(Object.entries(choices).filter(([k]) => k !== code))) : choices;
  const cur = draft !== undefined ? siteColour(code, editing) : colourOf(code);
  const choice = editing[code];
  const presetId = choice && 'preset' in choice ? choice.preset : !choice ? DEFAULT_SITE_COLOURS[code] : null;
  const hue = choice && 'hue' in choice ? choice.hue : 200;

  const save = (next: SiteColourChoice | null) => {
    setUndo({ code, choice: choices[code] ?? null });
    setChoice(code, next);
  };
  // Desktop saves as you pick; the phone keeps it as a draft until Save.
  const change = (next: SiteColourChoice | null) => (wide ? save(next) : setDraft(next));
  const undoBtn = undo && undo.code === code && (
    <button type="button" className="linkbtn" onClick={() => { setChoice(undo.code, undo.choice); setUndo(null); setDraft(undefined); }}>Undo</button>
  );

  const editor = (
    <>
      <div className="hero colour-preview" style={colourVars(cur) as React.CSSProperties}>
        {/* The badge takes the colour being tried, from the card, not the saved one. */}
        <span className="sitebrand-hero"><span className="sitemono" aria-hidden="true">{siteMonogram(code)}</span>{site.name}</span>
        <span className="hl">Preview · net so far</span>
        <div className="big"><b>£1,840</b><i>.50</i></div>
      </div>

      <section className="grp colour-pick">
        <div className="hd"><h2>{wide ? `Colour for ${site.name}` : 'Colours'}</h2><span>{cur.name}</span></div>
        <div className="swatches" role="radiogroup" aria-label={`Colour for ${site.name}`}>
          {COLOUR_PRESETS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={presetId === p.id} aria-label={p.name} className="swatch"
              style={{ background: `radial-gradient(120% 120% at 80% 90%, ${p.light} 0%, ${p.hex} 45%, oklch(from ${p.hex} calc(l * .52) c calc(h - 25)) 100%)` }}
              onClick={() => change({ preset: p.id })} />
          ))}
        </div>
        <label className="hue-row">
          <span><b>Custom</b>{!wide && <small>Drag to pick any shade</small>}</span>
          <input className="hue" type="range" min={0} max={359} value={hue} aria-label="Custom colour"
            onChange={(e) => change({ hue: Number(e.target.value) })} />
        </label>
      </section>

      {wide ? (
        <div className="colour-strip">
          <span className="colour-aa" style={colourVars(cur) as React.CSSProperties} aria-hidden="true">Aa</span>
          <span className="tx"><b>{cur.adjusted ? 'Adjusted for readability.' : 'Passes contrast checks.'}</b> Text on it is {cur.on === '#FFFFFF' ? 'white' : 'dark'}, picked for you.</span>
          <span className="colour-saved" role="status">{undo && undo.code === code ? <>Saved · {undoBtn}</> : 'Saved on this device'}</span>
          {choice && <button type="button" className="linkbtn" onClick={() => change(null)}>Default</button>}
        </div>
      ) : (
        <div className="sub colour-checks">
          <div className="li">
            <span className="colour-aa lg" style={colourVars(cur) as React.CSSProperties} aria-hidden="true">Aa</span>
            <span className="tx"><span>Text on this colour: {cur.on === '#FFFFFF' ? 'white' : 'dark'}</span><small>Picked for you, readable in light and dark</small></span>
          </div>
          <div className="li">
            <span className="av ok"><Icon d={ICONS.check} /></span>
            <span className="tx"><span>{cur.adjusted ? 'Adjusted for readability' : 'Passes contrast checks'}</span><small>Green, amber and red stay for status</small></span>
          </div>
          {choice && <button type="button" className="li" onClick={() => change(null)}><span className="tx"><span style={{ color: 'var(--link)' }}>Back to the default colour</span></span></button>}
        </div>
      )}
    </>
  );

  if (!wide && open) {
    return (
      <HeadOfficeShell>
        <main className="page tabs colour-phone">
          <Nav back="/head-office/sites" backLabel="Sites" title="Site colour" />
          <div className="body">{editor}</div>
          <Foot>
            <button type="button" className="btn b1" disabled={draft === undefined} onClick={() => { save(draft ?? null); setDraft(undefined); }}>Save for everyone at {site.name}</button>
            <p className="note" role="status">{draft !== undefined ? 'Not saved yet · you can undo for 10 seconds after saving' : undo && undo.code === code ? <>Saved on this device for now · {undoBtn}</> : 'Everyone at the site sees it once connected'}</p>
          </Foot>
        </main>
      </HeadOfficeShell>
    );
  }

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}>
          <span className="title">Sites and colours</span>
          <WhoMenu />
        </header>
        <div className="body">
          <div className="titleblock">
            <span className="eyebrow">Settings › Group</span>
            <h1>Sites and colours</h1>
            <p className="lead">Each site's colour shows on its badge, main card and progress circles, so everyone knows where they are. Status colours (green, amber, red) never change.</p>
          </div>

          <div className="colour-cols">
            <div>
              <div className="colour-listhd" aria-hidden="true"><span>{SITES.length} open sites</span><span>Colour</span></div>
              <div className="colourlist" role="listbox" aria-label="Sites">
                {SITES.map((s) => {
                  const c = siteColour(s.code, choices);
                  return (
                    <button key={s.code} type="button" role="option" aria-selected={wide && s.code === sel} aria-current={wide && s.code === sel ? 'true' : undefined}
                      className="row-site" onClick={() => { setSel(s.code); setDraft(undefined); if (!wide) setParams({ site: s.code }); }}>
                      <SiteMono code={s.code} size="lg" />
                      <span className="tx"><span>{s.name}</span><small>{c.name}</small></span>
                      <span className="colourchip" style={colourVars(c) as React.CSSProperties} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
            {wide && <div className="colour-edit">{editor}</div>}
          </div>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
