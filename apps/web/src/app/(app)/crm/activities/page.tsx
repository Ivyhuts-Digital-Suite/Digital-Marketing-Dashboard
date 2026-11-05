import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata: Metadata = { title: 'Activities' };

export default function Page() {
  return <ModulePlaceholder href="/crm/activities" />;
}
