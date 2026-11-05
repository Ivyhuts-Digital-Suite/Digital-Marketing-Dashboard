import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata: Metadata = { title: 'Marketing Analytics' };

export default function Page() {
  return <ModulePlaceholder href="/marketing-analytics" />;
}
