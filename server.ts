import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRouter from './server/routes/auth';
import transactionsRouter from './server/routes/transactions';
import lunchMoneyRouter from './server/routes/lunchmoney';
import aiRouter from './server/routes/ai';
import monthlyCloseRouter from './server/routes/monthlyClose';
import dataRouter from './server/routes/data';

dotenv.config();

export async function createApp(options: { withFrontend?: boolean } = {}) {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'wealth-planning-platform',
      port: PORT,
      env: process.env.NODE_ENV || 'development'
    });
  });

  // Authentication Router (Strict Server-Side Session)
  app.use('/api/auth', authRouter);

  // Transactions Categorization Router
  app.use('/api/transactions', transactionsRouter);

  // Mount Lunch Money API Router
  app.use('/api/lunchmoney', lunchMoneyRouter);

  // Mount AI Financial Intelligence Router
  app.use('/api/ai', aiRouter);
  app.use('/api/monthly-close', monthlyCloseRouter);
  app.use('/api/data', dataRouter);

  // Keep production responses stable and prevent stack/request internals from leaking.
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('[HTTP_ERROR]', { method: req.method, path: req.path, code: err.name });
    if (res.headersSent) return;
    res.status(500).json({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Ocorreu um erro interno.'
    });
  });

  // Vite middleware for development or static serving for production
  if (options.withFrontend && process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const app = await createApp({ withFrontend: true });
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Financial Planning server running on http://0.0.0.0:${PORT} (Node ${process.version}, PID ${process.pid})`);
  });

  // Handle termination signals cleanly
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  });
}

if (process.env.START_SERVER === 'true') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
