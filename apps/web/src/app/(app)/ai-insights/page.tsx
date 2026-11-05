import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata: Metadata = { title: 'AI Insights' };

export default function Page() {
  return <ModulePlaceholder href="/ai-insights" />;
}
