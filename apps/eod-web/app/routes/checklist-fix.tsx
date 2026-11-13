import { Navigate, useParams } from 'react-router';
import { runPath } from '../lib/checklists';

/**
 * Failed checks are now dealt with in their own row on the list (FixInRow). This address stays so
 * old links and bookmarks still land somewhere useful: the list, where the fix panel is waiting.
 */
export default function ChecklistFix() {
  const { key: raw = '' } = useParams();
  return <Navigate to={runPath(decodeURIComponent(raw))} replace />;
}
