/** What each EOD section row says under its name, and the figure on its right. Shared by End of day and Home. */
import { formatPounds, sectionStatus, type EodDraft, type DayResult, type SectionKey } from '@maginhawa/core';

interface Platforms { platforms: { name: string; active: boolean }[] }

export function sectionSub(k: SectionKey, draft: EodDraft, result: DayResult, settings: Platforms): string {
  const st = sectionStatus(draft, k);
  if (st === 'skipped') return "Didn't run today";
  if (k === 'lunch' || k === 'dinner') {
    const s = result.sessions[k];
    return st === 'done' ? (s.covers ? `Completed · ${s.covers} covers` : 'Completed') : st === 'started' ? 'In progress' : 'From the till report';
  }
  if (k === 'delivery') return settings.platforms.filter((p) => p.active).map((p) => p.name).join(', ');
  if (k === 'promotions') return 'Offers, events, anything unusual';
  if (k === 'wages') return result.wagePct !== null ? `${result.wagePct}% of net` : 'From the rota';
  if (k === 'tips') return 'Card tips, cash tips, tronc';
  if (k === 'feedback') return draft.feedback.length ? `${draft.feedback.length} notes` : 'Guests, staff, repairs';
  return draft.handover.length ? `${draft.handover.length} for the opener` : 'Notes for the opener';
}

export function sectionFigure(k: SectionKey, draft: EodDraft, result: DayResult): string {
  if ((k === 'lunch' || k === 'dinner') && sectionStatus(draft, k) === 'done') return formatPounds(result.sessions[k].net);
  if (k === 'delivery' && sectionStatus(draft, k) === 'done') return formatPounds(result.deliveryNet);
  if (k === 'wages' && draft.wages.wageCost !== null) return formatPounds(draft.wages.wageCost);
  return '';
}
