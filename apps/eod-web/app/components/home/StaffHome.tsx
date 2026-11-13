/** Staff, usually on the shared kitchen iPad: their next checklist, the rest of today, last night's note. */
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatDay } from '../../lib/draft';
import { isDone, runPath, useChecklists } from '../../lib/checklists';
import { useSite } from '../../lib/site';
import { Icon } from '../ui';
import { ICONS } from '../ui-helpers';
import { TabBar } from '../TabBar';
import { AllDoneHero, HomeHeader, NextChecklistHero, TaskRow, TimelineRow } from './shared';
import { firstName, useToday } from './shared-helpers';
import { FoodSafetyRow } from '../FoodSafetyRow';
import { Columns } from '../Columns';

export function StaffHome() {
  const { user } = useAuth();
  const { businessDate } = useChecklists();
  const { handover, handoverBy } = useSite();
  const { tasks, urgent, next } = useToday();
  const reported = Boolean((useLocation().state as { reported?: boolean } | null)?.reported);
  const focus = urgent[0] ?? next;
  const left = tasks.filter((t) => !isDone(t) && t.key !== focus?.key);
  const done = tasks.filter(isDone);

  return (
    <main className="page tabs">
      <HomeHeader />
      <Columns
        top={<>
          <div className="titleblock">
            <span className="eyebrow">{formatDay(businessDate)}</span>
            <h1>Hi {firstName(user?.name ?? '')}</h1>
          </div>
          {reported && <div className="banner" role="status"><Icon d={ICONS.check} size={16} /><span>Sent. Your manager can see it now.</span></div>}
        </>}
        hero={<>
          {focus ? <NextChecklistHero focus={focus} label="Your next checklist" /> : <AllDoneHero />}
        </>}
        main={<>

        {(left.length > 0 || done.length > 0) && (
          <section className="grp" data-tour="todo">
            <div className="hd"><h2>Still to do</h2><span>{left.length ? `${left.length} left` : 'All done'}</span></div>
            <div className="sub">
              {left.map((t) => <TaskRow key={t.key} t={t} />)}
              {done.map((t) => <TaskRow key={t.key} t={t} me={user?.name} />)}
              <TimelineRow />
              <FoodSafetyRow />
            </div>
          </section>
        )}
        </>}
        side={<>
        {handover.length > 0 && (
          <section className="grp">
            <div className="hd"><h2>From last night</h2>{handoverBy && <span>{handoverBy}</span>}</div>
            <div className="notecard">
              <span className="av"><Icon d={ICONS.chat} /></span>
              <div className="tx">{handover.map((h) => <span key={h.id} style={{ lineHeight: 1.45 }}>{h.body}</span>)}</div>
            </div>
          </section>
        )}
        </>}
        actions={<>
        {focus && <Link className="btn b1" data-tour="next" to={runPath(focus.key)}>{focus.status === 'late' || focus.status === 'missed' ? 'Do now' : 'Start'}: {focus.title}</Link>}
        <Link className="btn b2" to="/report"><Icon d={ICONS.wrench} size={17} />Report a problem</Link>
        </>}
      />
      <TabBar />
    </main>
  );
}
