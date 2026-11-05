import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata: Metadata = { title: 'Budget Management' };

export default function Page() {
  return <ModulePlaceholder href="/campaigns/budget" />;
}
