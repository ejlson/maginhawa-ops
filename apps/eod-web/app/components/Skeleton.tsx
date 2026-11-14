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

/** The main card as on the new homes (P1, D1): a label, the big figure, the bars, and the Up next pill. */
function SkCard() {
  return (
    <div className="hero mh-card sk-card" aria-hidden="true">
      <Sk on="hero" w="38%" h={13} />
      <Sk on="hero" w="48%" h={48} r={10} />
      <Sk on="hero" w="70%" h={5} r={3} />
      <span className="sk-pill"><Sk on="hero" w="55%" h={16} /><Sk on="hero" w={38} h={38} r={19} /></span>
    </div>
  );
}

const SkGroup = ({ w, rows }: { w: number; rows: number }) => (
  <section className="grp"><div className="gh" aria-hidden="true"><Sk w={w} h={22} r={7} /></div><SkRows count={rows} /></section>
);

/**
 * A whole screen in outline, shown before the app knows who's signed in or how wide the screen is, so it
 * draws both shapes and CSS picks one: on phones the P1 layout (site pill and avatar, title, card, lists, tab
 * bar); from 900px the sidebar and the D1 layout (card beside Needs you, then the day). `wide` is head office,
 * whose sidebar is already drawn.
 */
export function PageSkeleton({ wide }: { wide?: boolean }) {
  return (
    <div className={`skel${wide ? ' skel-ho' : ''}`} aria-busy="true">
      {!wide && (
        <aside className="skel-side" aria-hidden="true">
          <span className="skel-site"><Sk w={34} h={34} r={12} /><span className="tx"><Sk w={70} h={13} /><Sk w={96} h={10} /></span></span>
          <Sk w="100%" h={36} r={12} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <Sk key={i} w={`${60 - (i % 3) * 10}%`} h={14} style={{ margin: '11px 10px' }} />)}
        </aside>
      )}
      <main className="page tabs mh-page skel-main">
        {!wide && <header className="nav homenav skel-top" aria-hidden="true"><Sk w={104} h={40} r={20} /><Sk w={40} h={40} r={20} /></header>}
        <div className="body mh-phone skel-body">
          <div className="titleblock mh-title" aria-hidden="true"><Sk w={180} h={13} /><Sk w={240} h={34} r={9} /></div>
          <div className="skel-top-grid">
            <SkCard />
            <SkGroup w={120} rows={3} />
          </div>
          <SkGroup w={140} rows={2} />
        </div>
        {!wide && <nav className="tabbar skel-tabs" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => <span key={i} className="tab">{i === 0 ? <Sk w={96} h={48} r={24} /> : <Sk w={24} h={24} r={12} />}</span>)}
        </nav>}
      </main>
    </div>
  );
}
