import { Navigate, useParams } from 'react-router';
import { SECTION_KEYS, SECTION_LABELS, type SectionKey } from '@maginhawa/core';
import { SessionSection } from '../sections/SessionSection';
import { DeliverySection, FeedbackSection, HandoverSection, PromotionsSection, TipsSection, WagesSection } from '../sections/OtherSections';
import { useDraft, useWhere } from '../lib/draft';
import { EodSyncNotice } from '../components/Sync';

export default function Section() {
  const { section } = useParams();
  const { status } = useDraft();
  const valid = Boolean(section && (SECTION_KEYS as readonly string[]).includes(section));
  // Other devices see "Jo is in Dinner".
  useWhere(valid ? SECTION_LABELS[section as SectionKey] : null);
  if (!section || !(SECTION_KEYS as readonly string[]).includes(section)) return <Navigate to="/close" replace />;
  if (status === 'submitted' || status === 'approved') return <Navigate to="/close/done" replace />;
  const key = section as SectionKey;
  return <><SectionScreen k={key} /><EodSyncNotice /></>;
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
