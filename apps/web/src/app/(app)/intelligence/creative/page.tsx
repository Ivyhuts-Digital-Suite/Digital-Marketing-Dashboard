import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata: Metadata = { title: 'Creative Intelligence' };

export default function Page() {
  return <ModulePlaceholder href="/intelligence/creative" />;
}
