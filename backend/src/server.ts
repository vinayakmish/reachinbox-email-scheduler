import { createApp } from './app';
import { config } from './config';
import { prisma } from './config/prisma';
import { getRedisClient, closeRedis } from './config/redis';
import { createEmailWorker } from './workers/emailWorker';
import { closeEmailQueue } from './queues/emailQueue';
import { ensureLocalServices } from './utils/ensureServices';
import { reconcilePendingJobs } from './services/reconciler';
import { logger } from './utils/logger';

async function main() {
  // Automatically ensure PostgreSQL & Redis are running on Windows
  await ensureLocalServices();

  // Initialize Redis connection
  getRedisClient();

  // Start the email worker
  const worker = createEmailWorker();

  // Reconcile and promote any pending/elapsed email jobs
  await reconcilePendingJobs();

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, env: config.nodeEnv },
      `🚀 ReachInbox backend listening on port ${config.port}`,
    );
  });

  // Graceful shutdown
  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down gracefully...');

    server.close(async () => {
      try {
        await worker.close();
        await closeEmailQueue();
        await closeRedis();
        await prisma.$disconnect();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
