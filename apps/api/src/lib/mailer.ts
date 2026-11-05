import nodemailer, { type Transporter } from 'nodemailer';
import type { ServerConfig } from '../config';
import type { EmailJobData, QueueRegistry } from '../queues';
import type { Logger } from './logger';

/**
 * Outbound email.
 *
 * Delivery strategy:
 * - SMTP configured + Redis available → queued for the worker (`email_queued`).
 * - SMTP configured, no Redis          → sent inline (`email_sent`).
 * - SMTP not configured                → not sent (`manual`); callers fall back to
 *   showing the link to an authorized user. Message contents are never logged.
 */
export type DeliveryResult = 'email_queued' | 'email_sent' | 'manual';

export interface Mailer {
  readonly configured: boolean;
  send(message: EmailJobData): Promise<DeliveryResult>;
  /** Sends immediately via SMTP. Used by the email worker. */
  deliver(message: EmailJobData): Promise<void>;
}

export function createSmtpTransport(config: ServerConfig): Transporter | null {
  if (!config.email.configured) return null;
  const { host, port, user, password } = config.email;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user && password && { auth: { user, pass: password } }),
  });
}

export function createMailer(
  config: ServerConfig,
  logger: Logger,
  queues?: QueueRegistry,
  transport: Transporter | null = createSmtpTransport(config),
): Mailer {
  const from = config.email.configured ? config.email.from : undefined;

  const deliver = async (message: EmailJobData) => {
    if (!transport || !from) throw new Error('SMTP is not configured');
    await transport.sendMail({ from, to: message.to, subject: message.subject, text: message.text, html: message.html });
  };

  return {
    configured: Boolean(transport),
    deliver,
    async send(message) {
      if (!transport) {
        logger.info({ subject: message.subject }, 'SMTP not configured; email not sent (manual delivery)');
        return 'manual';
      }
      if (queues) {
        await queues.email.add('send', message);
        return 'email_queued';
      }
      await deliver(message);
      return 'email_sent';
    },
  };
}
