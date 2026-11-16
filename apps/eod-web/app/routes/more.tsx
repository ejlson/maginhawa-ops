/**
 * More (phone): everything that isn't Today, Close or Checks, grouped the same way as the desktop
 * sidebar, with search at the top so nothing is more than two taps away.
 */
import { Link } from 'react-router';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { PhoneHomeHeader } from '../components/home/shared';
import { TabBar } from '../components/TabBar';
import { CommandMenu } from '../components/CommandMenu';
import { MoreSearch, MoreSections } from '../components/MoreSections';

export default function More() {
  const { user } = useAuth();
  const [search, setSearch] = useState(false);
  if (!user) return null;

  return (
    <main className="page tabs">
      <PhoneHomeHeader />
      <div className="body">
        <div className="top">
          <div className="more-hd"><h1>More</h1>{user && (user.role !== 'headoffice' || user.inSite) ? <Link to="/home/customise" className="chip">Customise home</Link> : null}</div>
          <MoreSearch onOpen={() => setSearch(true)} />
        </div>

        <MoreSections />
      </div>
      <TabBar />
      {search && <CommandMenu onClose={() => setSearch(false)} />}
    </main>
  );
}
