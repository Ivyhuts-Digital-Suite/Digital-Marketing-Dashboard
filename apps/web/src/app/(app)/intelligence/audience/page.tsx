import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata: Metadata = { title: 'Audience Intelligence' };

export default function Page() {
  return <ModulePlaceholder href="/intelligence/audience" />;
}
