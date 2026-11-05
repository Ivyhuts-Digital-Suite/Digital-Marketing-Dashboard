import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata: Metadata = { title: 'Scheduled Reports' };

export default function Page() {
  return <ModulePlaceholder href="/reports/scheduled" />;
}
