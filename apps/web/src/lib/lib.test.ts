import { describe, expect, it } from 'vitest';
import { loginSchema } from '@mp/validators';
import { bucketByDay } from '@/features/dashboard/activity-chart';
import { ApiError } from './api-client';
import { apiFormErrors, validateForm } from './forms';
import { NAVIGATION, matchNavItem } from './navigation';
import { safeNextPath } from './redirect';

describe('safeNextPath', () => {
  it.each([
    ['/workspace/team', '/workspace/team'],
    ['/invitations/accept?token=abc', '/invitations/accept?token=abc'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    [null, '/dashboard'],
  ])('%s → %s', (input, expected) => expect(safeNextPath(input)).toBe(expected));
});

describe('navigation', () => {
  it('matches the most specific entry', () => {
    expect(matchNavItem('/campaigns/google-ads')?.item.title).toBe('Google Ads');
    expect(matchNavItem('/campaigns')?.item.title).toBe('All Campaigns');
    expect(matchNavItem('/nowhere')).toBeUndefined();
  });

  it('has unique hrefs and marks every non-workspace module except the dashboard as planned', () => {
    const items = NAVIGATION.flatMap((s) => s.items);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    const available = items.filter((i) => i.status === 'available').map((i) => i.href);
    expect(available).toEqual(['/dashboard', '/workspace/organizations', '/workspace/team', '/workspace/integrations', '/workspace/settings']);
  });
});

describe('forms', () => {
  it('maps schema issues to field errors', () => {
    const result = validateForm(loginSchema, { email: 'nope', password: '' });
    expect(result.errors).toMatchObject({ email: expect.any(String), password: 'Password is required' });
  });

  it('maps API validation errors to fields', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'The request is invalid', [{ path: 'body.email', message: 'Taken' }]);
    expect(apiFormErrors(error)).toEqual({ fields: { email: 'Taken' }, message: 'The request is invalid' });
  });
});

describe('bucketByDay', () => {
  it('counts events per local day over 14 days and ignores older events', () => {
    const now = new Date(2026, 10, 5, 12);
    const at = (daysAgo: number) => new Date(2026, 10, 5 - daysAgo, 9).toISOString();
    const log = (createdAt: string) => ({ createdAt }) as never;
    const buckets = bucketByDay([log(at(0)), log(at(0)), log(at(3)), log(at(30))], now);
    expect(buckets).toHaveLength(14);
    expect(buckets.at(-1)?.events).toBe(2);
    expect(buckets.at(-4)?.events).toBe(1);
    expect(buckets.reduce((sum, b) => sum + b.events, 0)).toBe(3);
  });
});
