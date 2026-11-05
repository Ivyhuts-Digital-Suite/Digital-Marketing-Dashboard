'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { AuditLogDto } from '@mp/types';

export const ACTIVITY_DAYS = 14;

interface DayBucket {
  key: string;
  label: string;
  events: number;
}

/** Buckets real audit events into calendar days (local time) over the last ACTIVITY_DAYS days. */
export function bucketByDay(logs: AuditLogDto[], now = new Date()): DayBucket[] {
  const format = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
  const days: DayBucket[] = [];
  for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    days.push({ key: day.toDateString(), label: format.format(day), events: 0 });
  }
  const index = new Map(days.map((d) => [d.key, d]));
  for (const log of logs) {
    const bucket = index.get(new Date(log.createdAt).toDateString());
    if (bucket) bucket.events += 1;
  }
  return days;
}

function ActivityTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const point = payload?.[0]?.payload as DayBucket | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{point.label}</p>
      <p className="mt-0.5 text-muted">
        <span className="font-semibold tabular-nums text-foreground">{point.events}</span> event{point.events === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/**
 * Single-series magnitude over time: thin bars in one hue, recessive grid, hover tooltip,
 * and an equivalent data table for assistive technology.
 */
export function ActivityChart({ logs }: { logs: AuditLogDto[] }) {
  const data = bucketByDay(logs);

  return (
    <figure>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--subtle)', fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--subtle)', fontSize: 11 }}
              width={40}
            />
            <Tooltip content={(props) => <ActivityTooltip {...props} />} cursor={{ fill: 'var(--surface-hover)' }} />
            <Bar dataKey="events" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">Audit events per day over the last {ACTIVITY_DAYS} days</figcaption>
      <table className="sr-only">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Events</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <td>{d.label}</td>
              <td>{d.events}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
