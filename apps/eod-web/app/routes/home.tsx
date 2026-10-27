import { useAuth } from '../lib/auth';
import { StaffHome } from '../components/home/StaffHome';
import { SupervisorHome } from '../components/home/SupervisorHome';
import { ManagerHome } from '../components/home/ManagerHome';

/** Each role gets the home screen for what it does: staff the next checklist, supervisors the shift, managers the site. */
export default function Home() {
  const { user } = useAuth();
  if (user?.role === 'staff') return <StaffHome />;
  if (user?.role === 'supervisor') return <SupervisorHome />;
  return <ManagerHome />;
}
