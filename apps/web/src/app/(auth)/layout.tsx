import { ChartColumn, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <section className="relative hidden overflow-hidden border-r border-border bg-surface-muted lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChartColumn className="size-4" aria-hidden />
          </span>
          <span className="font-semibold tracking-tight">{process.env.NEXT_PUBLIC_APP_NAME}</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
            Advertising, pipeline and AI insight — in one workspace.
          </h2>
          <p className="mt-4 text-muted">
            Manage Google Ads and Meta Ads, track every lead through your sales pipeline, and act on recommendations grounded
            in your own data.
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-muted">
          <ShieldCheck className="size-4 text-success" aria-hidden />
          Organization data is isolated and every sensitive action is audited.
        </p>
      </section>
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </div>
  );
}
