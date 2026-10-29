import { useMemo } from 'react';
import { Navigate } from 'react-router';
import { findSite, type Site } from '@maginhawa/core';
import { homeOf, useAuth, useHasMySites, useMySites } from '../lib/auth';
import { SitesOverview } from '../components/SitesOverview';

/** A manager with two or more sites: tonight at just their sites. Tap one to work in it. */
export default function MySites() {
  const { user } = useAuth();
  const key = useMySites().join(',');
  const allowed = useHasMySites();
  const sites = useMemo(() => key.split(',').map((c) => findSite(c)).filter((s): s is Site => Boolean(s)), [key]);
  if (!user) return null;
  if (!allowed) return <Navigate to={homeOf(user)} replace />;
  return <SitesOverview sites={sites} mine />;
}
