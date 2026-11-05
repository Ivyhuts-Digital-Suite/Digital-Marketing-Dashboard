import { Worker } from 'bullmq';
import { bootstrap, handleProcessSignals } from './bootstrap';
import { loadConfigOrExit } from './config';
import { QUEUE_NAMES, type EmailJobData } from './queues';

/**
 * Background worker process. Runs separately from the API so long-running jobs never
 * block request handling and the two scale independently.
 */
async function main() {
  const config = loadConfigOrExit();
  const { ctx, shutdown } = await bootstrap(config, 'worker');
  if (!ctx.redis) {
    ctx.logger.error('REDIS_URL is required to run the worker');
    await shutdown('no-redis');
    process.exit(1);
  }

  const emailWorker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job) => {
      await ctx.mailer.deliver(job.data);
    },
    { connection: ctx.redis.duplicate({ maxRetriesPerRequest: null }), concurrency: 5 },
  );
  emailWorker.on('completed', (job) => ctx.logger.info({ jobId: job.id, queue: job.queueName }, 'Job completed'));
  emailWorker.on('failed', (job, error) =>
    ctx.logger.error({ jobId: job?.id, queue: job?.queueName, err: { message: error.message } }, 'Job failed'),
  );

  ctx.logger.info({ queues: [QUEUE_NAMES.EMAIL] }, 'Worker started');

  handleProcessSignals(ctx.logger, async (signal) => {
    await emailWorker.close();
    await shutdown(signal);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[worker] Failed to start: ${message}`);
  process.exit(1);
});
