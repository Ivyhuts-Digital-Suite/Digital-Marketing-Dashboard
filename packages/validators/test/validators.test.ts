import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  createInvitationSchema,
  createOrganizationSchema,
  listAuditLogsQuerySchema,
  loginSchema,
  registerSchema,
} from '../src';

describe('auth schemas', () => {
  it('normalizes email and enforces the password policy', () => {
    const parsed = registerSchema.parse({ name: ' Ada ', email: ' ADA@Example.COM ', password: 'long-enough-pass-1' });
    expect(parsed).toEqual({ name: 'Ada', email: 'ada@example.com', password: 'long-enough-pass-1' });

    for (const password of ['short1!', 'onlylettersnodigits', '123456789012345']) {
      expect(registerSchema.safeParse({ name: 'A', email: 'a@b.co', password }).success).toBe(false);
    }
  });

  it('rejects non-string credentials (operator injection) and unknown keys', () => {
    expect(loginSchema.safeParse({ email: { $gt: '' }, password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x', role: 'ADMIN' }).success).toBe(false);
  });

  it('requires a new password that differs from the current one', () => {
    const same = changePasswordSchema.safeParse({ currentPassword: 'same-password-123', newPassword: 'same-password-123' });
    expect(same.success).toBe(false);
  });
});

describe('organization schemas', () => {
  it('applies defaults and normalizes currency', () => {
    expect(createOrganizationSchema.parse({ name: 'Acme', currency: 'eur' })).toEqual({
      name: 'Acme',
      timezone: 'UTC',
      currency: 'EUR',
    });
  });

  it('rejects invalid slugs, timezones and SUPER_ADMIN invitations', () => {
    expect(createOrganizationSchema.safeParse({ name: 'Acme', slug: 'Bad Slug!' }).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ name: 'Acme', timezone: 'Nowhere/City' }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ email: 'a@b.co', role: 'SUPER_ADMIN' }).success).toBe(false);
  });

  it('coerces and bounds pagination', () => {
    expect(listAuditLogsQuerySchema.parse({ page: '2', limit: '10' })).toMatchObject({ page: 2, limit: 10 });
    expect(listAuditLogsQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });
});
