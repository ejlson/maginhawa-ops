import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { formatPounds, periodRange, periodStats, breakdown, PERIOD_NAMES, SITES, type Period, type PeriodStats } from '@maginhawa/core';
import { useTradingHistory } from '../lib/history';
import { settingsFor } from '../lib/draft';
import { Icon, ICONS, Nav, RowLink, SECTION_ICONS } from '../components/ui';
import { TrendChart } from '../components/TrendChart';

type Tone = 'good' | 'bad' | 'flat';

/** Change vs the period before, coloured by whether it's good news (wages and cash short are better down). */
function Tile({ label, value, change, valueClass }: { label: string; value: string; change: { text: string; tone: Tone } | null; valueClass?: string }) {
  return (
    <div className="tile">
      <span className="l">{label}</span>
      <span className={`v ${valueClass ?? ''}`}>{value}</span>
      <span className={`c ${change?.tone ?? 'flat'}`}>{change?.text ?? 'Nothing to compare with'}</span>
    </div>
  );
}

const pctChange = (now: number | null, before: number | null, upIsGood: boolean): { text: string; tone: Tone } | null => {
  if (now === null || before === null || !before) return null;
  const r = now / before - 1;
  if (Math.abs(r) < 0.005) return { text: 'About the same', tone: 'flat' };
  return { text: `${r > 0 ? '▲' : '▼'} ${Math.abs(r * 100).toFixed(1)}%`, tone: (r > 0) === upIsGood ? 'good' : 'bad' };
};

/** Head office · one restaurant over a chosen period: trend, forecast, the key figures and what made them. */
export default function HeadOfficeSite() {
  const { site: code = '' } = useParams();
  const site = SITES.find((s) => s.code === code.toUpperCase());
  const { rows: all, example, lastDate } = useTradingHistory();
  const [period, setPeriod] = useState<Period>('1W');
  const rows = useMemo(() => all.filter((r) => r.siteCode === site?.code), [all, site]);

  if (!site) return <Navigate to="/head-office" replace />;
  const settings = settingsFor(site.code);
  const first = rows[0]?.date ?? lastDate;
  const range = periodRange(period, lastDate, first);
  const now = periodStats(rows, range.from, range.to);
  const before: PeriodStats | null = range.prevFrom && range.prevTo ? periodStats(rows, range.prevFrom, range.prevTo) : null;
  const wageClass = now.wagePct === null ? '' : now.wagePct > settings.wageRedPct ? 'bad' : now.wagePct > settings.wageAmberPct ? 'warn' : '';
  const ptsChange = (a: number | null, b: number | null) => {
    if (a === null || b === null) return null;
    const d = a - b;
    if (Math.abs(d) < 0.05) return { text: 'About the same', tone: 'flat' as Tone };
    return { text: `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)} pts`, tone: (d < 0 ? 'good' : 'bad') as Tone };
  };
  const total = now.split.lunch + now.split.dinner + now.split.delivery;
  const share = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <main className="page wide">
      <Nav back="/head-office" backLabel="All sites" title={site.name} right={example ? <span className="muted" style={{ fontSize: 13 }}>Example data</span> : undefined} />
      <div className="body" style={{ paddingTop: 16 }}>
        <div className="titleblock"><span className="eyebrow">Restaurant</span><h1>{site.name}</h1></div>

        <TrendChart rows={rows} scope={site.name} period={period} onPeriod={setPeriod} />

        <section className="grp">
          <div className="hd"><h2>{PERIOD_NAMES[period]}</h2><span>{range.from === range.to ? '' : `${range.from.split('-').reverse().join('/')} to ${range.to.split('-').reverse().join('/')}`}</span></div>
          <div className="tiles">
            <Tile label="Covers" value={now.covers.toLocaleString('en-GB')} change={pctChange(now.covers, before?.covers ?? null, true)} />
            <Tile label="Spend per head" value={now.spendPerHead === null ? '—' : formatPounds(now.spendPerHead)} change={pctChange(now.spendPerHead, before?.spendPerHead ?? null, true)} />
            <Tile label="Wage %" value={now.wagePct === null ? '—' : `${now.wagePct}%`} valueClass={wageClass} change={ptsChange(now.wagePct, before?.wagePct ?? null)} />
            <Tile label="Cash" value={now.cashShortNights ? `${formatPounds(Math.abs(now.cashDiff))} ${now.cashDiff < 0 ? 'short' : 'over'}` : 'All balanced'}
              valueClass={now.cashShortNights ? 'warn' : ''}
              change={before ? { text: now.cashShortNights ? `${now.cashShortNights} ${now.cashShortNights === 1 ? 'night' : 'nights'} short` : 'No nights short', tone: now.cashShortNights > before.cashShortNights ? 'bad' : now.cashShortNights < before.cashShortNights ? 'good' : 'flat' } : null} />
          </div>
        </section>

        <section className="grp">
          <div className="hd"><h2>Where the sales came from</h2><span>{formatPounds(total)}</span></div>
          <div className="splitbar" aria-hidden="true">
            <span style={{ flex: now.split.lunch, opacity: 1 }} /><span style={{ flex: now.split.dinner, opacity: 0.55 }} /><span style={{ flex: now.split.delivery, opacity: 0.25 }} />
          </div>
          <div className="sub">
            <RowLink lead={<span className="av"><Icon d={SECTION_ICONS.lunch} /></span>} title="Lunch" sub={`${share(now.split.lunch)}%`} right={<span className="amt">{formatPounds(now.split.lunch)}</span>} />
            <RowLink lead={<span className="av"><Icon d={SECTION_ICONS.dinner} /></span>} title="Dinner" sub={`${share(now.split.dinner)}%`} right={<span className="amt">{formatPounds(now.split.dinner)}</span>} />
            <RowLink lead={<span className="av"><Icon d={SECTION_ICONS.delivery} /></span>} title="Delivery" sub={`${share(now.split.delivery)}%`} right={<span className="amt">{formatPounds(now.split.delivery)}</span>} />
          </div>
        </section>

        <section className="grp">
          <div className="hd"><h2>{period === '1D' ? 'By service' : period === '1W' ? 'By day' : period === '1M' || period === '3M' ? 'By week' : 'By month'}</h2></div>
          <div className="sub">
            {breakdown(rows, period, lastDate).map((b) => (
              <RowLink key={b.label} lead={<span className="av"><Icon d={ICONS.cal} /></span>} title={b.label} sub={b.sub} right={<span className="amt">{formatPounds(b.net)}</span>} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
