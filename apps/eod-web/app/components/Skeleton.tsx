/**
 * Skeleton loading: grey shapes where the screen's content will be, so the layout doesn't jump when it
 * arrives. Same structure as a real screen (one dark hero card, then list groups), with a soft shimmer.
 */
import type { CSSProperties } from 'react';

/** One placeholder bar. `on="hero"` for use inside the dark hero card. */
export function Sk({ w = '100%', h = 14, r = 6, on, style }: { w?: number | string; h?: number; r?: number; on?: 'hero'; style?: CSSProperties }) {
  return <span className={`sk${on === 'hero' ? ' on-hero' : ''}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

/** List rows: a circle and two lines, like a RowLink. */
export function SkRows({ count = 3, label = 'Loading' }: { count?: number; label?: string }) {
  return (
    <div className="sub" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <div className="li sk-li" key={i}>
          <Sk w={40} h={40} r={20} />
          <span className="tx"><Sk w={`${62 - (i % 3) * 12}%`} h={15} /><Sk w={`${38 - (i % 2) * 10}%`} h={12} /></span>
        </div>
      ))}
    </div>
  );
}

/** The dark hero card with its figure and three small stats. */
export function SkHero() {
  return (
    <div className="hero" aria-hidden="true">
      <Sk on="hero" w="45%" h={13} />
      <Sk on="hero" w="55%" h={44} r={10} />
      <div className="hm">
        {[0, 1, 2].map((i) => <span key={i}><Sk on="hero" w="60%" h={16} /><Sk on="hero" w="45%" h={10} /></span>)}
      </div>
    </div>
  );
}

/** A whole screen in outline: title, hero, then two groups of rows. */
export function PageSkeleton({ wide, nav = true }: { wide?: boolean; nav?: boolean }) {
  return (
    <main className={`page${wide ? ' wide' : ''}`} aria-busy="true">
      {nav && <header className="nav" aria-hidden="true"><span style={{ width: 8 }} /><Sk w={120} h={15} /><span style={{ width: 8 }} /></header>}
      <div className="body" style={{ paddingTop: 24 }}>
        <div className="titleblock" aria-hidden="true"><Sk w={110} h={13} /><Sk w={190} h={30} r={8} /></div>
        <SkHero />
        <section className="grp"><div className="gh" aria-hidden="true"><Sk w={140} h={20} /></div><SkRows count={3} /></section>
        <section className="grp"><div className="gh" aria-hidden="true"><Sk w={110} h={20} /></div><SkRows count={2} /></section>
      </div>
    </main>
  );
}
