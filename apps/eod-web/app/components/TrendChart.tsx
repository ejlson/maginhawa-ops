/** Net sales over a chosen period, with forecast v1 and its likely range. Drag across it to read a day. */
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { dailyNet, forecastNet, formatPounds, PERIOD_NAMES, PERIODS, periodView, splitPounds, type Period, type TradingDayRow } from '@maginhawa/core';

// Drawn at the card's real width with a fixed height, so text stays 11px and the chart never balloons.
const H = 196;
const T = 10;
const B = 166;
const SCALE_W = 44; // room for the £ scale on the right

/** The element's current width in px (640 until measured, e.g. in tests). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceTicks(lo: number, hi: number): number[] {
  const raw = (hi - lo) / 3 || 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * p).find((s) => s >= raw)!;
  const out: number[] = [];
  for (let x = Math.floor(lo / step) * step; x <= Math.ceil(hi / step) * step + step / 1e6; x += step) out.push(x);
  return out;
}
const scaleLabel = (pence: number) => {
  const pounds = pence / 100;
  return pounds >= 1e6 ? `£${(pounds / 1e6).toFixed(pounds % 1e6 ? 1 : 0)}m` : pounds >= 1e3 ? `£${Math.round(pounds / 1e3)}k` : `£${Math.round(pounds)}`;
};

export function TrendChart({ rows, scope, period: controlled, onPeriod, holidays }: {
  rows: TradingDayRow[];
  /** "all sites" or the site name. */
  scope: string;
  period?: Period;
  onPeriod?: (p: Period) => void;
  holidays?: Set<string>;
}) {
  const [own, setOwn] = useState<Period>('1W');
  const period = controlled ?? own;
  const setPeriod = (p: Period) => (onPeriod ? onPeriod(p) : setOwn(p));
  const [scrub, setScrub] = useState<number | null>(null);
  const [box, W] = useWidth<HTMLDivElement>();
  const R = W - SCALE_W;

  const daily = useMemo(() => dailyNet(rows), [rows]);
  const forecast = useMemo(() => forecastNet(daily, holidays), [daily, holidays]);
  const view = useMemo(() => periodView(daily, period, forecast), [daily, period, forecast]);
  const pts = view.points;

  if (pts.length < 2) {
    return (
      <div className="hero trend">
        <span className="hl">Net sales · {scope}</span>
        <span className="hs-small">Not enough history yet. Trends appear after a few days of closes.</span>
      </div>
    );
  }

  const lo = Math.min(...pts.map((p) => p.p10 ?? p.value));
  const hi = Math.max(...pts.map((p) => p.p90 ?? p.value));
  const ticks = niceTicks(lo * 0.97, hi * 1.02);
  const y0 = ticks[0]!;
  const y1 = ticks[ticks.length - 1]!;
  const x = (i: number) => (i * R) / (pts.length - 1);
  const y = (v: number) => B - ((v - y0) / (y1 - y0 || 1)) * (B - T);
  const firstF = pts.findIndex((p) => p.forecast);
  const lastActual = firstF < 0 ? pts.length - 1 : firstF - 1;

  // Ranged forecast points, joined to the last actual so the band starts from it.
  const band = firstF < 0 ? [] : [lastActual, ...pts.map((_, i) => i).filter((i) => pts[i]!.forecast && pts[i]!.p10 !== null)];
  const bandPath = band.length > 1
    ? `M${band.map((i) => `${x(i)} ${y(pts[i]!.p90 ?? pts[i]!.value)}`).join(' L')} L${[...band].reverse().map((i) => `${x(i)} ${y(pts[i]!.p10 ?? pts[i]!.value)}`).join(' L')} Z`
    : '';

  const step = Math.max(1, Math.round((pts.length - 1) / (period === '1W' ? 6 : 4)));
  const labelAt = pts.map((_, i) => i).filter((i) => i % step === 0);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    setScrub(Math.max(0, Math.min(pts.length - 1, Math.round((px / R) * (pts.length - 1)))));
  };

  const shown = scrub === null ? null : pts[scrub]!;
  const [pounds, pence] = splitPounds(Math.round(shown ? shown.value : view.headline));
  const up = (view.change ?? 0) >= 0;

  return (
    <div className="hero trend">
      <div>
        <span className="hl">Net sales · {scope} · {view.title}</span>
        <div className="trend-fig" aria-live="polite"><b>{pounds}</b><i>{pence}</i></div>
        {shown ? (
          <span className="trend-chg"><span style={{ color: 'var(--onhero)' }}>{shown.detail}</span>{shown.forecast && shown.p10 !== null ? ` · likely ${formatPounds(Math.round(shown.p10))} to ${formatPounds(Math.round(shown.p90!))}` : ''}</span>
        ) : view.change !== null && view.vs ? (
          <span className={`trend-chg ${up ? 'h-ok' : 'h-bad'}`}>{up ? '▲' : '▼'} {Math.abs(view.change * 100).toFixed(1)}% <span className="hs">{view.vs}</span></span>
        ) : (
          <span className="trend-chg hs">{period === 'All' ? 'All recorded sales' : 'Nothing to compare with yet'}</span>
        )}
      </div>

      <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="trend-svg" role="img" aria-label={`Net sales, ${view.title}. ${pts.filter((p) => !p.forecast).length} points${firstF >= 0 ? ', then a forecast' : ''}.`}>
        {ticks.map((t, j) => (
          <g key={t}>
            <line x1={0} x2={R} y1={y(t)} y2={y(t)} stroke="var(--heroline)" strokeOpacity={j === 0 ? 0.9 : 0.45} />
            <text x={W} y={y(t) + 4} textAnchor="end" className="trend-tick">{scaleLabel(t)}</text>
          </g>
        ))}
        {firstF >= 0 && <rect x={x(lastActual)} y={T} width={R - x(lastActual)} height={B - T} fill="var(--onhero)" fillOpacity={0.025} />}
        {bandPath && <path d={bandPath} fill="var(--onhero)" fillOpacity={0.08} />}
        {pts.slice(1).map((p, k) => {
          const a = pts[k]!;
          const isF = p.forecast;
          return (
            <line key={p.date + k} x1={x(k)} y1={y(a.value)} x2={x(k + 1)} y2={y(p.value)}
              stroke={p.value >= a.value ? 'var(--heroOk)' : 'var(--heroBad)'} strokeWidth={isF ? 2 : 2.4}
              strokeLinecap="round" strokeDasharray={isF ? '4 5' : undefined} strokeOpacity={isF ? 0.8 : 1} />
          );
        })}
        {firstF >= 0 && <text x={x(lastActual) + 8} y={T + 12} className="trend-tick" style={{ fontWeight: 600 }}>Forecast</text>}
        <circle cx={x(lastActual)} cy={y(pts[lastActual]!.value)} r={5} fill="var(--onhero)" stroke="var(--hero)" strokeWidth={2.5} />
        {labelAt.map((i) => (
          <text key={i} x={x(i)} y={B + 22} textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'} className="trend-tick">{pts[i]!.label}</text>
        ))}
        {shown && scrub !== null && (
          <g>
            <line x1={x(scrub)} x2={x(scrub)} y1={T} y2={B} stroke="var(--onhero)" strokeOpacity={0.35} />
            <circle cx={x(scrub)} cy={y(shown.value)} r={5} fill="var(--onhero)" stroke="var(--hero)" strokeWidth={2.5} />
          </g>
        )}
        <rect x={0} y={0} width={R} height={B + 28} fill="transparent" style={{ touchAction: 'none', cursor: 'crosshair' }}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setScrub(null)} onPointerUp={(e) => e.pointerType !== 'mouse' && setScrub(null)} />
      </svg>
      </div>

      <div className="range" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={p === period} aria-label={PERIOD_NAMES[p]} className={`rp${p === period ? ' on' : ''}`} onClick={() => { setPeriod(p); setScrub(null); }}>{p}</button>
        ))}
      </div>
      <div className="trend-key">
        <span><i style={{ background: 'var(--heroOk)' }} />Up</span>
        <span><i style={{ background: 'var(--heroBad)' }} />Down</span>
        {firstF >= 0 && <span><i className="dash" />Forecast</span>}
        {bandPath && <span><i className="band" />Likely range (80%)</span>}
      </div>
      <span className="trend-note">{view.note}</span>
    </div>
  );
}
