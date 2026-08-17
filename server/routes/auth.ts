import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

// Server-side secret for HMAC session signing
// STRICT REQUIREMENT: Must be explicitly provided via process.env.SESSION_SECRET.
// Zero fallbacks, zero hardcoded defaults, zero auto-generation. Fail closed if absent.
function getRequiredSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    throw new Error('SESSION_SECRET_MISSING');
  }
  return secret.trim();
}

// 1. DYNAMIC PREDEFINED USERS (SERVER-SIDE ONLY - NEVER EXPOSED TO CLIENT)
interface InternalUser {
  id: string;
  email: string;
  passwordSecret: string;
  role: 'CONSULTANT' | 'CLIENT';
  name: string;
  displayName: string;
  clientId: string | null;
}

function getPredefinedUsers(): InternalUser[] {
  const consultantEmail = (process.env.CONSULTANT_EMAIL || 'matheusbrandao.w1@gmail.com').trim().toLowerCase();
  const consultantPassword = process.env.CONSULTANT_PASSWORD || '';

  const configuredClientEmail = process.env.CLIENT_EMAIL ? process.env.CLIENT_EMAIL.trim().toLowerCase() : '';
  const clientPassword = process.env.CLIENT_PASSWORD || '';

  const users: InternalUser[] = [
    {
      id: 'user-consultant-matheus',
      email: consultantEmail,
      passwordSecret: consultantPassword,
      role: 'CONSULTANT',
      name: 'Matheus Brandão',
      displayName: 'Matheus Brandão',
      clientId: null
    }
  ];

  if (configuredClientEmail) {
    users.push({
      id: 'user-client-kassio',
      email: configuredClientEmail,
      passwordSecret: clientPassword,
      role: 'CLIENT',
      name: 'Kássio',
      displayName: 'Kássio',
      clientId: 'kassio-pf'
    });
  } else {
    // Default acceptable client email handles if CLIENT_EMAIL secret not set yet
    users.push(
      {
        id: 'user-client-kassio',
        email: 'kassio.client@wealthplanning.com',
        passwordSecret: clientPassword,
        role: 'CLIENT',
        name: 'Kássio',
        displayName: 'Kássio',
        clientId: 'kassio-pf'
      },
      {
        id: 'user-client-kassio',
        email: 'kassiotavares@icloud.com',
        passwordSecret: clientPassword,
        role: 'CLIENT',
        name: 'Kássio',
        displayName: 'Kássio',
        clientId: 'kassio-pf'
      }
    );
  }

  return users;
}

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

// Token helpers (Strict fail-closed if SESSION_SECRET is missing)
export function signSessionToken(payload: Omit<SessionPayload, 'issuedAt' | 'expiresAt'>): string {
  const secret = getRequiredSessionSecret();
  const now = Date.now();
  const sessionData: SessionPayload = {
    ...payload,
    issuedAt: now,
    expiresAt: now + (30 * 24 * 60 * 60 * 1000) // 30 days
  };
  const body = Buffer.from(JSON.stringify(sessionData)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  let secret: string;
  try {
    secret = getRequiredSessionSecret();
  } catch {
    // Fail-closed: Cannot verify any session without configured SESSION_SECRET
    return null;
  }

  const [body, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  
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

/**
 * Validates and resolves the authorized clientId for the current request.
 * CLIENT role can ONLY access their own assigned clientId ('kassio-pf').
 * CONSULTANT role can access any requested client.
 */
export function resolveAuthorizedClientId(req: Request, requestedClientId?: string): { authorizedClientId: string; isAllowed: boolean } {
  const session = getSessionFromRequest(req);
  if (!session) {
    return { authorizedClientId: 'kassio-pf', isAllowed: false };
  }

  if (session.role === 'CLIENT') {
    const clientAssignedId = session.clientId || 'kassio-pf';
    if (requestedClientId && requestedClientId !== clientAssignedId) {
      return { authorizedClientId: clientAssignedId, isAllowed: false };
    }
    return { authorizedClientId: clientAssignedId, isAllowed: true };
  }

  // Consultant has access to requested or default client
  return { authorizedClientId: requestedClientId || 'kassio-pf', isAllowed: true };
}

// Timing-safe password check using sha256 hashes
function verifyPasswordSafe(inputPassword: string, storedSecret: string): boolean {
  if (!storedSecret || !inputPassword) return false;
  const hashA = crypto.createHash('sha256').update(inputPassword).digest();
  const hashB = crypto.createHash('sha256').update(storedSecret).digest();
  return crypto.timingSafeEqual(hashA, hashB);
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
  const users = getPredefinedUsers();

  // Find predefined user
  const foundUser = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!foundUser) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou senha inválidos.'
    });
  }

  // Check if server secrets are configured
  if (!foundUser.passwordSecret) {
    return res.status(500).json({
      success: false,
      code: 'SECRETS_NOT_CONFIGURED',
      message: 'As credenciais deste usuário ainda não foram configuradas nas variáveis de ambiente do servidor (Secrets).'
    });
  }

  const isValidPassword = verifyPasswordSafe(password, foundUser.passwordSecret);
  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou senha inválidos.'
    });
  }

  // Verify that SESSION_SECRET is configured before issuing token
  let token: string;
  try {
    token = signSessionToken({
      id: foundUser.id,
      email: foundUser.email,
      role: foundUser.role,
      clientId: foundUser.clientId,
      name: foundUser.name,
      displayName: foundUser.displayName
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      code: 'SESSION_SECRET_NOT_CONFIGURED',
      message: 'Erro de segurança do servidor: SESSION_SECRET não configurado nos Secrets.'
    });
  }

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
