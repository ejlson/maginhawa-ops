import { useState } from 'react';
import { useNavigate } from 'react-router';
import { deliveryProblems, FRIDGE_MAX_C, type DeliveryItem } from '@maginhawa/core';
import { useAuth } from '../lib/auth';
import { useFoodSafety } from '../lib/food-safety';
import { useChecklists } from '../lib/checklists';
import { now } from '../lib/clock';
import { ChipRadio, Foot, Icon, Nav, TempInput, Toggle } from '../components/ui';
import { ICONS, parseTemp } from '../components/ui-helpers';

/** Check in a delivery: supplier, chilled temperature, packaging, and each item's batch and use-by. */
export default function FsDeliveryNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, addDelivery } = useFoodSafety();
  const { businessDate: today } = useChecklists();
  const [supplier, setSupplier] = useState(data.approvedSuppliers[0] ?? '');
  const [chilled, setChilled] = useState('');
  const [packagingOk, setPackagingOk] = useState(true);
  const [items, setItems] = useState<DeliveryItem[]>([{ name: '', batch: '', useBy: '' }]);
  const [rejected, setRejected] = useState<string[]>([]);
  const c = parseTemp(chilled);
  const filled = items.filter((i) => i.name.trim());
  const accepted = filled.filter((i) => !rejected.includes(i.name));
  const problems = deliveryProblems({ supplier, chilledC: c, packagingOk, items: accepted }, data.approvedSuppliers, today);
  const set = (n: number, k: keyof DeliveryItem, v: string) => setItems((x) => x.map((it, i) => (i === n ? { ...it, [k]: v } : it)));

  return (
    <main className="page">
      <Nav back="/food-safety/deliveries" backLabel="Cancel" title="Check in a delivery" />
      <div className="body form">
        <section className="grp">
          <div className="gh"><h2>Supplier</h2></div>
          <div className="chips" role="radiogroup" aria-label="Supplier">
            {data.approvedSuppliers.map((s) => <ChipRadio key={s} checked={supplier === s} onClick={() => setSupplier(s)}>{s}</ChipRadio>)}
          </div>
        </section>
        <section className="grp">
          <div className="sub">
            <label className="fr"><span className="tx"><span>Chilled goods temperature</span><small>{FRIDGE_MAX_C}°C or below · leave empty if nothing chilled</small></span><TempInput label="Chilled goods temperature" invalid={c !== null && c > FRIDGE_MAX_C} value={chilled} onChange={setChilled} /></label>
            <div className="fr"><span>Packaging undamaged</span><Toggle label="Packaging undamaged" checked={packagingOk} onChange={setPackagingOk} /></div>
          </div>
        </section>
        <section className="grp">
          <div className="hd"><h2>Items</h2><span>Copy from the label</span></div>
          {items.map((it, n) => (
            <div className="sub item-card" key={n}>
              <label className="fr"><span>Item</span><input className="in wide-in" aria-label={`Item ${n + 1}`} placeholder="e.g. Chicken thighs 10 kg" value={it.name} onChange={(e) => set(n, 'name', e.target.value)} /></label>
              <label className="fr"><span>Batch code</span><input className="in wide-in" aria-label={`Batch code ${n + 1}`} placeholder="e.g. L2611" value={it.batch} onChange={(e) => set(n, 'batch', e.target.value)} /></label>
              <label className="fr"><span>Use by</span><input className="in wide-in" type="date" aria-label={`Use by ${n + 1}`} value={it.useBy} onChange={(e) => set(n, 'useBy', e.target.value)} /></label>
              {it.name.trim() && <div className="fr"><span>Reject this item</span><Toggle label={`Reject ${it.name}`} checked={rejected.includes(it.name)} onChange={(on) => setRejected((x) => (on ? [...x, it.name] : x.filter((y) => y !== it.name)))} /></div>}
            </div>
          ))}
          <button type="button" className="linkbtn" onClick={() => setItems((x) => [...x, { name: '', batch: '', useBy: '' }])}>Add another item</button>
        </section>
        {problems.length > 0 && <div className="banner warnbox" role="alert"><Icon d={ICONS.bang} size={16} /><span>{problems.join('. ')}. Reject the item or tell your manager.</span></div>}
      </div>
      <Foot>
        <button type="button" className="btn b1" disabled={!filled.length || !supplier} onClick={() => {
          addDelivery({ supplier, receivedAt: now().toISOString(), receivedBy: user?.name ?? 'Kitchen', chilledC: c, packagingOk, items: accepted, rejected });
          navigate('/food-safety/deliveries');
        }}>{rejected.length ? `Accept ${accepted.length} · reject ${rejected.length}` : `Accept ${filled.length || ''} item${filled.length === 1 ? '' : 's'}`.replace('  ', ' ')}</button>
      </Foot>
    </main>
  );
}
