'use client';

import './globals.css';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center px-6 font-sans">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted">An unexpected error occurred while loading the application.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
