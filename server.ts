import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import authRouter from './server/routes/auth';
import transactionsRouter from './server/routes/transactions';
import lunchMoneyRouter from './server/routes/lunchmoney';
import aiRouter from './server/routes/ai';

dotenv.config();

async function startServer() {
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

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
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

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
