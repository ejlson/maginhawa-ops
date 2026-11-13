/**
 * Settings › Sites and colours (head office). Each site's colour says where you are: its badge,
 * main card, selected tab and progress circles. Pick a tested swatch or drag for a custom shade;
 * the text colour on it is worked out so it stays readable. Status colours never change.
 */
import { useState } from 'react';
import { COLOUR_PRESETS, DEFAULT_SITE_COLOURS, SITES, siteColour, type SiteColourChoice } from '@maginhawa/core';
import { HeadOfficeShell } from '../components/HeadOfficeShell';
import { WhoMenu } from '../components/home/WhoMenu';
import { colourVars, SiteMono, useSiteColourChoices } from '../lib/site-colours';

export default function HoSites() {
  const { choices, colourOf, setChoice } = useSiteColourChoices();
  const [sel, setSel] = useState<string>(SITES[0]?.code ?? 'BUN');
  const [undo, setUndo] = useState<{ code: string; choice: SiteColourChoice | null } | null>(null);
  const site = SITES.find((s) => s.code === sel) ?? SITES[0]!;
  const cur = colourOf(sel);
  const choice = choices[sel];
  const presetId = choice && 'preset' in choice ? choice.preset : !choice ? DEFAULT_SITE_COLOURS[sel] : null;
  const hue = choice && 'hue' in choice ? choice.hue : 200;

  const change = (next: SiteColourChoice | null) => {
    setUndo({ code: sel, choice: choices[sel] ?? null });
    setChoice(sel, next);
  };

  return (
    <HeadOfficeShell>
      <main className="page wide">
        <header className="nav" style={{ paddingLeft: 24 }}>
          <span className="title">Sites and colours</span>
          <WhoMenu />
        </header>
        <div className="body" style={{ paddingTop: 24, gap: 28 }}>
          <div className="titleblock">
            <span className="eyebrow">Settings · {SITES.length} open sites</span>
            <h1>Sites and colours</h1>
            <p className="lead">Each site's colour shows on its badge, main card and progress circles, so everyone knows where they are. Green, amber and red stay for status.</p>
          </div>

          <div className="colour-cols">
            <div className="colourlist" role="listbox" aria-label="Sites">
              {SITES.map((s) => {
                const c = siteColour(s.code, choices);
                return (
                  <button key={s.code} type="button" role="option" aria-selected={s.code === sel} aria-current={s.code === sel ? 'true' : undefined}
                    className="row-site" onClick={() => setSel(s.code)}>
                    <SiteMono code={s.code} size="lg" />
                    <span className="tx"><span>{s.name}</span><small>{c.name}{choices[s.code] ? '' : ' · default'}</small></span>
                    <span className="colourchip" style={colourVars(c) as React.CSSProperties} aria-hidden="true" />
                  </button>
                );
              })}
            </div>

            <div className="colour-edit">
              <div className="hero colour-preview" style={colourVars(cur) as React.CSSProperties}>
                <span className="sitebrand-hero"><SiteMono code={sel} />{site.name}</span>
                <span className="hl">Preview · net so far</span>
                <div className="big"><b>£1,840</b><i>.50</i></div>
              </div>

              <section className="grp">
                <div className="hd"><h2>Colour for {site.name}</h2><span>{cur.name}</span></div>
                <div className="swatches" role="radiogroup" aria-label={`Colour for ${site.name}`}>
                  {COLOUR_PRESETS.map((p) => (
                    <button key={p.id} type="button" role="radio" aria-checked={presetId === p.id} aria-label={p.name} className="swatch"
                      style={{ background: `radial-gradient(120% 120% at 80% 90%, ${p.light} 0%, ${p.hex} 45%, oklch(from ${p.hex} calc(l * .52) c calc(h - 25)) 100%)` }}
                      onClick={() => change({ preset: p.id })} />
                  ))}
                </div>
                <label className="hue-row">
                  <span>Custom</span>
                  <input className="hue" type="range" min={0} max={359} value={hue} aria-label="Custom colour"
                    onChange={(e) => change({ hue: Number(e.target.value) })} />
                </label>
              </section>

              <div className="panel colour-note">
                <span className="sitemono" style={colourVars(cur) as React.CSSProperties} aria-hidden="true">Aa</span>
                <span className="tx">
                  <span>{cur.adjusted ? 'Adjusted for readability' : 'Passes contrast checks'}</span>
                  <small>Text on it is {cur.on === '#FFFFFF' ? 'white' : 'dark'}, picked for you, in light and dark mode.</small>
                </span>
              </div>

              <div className="colour-actions">
                {choice && <button type="button" className="linkbtn" onClick={() => change(null)}>Back to the default colour</button>}
                {undo && undo.code === sel && (
                  <button type="button" className="linkbtn" onClick={() => { setChoice(undo.code, undo.choice); setUndo(null); }}>Undo</button>
                )}
                <span className="note" role="status">Saved on this device. Connected mode saves it for everyone.</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </HeadOfficeShell>
  );
}
