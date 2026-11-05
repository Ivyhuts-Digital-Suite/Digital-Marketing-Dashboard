import nodemailer from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';
import { loadServerConfig } from '@mp/config/server-env';
import { createLogger } from '../src/lib/logger';
import { createMailer } from '../src/lib/mailer';
import { redactSensitive } from '../src/lib/redact';
import type { QueueRegistry } from '../src/queues';
import { BASE_TEST_ENV } from './helpers';

const logger = createLogger({ level: 'silent' });
const SMTP_ENV = { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', EMAIL_FROM: 'Platform <no-reply@example.test>' };
const baseConfig = (extra: Record<string, string> = {}) =>
  loadServerConfig({ ...BASE_TEST_ENV, MONGODB_URI: 'mongodb://127.0.0.1:27017/x', ...extra });

describe('redactSensitive', () => {
  it('redacts sensitive keys at any depth and leaves other data intact', () => {
    const input = {
      email: 'a@b.co',
      password: 'p',
      profile: { apiKey: 'k', name: 'n', tokens: [{ refreshToken: 'r' }] },
      Authorization: 'Bearer x',
      when: new Date(0),
    };
    expect(redactSensitive(input)).toEqual({
      email: 'a@b.co',
      password: '[REDACTED]',
      profile: { apiKey: '[REDACTED]', name: 'n', tokens: '[REDACTED]' },
      Authorization: '[REDACTED]',
      when: new Date(0),
    });
  });
});

describe('mailer delivery strategy', () => {
  it('returns manual when SMTP is not configured', async () => {
    const mailer = createMailer(baseConfig(), logger);
    expect(mailer.configured).toBe(false);
    expect(await mailer.send({ to: 'x@example.test', subject: 's', text: 't' })).toBe('manual');
  });

  it('sends inline when SMTP is configured and there is no queue', async () => {
    const transport = nodemailer.createTransport({ jsonTransport: true });
    const spy = vi.spyOn(transport, 'sendMail');
    const mailer = createMailer(baseConfig(SMTP_ENV), logger, undefined, transport);
    expect(await mailer.send({ to: 'x@example.test', subject: 'Hello', text: 'Body' })).toBe('email_sent');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ to: 'x@example.test', from: SMTP_ENV.EMAIL_FROM }));
  });

  it('queues when SMTP and Redis queues are available', async () => {
    const add = vi.fn().mockResolvedValue({});
    const queues = { email: { add }, close: vi.fn() } as unknown as QueueRegistry;
    const mailer = createMailer(baseConfig(SMTP_ENV), logger, queues, nodemailer.createTransport({ jsonTransport: true }));
    expect(await mailer.send({ to: 'x@example.test', subject: 'Queued', text: 'Body' })).toBe('email_queued');
    expect(add).toHaveBeenCalledWith('send', expect.objectContaining({ subject: 'Queued' }));
  });
});
