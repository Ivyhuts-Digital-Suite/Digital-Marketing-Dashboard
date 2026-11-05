import type { Metadata } from 'next';
import { ModulePlaceholder } from '@/components/module-placeholder';

export const metadata: Metadata = { title: 'Google Ads' };

export default function Page() {
  return <ModulePlaceholder href="/campaigns/google-ads" />;
}
