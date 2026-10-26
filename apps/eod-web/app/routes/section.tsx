import { Navigate, useParams } from 'react-router';
import { SECTION_KEYS, type SectionKey } from '@maginhawa/core';
import { SessionSection } from '../sections/SessionSection';
import { DeliverySection, FeedbackSection, HandoverSection, PromotionsSection, TipsSection, WagesSection } from '../sections/OtherSections';
import { useDraft } from '../lib/draft';

export default function Section() {
  const { section } = useParams();
  const { status } = useDraft();
  if (!section || !(SECTION_KEYS as readonly string[]).includes(section)) return <Navigate to="/close" replace />;
  if (status === 'submitted' || status === 'approved') return <Navigate to="/close/done" replace />;
  const key = section as SectionKey;
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
