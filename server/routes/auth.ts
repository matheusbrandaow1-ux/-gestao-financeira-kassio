import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

// Server-side secret for HMAC session signing
const SESSION_SECRET = process.env.SESSION_SECRET || 'wealth-planning-auth-session-key-prod-2026';

// 1. EXACT PREDEFINED USERS (SERVER-SIDE ONLY - NEVER EXPOSED TO CLIENT)
interface InternalUser {
  id: string;
  email: string;
  passwordHashOrPlain: string;
  role: 'CONSULTANT' | 'CLIENT';
  name: string;
  displayName: string;
  clientId: string | null;
}

const PREDEFINED_USERS: InternalUser[] = [
  {
    id: 'user-consultant-matheus',
    email: 'matheusbrandao.w1@gmail.com',
    passwordHashOrPlain: 'Matheus177@',
    role: 'CONSULTANT',
    name: 'Matheus Brandão',
    displayName: 'Matheus Brandão',
    clientId: null
  },
  {
    id: 'user-client-kassio',
    email: 'kassiotavares@icloud.com',
    passwordHashOrPlain: 'KassioTw1',
    role: 'CLIENT',
    name: 'Kássio',
    displayName: 'Kássio',
    clientId: 'kassio-pf'
  }
];

export interface SessionPayload {
  id: string;
  email: string;
  role: 'CONSULTANT' | 'CLIENT';
  clientId: string | null;
  name: string;
  displayName: string;
  issuedAt: number;
  expiresAt: number;
}

// Token helpers
export function signSessionToken(payload: Omit<SessionPayload, 'issuedAt' | 'expiresAt'>): string {
  const now = Date.now();
  const sessionData: SessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + (30 * 24 * 60 * 60 * 1000) // 30 days
  };
  const body = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  
  // Timing safe comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const jsonStr = Buffer.from(body, 'base64url').toString('utf8');
    const data: SessionPayload = JSON.parse(jsonStr);
    if (Date.now() > data.expiresAt) {
      return null; // Expired
    }
    return data;
  } catch {
    return null;
  }
}

// Extract session from cookie or Authorization header
export function getSessionFromRequest(req: Request): SessionPayload | null {
  const cookieToken = req.cookies?.wp_session;
  if (cookieToken) {
    const session = verifySessionToken(cookieToken);
    if (session) return session;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    const session = verifySessionToken(bearerToken);
    if (session) return session;
  }

  return null;
}

// Express Auth Middleware
export function requireAuth(req: Request, res: Response, next: () => void) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Sessão inválida ou expirada.'
    });
  }
  (req as any).user = session;
  next();
}

export function requireConsultant(req: Request, res: Response, next: () => void) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Sessão necessária.'
    });
  }
  if (session.role !== 'CONSULTANT') {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Acesso restrito a consultores financeiros.'
    });
  }
  (req as any).user = session;
  next();
}

// ==========================================
// ROUTES
// ==========================================

// 1. POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou senha inválidos.'
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Find predefined user
  const foundUser = PREDEFINED_USERS.find(u => u.email.toLowerCase() === cleanEmail);

  if (!foundUser || foundUser.passwordHashOrPlain !== password) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou senha inválidos.'
    });
  }

  // Create session
  const token = signSessionToken({
    id: foundUser.id,
    email: foundUser.email,
    role: foundUser.role,
    clientId: foundUser.clientId,
    name: foundUser.name,
    displayName: foundUser.displayName
  });

  // Set secure cookie
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('wp_session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  // Return safe user profile (without password!)
  return res.json({
    success: true,
    message: 'Autenticado com sucesso.',
    user: {
      id: foundUser.id,
      email: foundUser.email,
      role: foundUser.role,
      name: foundUser.name,
      displayName: foundUser.displayName,
      clientId: foundUser.clientId
    }
  });
});

// 2. GET /api/auth/session
router.get('/session', (req: Request, res: Response) => {
  const session = getSessionFromRequest(req);

  if (!session) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: 'Nenhuma sessão ativa.'
    });
  }

  return res.json({
    success: true,
    authenticated: true,
    user: {
      id: session.id,
      email: session.email,
      role: session.role,
      name: session.name,
      displayName: session.displayName,
      clientId: session.clientId
    }
  });
});

// 3. POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('wp_session', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax'
  });

  return res.json({
    success: true,
    message: 'Sessão encerrada com sucesso.'
  });
});

export default router;
