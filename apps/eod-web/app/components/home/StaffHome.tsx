/** Staff, usually on the shared kitchen iPad: their checklists today, the next one, and a way to report a problem (P1 pattern). */
import { useLocation } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatDay, timeHM, useDraft } from '../../lib/draft';
import { useChecklists } from '../../lib/checklists';
import { useTwoColumns } from '../../lib/wide';
import { Icon } from '../ui';
import { ICONS } from '../ui-helpers';
import { TabBar } from '../TabBar';
import { HomeHeader } from './shared';
import { firstName, useToday } from './shared-helpers';
import { checklistStep, ChecklistCard, ChecklistsSection, EndOfDaySection, FoodSafetySection, RepairsSection, service } from './today';

export function StaffHome() {
  const { user } = useAuth();
  const { businessDate } = useChecklists();
  const { savedAt, settings } = useDraft();
  const { at, tasks, urgent, next } = useToday();
  const wide = useTwoColumns();
  const reported = Boolean((useLocation().state as { reported?: boolean } | null)?.reported);
  const card = <ChecklistCard label="Your checklists" tour="hero-check" next={checklistStep(urgent[0] ?? next, tasks.filter((t) => t.status === 'missed').length)} />;
  const title = (
    <div className="titleblock mh-title">
      <span className="eyebrow">{formatDay(businessDate)}{wide ? '' : service(at, settings.timezone)}</span>
      <h1>Hi {firstName(user?.name ?? '')}</h1>
    </div>
  );
  const banner = reported && <div className="banner" role="status"><Icon d={ICONS.check} size={16} /><span>Sent. Your manager can see it now.</span></div>;

  if (wide) {
    return (
      <main className="page tabs mh-page wide">
        <div className="body mh-desk">
          <div className="mh-head">{title}<span className="saved" data-tour="sync"><span className="dot" />{savedAt ? `All saved · ${timeHM(savedAt)}` : 'Saved on this device'}</span></div>
          {banner}
          <div className="mh-top">{card}<ChecklistsSection /></div>
          <div className="mh-pair"><RepairsSection at={at} list={false} report /><div className="mh-stack"><EndOfDaySection eodRow={false} /><FoodSafetySection /></div></div>
        </div>
      </main>
    );
  }
  return (
    <main className="page tabs mh-page">
      <HomeHeader />
      <div className="body mh-phone">
        {title}
        {banner}
        {card}
        <ChecklistsSection />
        <EndOfDaySection eodRow={false} />
        <FoodSafetySection />
        <RepairsSection at={at} list={false} report />
      </div>
      <TabBar />
    </main>
  );
}
