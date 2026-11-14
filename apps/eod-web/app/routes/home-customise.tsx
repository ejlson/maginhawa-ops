/**
 * Customise home (design W3): hide a widget with –, drag to move it (or use the arrows), add one back
 * from the list. The main card always stays first. Changes save as you go, on this device.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { can, canDoEod, useAuth } from '../lib/auth';
import { now } from '../lib/clock';
import { useDraft } from '../lib/draft';
import { resolveLayout, shiftAt, SHIFTS, useHomeLayout, WIDGETS, type Shift, type WidgetId } from '../lib/home-layout';
import { Icon, Toggle } from '../components/ui';
import { ICONS } from '../components/ui-helpers';
import { RingsCard, WIDGET_ICONS } from '../components/home/widgets';
import { EodCard } from '../components/home/ManagerHome';
import { ChecklistCard, type UpNextStep } from '../components/home/today';

/** A small, live picture of a main card style, to choose from (it can't be tapped into). */
function CardPreview({ style, role }: { style: 'standard' | 'rings'; role: string }) {
  const next: UpNextStep = { to: '/', text: 'Your next step', label: 'Up next' };
  const card = style === 'rings' ? <RingsCard next={next} tour="" />
    : role === 'staff' || role === 'supervisor' ? <ChecklistCard label="Checklists to do today" tour="" next={next} />
    : <EodCard next={next} wide={false} />;
  return <div className="cz-preview" aria-hidden="true" ref={(el) => el?.setAttribute('inert', '')}><div className="cz-preview-in">{card}</div></div>;
}

export default function HomeCustomise() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { settings } = useDraft();
  const role = user?.role ?? 'staff';
  const eod = user ? canDoEod(user) : false;
  const [shift, setShift] = useState<Shift>(() => shiftAt(now(), settings.timezone));
  const layout = useHomeLayout(role, user?.name ?? '', eod, shift);
  const [undoReset, setUndoReset] = useState<typeof layout.snapshot | undefined>(undefined);
  const [resets, setResets] = useState(0);
  if (!user) return null;
  const reset = () => { setUndoReset(layout.snapshot); setResets((r) => r + 1); layout.reset(); };
  return (
    <main className="page wide cz-page">
      {/* W3's own bar: Reset, the title, Done. Nothing to go "back" to: Done is the way out. */}
      <header className="cz-bar">
        <button type="button" className="cz-reset" onClick={reset}>Reset</button>
        <h1>Customise home</h1>
        <button type="button" className="cz-done" onClick={() => navigate('/')}>Done</button>
      </header>
      <div className="body cz-body">
        <p className="lead" style={{ margin: 0 }}>Tap – to hide a widget. Drag ⠿ to move it, or use the arrows. The main card always stays at the top.</p>

        <section className="grp" aria-label="Main card">
          <div className="hd"><h2>Main card</h2></div>
          <div className="cz-cards" role="radiogroup" aria-label="Main card style">
            {(['standard', 'rings'] as const).map((c) => (
              // The preview sits beside the radio, not inside it: a button can't hold links.
              <div key={c} className={`cz-card${layout.card === c ? ' on' : ''}`} onClick={() => layout.setCard(c)}>
                <CardPreview style={c} role={role} />
                <button type="button" role="radio" aria-checked={layout.card === c} className="cz-card-l" onClick={(e) => { e.stopPropagation(); layout.setCard(c); }}>
                  <span className="cz-radio" aria-hidden="true" />{c === 'standard' ? 'Standard' : 'Rings'}
                </button>
              </div>
            ))}
          </div>
          <p className="note" style={{ margin: 0 }}>{layout.card === 'rings' ? 'Checklists, the end of day report and stock counts as rings to close.' : 'The card for your role, with Up next.'}</p>
        </section>

        <section className="grp" aria-label="Change with the shift">
          <div className="li">
            <span className="tx"><span>Change with the shift</span><small>Different widgets for opening (until 11:00), service (until 22:00) and closing. Switches by itself.</small></span>
            <Toggle label="Change with the shift" checked={layout.byShift} onChange={(v) => layout.setByShift(v)} />
          </div>
          {layout.byShift && (
            <div className="seg cz-seg" role="radiogroup" aria-label="Editing the widgets for">
              {SHIFTS.map((x) => <button key={x.id} type="button" role="radio" aria-checked={shift === x.id} onClick={() => setShift(x.id)}>{x.label}</button>)}
            </div>
          )}
        </section>

        <SetEditor key={`${layout.byShift}-${shift}-${resets}`} layout={layout} role={role} eod={eod} canFix={can.fixRepairs(role)} />
      </div>
      {undoReset !== undefined && (
        <div className="toast" role="status">
          <span>Back to the usual layout</span>
          <button type="button" onClick={() => { layout.restore(undoReset); setUndoReset(undefined); setResets((r) => r + 1); }}>Undo</button>
        </div>
      )}
    </main>
  );
}

