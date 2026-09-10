import './src/utils/logger.js';
import express from 'express';
import morgan from 'morgan';
import { env } from './src/config/env.js';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './src/routes/index.js';
import authRoutes from './src/routes/authRoutes.js';
import claimRoutes from './src/routes/claimRoutes.js';
import waHealthRoutes from './src/routes/waHealthRoutes.js';
import { notFound, errorHandler } from './src/middleware/errorHandler.js';
import { authRequired } from './src/middleware/authMiddleware.js';
import { dedupRequest } from './src/middleware/dedupRequestMiddleware.js';
import { sensitivePathGuard } from './src/middleware/sensitivePathGuard.js';
import { authLimiter, claimLimiter } from './src/middleware/rateLimiters.js';
import { startOtpWorker } from './src/service/otpQueue.js';
import { getWaReadinessSummary } from './src/service/waService.js';

startOtpWorker().catch(err => console.error('[OTP] worker error', err));

const app = express();
app.disable('etag');

app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(dedupRequest);
app.use(sensitivePathGuard);

app.all('/', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/readyz', async (_req, res) => {
  try {
    const summary = await getWaReadinessSummary();
    const clients = Object.values(summary?.clients || {}).map((client) => ({
      label: client.label,
      ready: Boolean(client.ready),
      observedState: client.observedState || null,
      lastLifecycleEvent: client.lastLifecycleEvent || null,
      lastLifecycleAt: client.lastLifecycleAt || null,
      awaitingQrScan: Boolean(client.awaitingQrScan),
    }));
    const ready = clients.length > 0 && clients.every((client) => client.ready);
    return res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      shouldInitWhatsAppClients: Boolean(summary?.shouldInitWhatsAppClients),
      clients,
    });
  } catch (err) {
    return res.status(503).json({ status: 'down', message: err?.message || 'WA readiness unavailable' });
  }
});
app.all('/_next/dev/', (req, res) => res.status(200).json({ status: 'ok' }));

// ===== ROUTE LOGIN (TANPA TOKEN) =====
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/claim', claimLimiter, claimRoutes);
app.use('/api/health/wa', authRequired, waHealthRoutes);

// ===== ROUTE LAIN (WAJIB TOKEN) =====
app.use('/api', authRequired, routes);

// Handler NotFound dan Error
app.use(notFound);
app.use(errorHandler);

const PORT = env.PORT;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
