import { Navigate, useParams } from 'react-router';
import { isEditable, SECTION_KEYS, SECTION_LABELS, type SectionKey } from '@maginhawa/core';
import { SessionSection } from '../sections/SessionSection';
import { DeliverySection, FeedbackSection, HandoverSection, PromotionsSection, TipsSection, WagesSection } from '../sections/OtherSections';
import { useDraft, useWhere } from '../lib/draft';
import { EodSyncNotice } from '../components/Sync';
import { useRestorePlace, useTrackPlace } from '../lib/resume';

export default function Section() {
  const { section } = useParams();
  const { status, draft } = useDraft();
  const track = useTrackPlace(draft.siteCode, draft.businessDate, (section ?? 'lunch') as SectionKey);
  useRestorePlace();
  const valid = Boolean(section && (SECTION_KEYS as readonly string[]).includes(section));
  // Other devices see "Jo is in Dinner".
  useWhere(valid ? SECTION_LABELS[section as SectionKey] : null);
  if (!section || !(SECTION_KEYS as readonly string[]).includes(section)) return <Navigate to="/close" replace />;
  if (!isEditable(status)) return <Navigate to="/close/done" replace />;
  const key = section as SectionKey;
  // Remembers the last field typed in, for "Pick up where you left off" on the hub.
  return <div onFocusCapture={track} style={{ display: 'contents' }}><SectionScreen k={key} /><EodSyncNotice /></div>;
}

function SectionScreen({ k: key }: { k: SectionKey }) {
  switch (key) {
    case 'lunch':
    case 'dinner': return <SessionSection key={key} session={key} />;
    case 'delivery': return <DeliverySection />;
    case 'promotions': return <PromotionsSection />;
    case 'wages': return <WagesSection />;
    case 'tips': return <TipsSection />;
    case 'feedback': return <FeedbackSection />;
    case 'handover': return <HandoverSection />;
  }
}
