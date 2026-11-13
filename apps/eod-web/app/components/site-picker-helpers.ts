import { useAuth, useMySites } from '../lib/auth';

/** Can this person switch site from here? */
export function useCanSwitch() {
  const { user } = useAuth();
  const mine = useMySites();
  return Boolean(user && (user.inSite || (user.role !== 'headoffice' && mine.length > 1)));
}
