/**
 * Head office · Report builder. Finance change the managers' EOD report here: inputs, formulas, checks and
 * what happens after submit. The draft saves itself; a change goes live from the next trading day once a
 * second person in head office approves it. Step 7 of docs/tech-plan/report-builder/BUILD-GUIDE.md.
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useAuth } from '../lib/auth';
import { useDefinitionSave } from '../lib/report-builder/save';
import { Workspace } from '../components/report-builder/Workspace';
import '../report-builder.css';

export default function ReportBuilder() {
  const { user } = useAuth();
  if (!user || user.role !== 'headoffice') return <Navigate to="/" replace />;
  return <Loaded user={user} />;
}

function Loaded({ user }: { user: NonNullable<ReturnType<typeof useAuth>['user']> }) {
  const save = useDefinitionSave(user);
  const [notice, setNotice] = useState<string | null>(null);
  if (!save.view) {
    return (
      <div className="rb"><div className="rb-loading" role="status">
        {save.loadError
          ? <><b>The report builder couldn’t load</b><span className="cap small">{save.loadError}</span><span className="acts"><button type="button" className="btn sm" onClick={() => void save.retry()}>Try again</button><Link className="lnk" to="/head-office">Back to head office</Link></span></>
          : <span className="cap small">Loading the report…</span>}
      </div></div>
    );
  }
  // Starts again from the record after loading, approving, discarding or reloading someone else's change.
  return <Workspace key={save.generation} save={save} user={user} notice={notice} onNotice={setNotice} />;
}
