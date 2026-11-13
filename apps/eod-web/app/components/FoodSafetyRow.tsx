/** The way into food safety from every home screen, with what needs attention. */
import { useAuth } from '../lib/auth';
import { useFoodSafety } from '../lib/food-safety';
import { attentionFor } from '../lib/food-safety-attention';
import { useChecklists } from '../lib/checklists';
import { now } from '../lib/clock';
import { Icon, RowLink } from './ui';
import { ICONS } from './ui-helpers';

export function FoodSafetyRow() {
  const { user } = useAuth();
  const { site, data, siteCode } = useFoodSafety();
  const { businessDate } = useChecklists();
  if (!user) return null;
  const items = attentionFor(site, data, siteCode, { today: businessDate, now: now(), role: user.role, person: user.name });
  const urgent = items.some((i) => i.level === 'bad');
  return (
    <RowLink to="/food-safety" lead={<span className={`av${items.length ? (urgent ? ' bad' : ' warn') : ''}`}><Icon d={ICONS.thermo} /></span>}
      title="Food safety" sub={items.length ? items.slice(0, 2).map((i) => i.title).join(' · ') : 'Allergens, cooking, probes, deliveries'}
      right={items.length ? <span className={`pill ${urgent ? 'p-bad' : 'p-warn'}`}>{items.length}</span> : undefined} />
  );
}