/** The widgets on the home (for one shift, when sets change with the shift): hide, move, make small, add back. */
function SetEditor({ layout, canFix }: { layout: ReturnType<typeof useHomeLayout>; role: Parameters<typeof resolveLayout>[1]; eod: boolean; canFix: boolean }) {
  const [order, setOrder] = useState<WidgetId[]>(layout.order);
  const [hidden, setHidden] = useState<WidgetId[]>(layout.hidden);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [moved, setMoved] = useState<WidgetId | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: { order: WidgetId[]; hidden: WidgetId[] } } | null>(null);

  const apply = (o: WidgetId[], h: WidgetId[]) => { setOrder(o); setHidden(h); layout.save(o, h); };
  const move = (i: number, d: number) => {
    const o = order.slice(); const j = i + d;
    [o[i], o[j]] = [o[j]!, o[i]!];
    setMoved(o[j]!); apply(o, hidden);
  };
  const hide = (id: WidgetId) => {
    setToast({ text: `${WIDGETS[id].name} hidden`, undo: { order, hidden } });
    apply(order.filter((x) => x !== id), [...hidden, id]);
  };
  const show = (id: WidgetId) => { setMoved(id); setToast(null); apply([...order, id], hidden.filter((x) => x !== id)); };

  // Drag: press the grip and move. Whichever widget is under the pointer gives up its place; let go to drop.
  // Follows the pointer itself, so it works the same with a mouse, a trackpad and a finger.
  const live = useRef({ order, hidden, save: layout.save });
  live.current = { order, hidden, save: layout.save };
  useEffect(() => {
    if (!dragging) return;
    let lastUnder: WidgetId | undefined;
    const moveTo = (e: PointerEvent) => {
      e.preventDefault();
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cz]')?.dataset.cz as WidgetId | undefined;
      // Only when the pointer reaches a different widget: a wide one stays under it after a swap, which would flip back and forth.
      if (!under || under === dragging || under === lastUnder) return;
      lastUnder = under;
      const cur = live.current.order;
      const o = cur.filter((x) => x !== dragging);
      o.splice(cur.indexOf(under), 0, dragging);
      if (o.join() !== cur.join()) { live.current.order = o; setOrder(o); }
    };
    const drop = () => { setMoved(dragging); setDragging(null); live.current.save(live.current.order, live.current.hidden); };
    window.addEventListener('pointermove', moveTo, { passive: false });
    window.addEventListener('pointerup', drop);
    window.addEventListener('pointercancel', drop);
    return () => { window.removeEventListener('pointermove', moveTo); window.removeEventListener('pointerup', drop); window.removeEventListener('pointercancel', drop); };
  }, [dragging]);

  return (
    <>
        <div className="cz-main" aria-hidden="true"><Icon d={ICONS.lock} size={18} /><span><b>Main card</b><small>Always first</small></span></div>

        <section aria-label="On your home">
          <ol className={`cz-grid${dragging ? ' dragging' : ''}`}>
            {order.map((id, i) => (
              <li key={id} data-cz={id} className={`cz-tile${WIDGETS[id].wide ? ' wide' : ''}${dragging === id ? ' drag' : moved === id ? ' on' : ''}`}>
                <button type="button" className="cz-x" onClick={() => hide(id)} aria-label={`Hide ${WIDGETS[id].name}`}><Icon d="M5 12h14" size={11} /></button>
                <span className="cz-grip" aria-hidden="true" title="Drag to move" onPointerDown={(e) => {
                  e.preventDefault();
                  // Let the pointer go, so moving over other widgets is seen (touch would otherwise keep it here).
                  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
                  setMoved(null); setToast(null); setDragging(id);
                }}><Icon d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" size={16} /></span>
                <span className="cz-th"><span className="wi" aria-hidden="true"><Icon d={WIDGET_ICONS[id]} size={16} /></span>{WIDGETS[id].name}</span>
                <span className="cz-sk" style={{ width: '80%' }} /><span className="cz-sk" style={{ width: '55%' }} />
                <span className="cz-arrs">
                  {WIDGETS[id].compact && (id !== 'repairs' || canFix) && (
                    <button type="button" className={`cz-size${layout.small.includes(id) ? ' on' : ''}`} aria-pressed={layout.small.includes(id)} onClick={() => layout.setSmall(id, !layout.small.includes(id))}
                      aria-label={`Show ${WIDGETS[id].name} as a small tile`}>Small</button>
                  )}
                  <button type="button" className="cz-arr" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${WIDGETS[id].name} earlier`}><Icon d={ICONS.up} size={12} /></button>
                  <button type="button" className="cz-arr" disabled={i === order.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${WIDGETS[id].name} later`}><Icon d={ICONS.down} size={12} /></button>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="grp" aria-label="Add widgets">
          <div className="hd"><h2>Add widgets</h2>{hidden.length > 0 && <span>{hidden.length} not on your home</span>}</div>
          {hidden.length ? (
            <div className="sub">
              {hidden.map((id) => (
                <div className="li" key={id}>
                  <span className="av"><Icon d={WIDGET_ICONS[id]} /></span>
                  <span className="tx"><span>{WIDGETS[id].name}</span><small>{WIDGETS[id].desc}</small></span>
                  <button type="button" className="cz-add" onClick={() => show(id)} aria-label={`Add ${WIDGETS[id].name}`}><Icon d={ICONS.plus} size={14} /></button>
                </div>
              ))}
            </div>
          ) : <p className="note" style={{ margin: 0 }}>Every widget is on your home.</p>}
        </section>
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" onClick={() => { apply(toast.undo!.order, toast.undo!.hidden); setToast(null); }}>Undo</button>}
        </div>
      )}
    </>
  );
}
