/**
 * "Your first week": the things a new manager or supervisor does for real, each ticking itself when
 * they do it. Shows after the tour, for two weeks, and goes the day after the last one is ticked.
 */
import { useAuth } from '../../lib/auth';
import { FIRST_WEEK, firstWeekTasks, useTourState } from '../../lib/tour';
import { Pie } from '../ui';
import { useCanSwitch } from '../site-picker-helpers';

export function FirstWeek() {
  const { user } = useAuth();
  const t = useTourState(user);
  const canSwitch = useCanSwitch();
  if (!user) return null;
  const tasks = firstWeekTasks(user.role, t, canSwitch);
  if (!tasks.length) return null;
  const done = tasks.filter((k) => t.did[k]).length;

  return (
    <section className="grp" aria-label="Your first week">
      <div className="hd"><h2>Your first week</h2><span>{done} of {tasks.length}</span></div>
      {done === tasks.length ? (
        <div className="sub">
          <div className="li"><span className="pie fw-pie"><Pie status="done" /></span><span className="tx"><span>You've got the basics</span><small>This card goes away tomorrow.</small></span></div>
        </div>
      ) : (
        <div className="sub">
          {tasks.map((k) => {
            const on = Boolean(t.did[k]);
            return (
              <div key={k} className="li">
                {/* Re-mounts when ticked, so the circle pops in. */}
                <span key={String(on)} className={`pie fw-pie${on ? ' on' : ''}`}><Pie status={on ? 'done' : 'todo'} /></span>
                <span className="tx"><span>{FIRST_WEEK[k].title}</span><small>{on ? FIRST_WEEK[k].done : FIRST_WEEK[k].todo}</small></span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
