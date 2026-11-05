import { Queue, type JobsOptions } from 'bullmq';
import type { Redis } from 'ioredis';

/**
 * Background job infrastructure (BullMQ on Redis).
 *
 * Queues are created only when REDIS_URL is configured. Producers must handle the
 * "no queues" case (run inline or degrade) so the API works without Redis in development.
 * Future milestones add queues for ad-platform sync, report generation and AI analysis.
 */
export const QUEUE_NAMES = {
  EMAIL: 'email',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface EmailJobData {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface QueueRegistry {
  email: Queue<EmailJobData>;
  close(): Promise<void>;
}

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  // Job payloads can contain links with one-time tokens; do not retain them.
  removeOnComplete: true,
  removeOnFail: { age: 24 * 3600, count: 1000 },
};

export function createQueues(connection: Redis): QueueRegistry {
  const email = new Queue<EmailJobData>(QUEUE_NAMES.EMAIL, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });
  return {
    email,
    async close() {
      await email.close();
    },
  };
}
