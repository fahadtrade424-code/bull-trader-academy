import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const ADMIN_EMAIL = 'sirhamzawebsite@gmail.com';

// Precomputed scrypt salt + hash for initial password bootstrap when ADMIN_INITIAL_PASSWORD is unset.
// Never stores plaintext password in source code or on disk.
const INITIAL_BOOT_SALT = '727847cee3b561c2e4a4a24e3f664e79';
const INITIAL_BOOT_HASH =
  '85e750b6bf9e21c5e3616d5feab9e8a43ed17318911dd055d4474dd8cf3d0c9aad7d88d31f14e75b7fcbb9a004e3100558cec73344fa8772ae213e16ca221e50';

const DATA_DIR = path.resolve(__dirname, '.data');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

interface AuthRecord {
  email: string;
  passwordSalt: string;
  passwordHash: string;
  passwordChanged: boolean;
  updatedAt: string;
}

interface SessionEntry {
  email: string;
  expiresAt: number;
}

interface VerifiedSession {
  jti: string;
  email: string;
  expiresAt: number;
}

interface ResetTokenRecord {
  email: string;
  expiresAt: number;
  used: boolean;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

interface AuthenticatedRequest extends Request {
  adminSession?: VerifiedSession;
}

const activeSessions = new Map<string, SessionEntry>();
const resetTokens = new Map<string, ResetTokenRecord>();
const rateBuckets = new Map<string, RateBucket>();

function hashPassword(password: string, salt: string = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password: string, salt: string, expectedHashHex: string): boolean {
  if (!password || !salt || !expectedHashHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function ensureAuthStore(): AuthRecord {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const envInitialPassword = (process.env.ADMIN_INITIAL_PASSWORD || '').trim();

  if (fs.existsSync(AUTH_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')) as Partial<AuthRecord>;
      if (parsed && parsed.email === ADMIN_EMAIL && parsed.passwordSalt && parsed.passwordHash) {
        if (envInitialPassword && !parsed.passwordChanged) {
          const { salt, hash } = hashPassword(envInitialPassword);
          const updated: AuthRecord = {
            email: ADMIN_EMAIL,
            passwordSalt: salt,
            passwordHash: hash,
            passwordChanged: false,
            updatedAt: new Date().toISOString(),
          };
          fs.writeFileSync(AUTH_FILE, JSON.stringify(updated, null, 2), { mode: 0o600 });
          return updated;
        }
        return parsed as AuthRecord;
      }
    } catch {
      // Re-initialize corrupted file below
    }
  }

  const initial: AuthRecord = envInitialPassword
    ? (() => {
        const { salt, hash } = hashPassword(envInitialPassword);
        return {
          email: ADMIN_EMAIL,
          passwordSalt: salt,
          passwordHash: hash,
          passwordChanged: false,
          updatedAt: new Date().toISOString(),
        };
      })()
    : {
        email: ADMIN_EMAIL,
        passwordSalt: INITIAL_BOOT_SALT,
        passwordHash: INITIAL_BOOT_HASH,
        passwordChanged: false,
        updatedAt: new Date().toISOString(),
      };

  fs.writeFileSync(AUTH_FILE, JSON.stringify(initial, null, 2), { mode: 0o600 });
  return initial;
}

function saveAuthStore(record: AuthRecord) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(AUTH_FILE, JSON.stringify(record, null, 2), { mode: 0o600 });
}

function createSessionToken(email: string) {
  const jti = crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ jti, email, expiresAt })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const token = `${payload}.${sig}`;
  activeSessions.set(jti, { email, expiresAt });
  return { token, expiresAt };
}

function verifySessionToken(token: string): VerifiedSession | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      jti?: string;
      email?: string;
    };
    if (!decoded?.jti || decoded.email !== ADMIN_EMAIL) return null;
    const entry = activeSessions.get(decoded.jti);
    if (!entry || entry.expiresAt < Date.now()) {
      activeSessions.delete(decoded.jti);
      return null;
    }
    return { jti: decoded.jti, email: entry.email, expiresAt: entry.expiresAt };
  } catch {
    return null;
  }
}

function checkRateLimit(key: string, maxAttempts = 15, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= maxAttempts) {
    return false;
  }
  bucket.count += 1;
  return true;
}

function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const session = verifySessionToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized. Please log in as admin.' });
  }
  req.adminSession = session;
  return next();
}

function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function findValidResetRecord(rawToken: string) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) return null;
  const targetHash = hashResetToken(rawToken);
  for (const [storedHash, record] of resetTokens.entries()) {
    const a = Buffer.from(storedHash, 'hex');
    const b = Buffer.from(targetHash, 'hex');
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      if (record.used || record.expiresAt < Date.now()) {
        resetTokens.delete(storedHash);
        return null;
      }
      return { storedHash, record };
    }
  }
  return null;
}

function resolveAppBaseUrl(req: Request): string {
  const configured = (process.env.APP_URL || '').trim();
  if (configured && configured !== 'MY_APP_URL') {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return configured.replace(/\/+$/, '');
      }
    } catch {
      // Fallback to request host below
    }
  }
  const rawProto = req.get('x-forwarded-proto') || req.protocol || 'http';
  const rawHost = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
  const proto = String(rawProto).split(',')[0].trim();
  const host = String(rawHost).split(',')[0].trim();
  return `${proto}://${host}`.replace(/\/+$/, '');
}

async function sendPasswordResetEmail(toEmail: string, resetUrl: string) {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const from = (process.env.SMTP_FROM || user || ADMIN_EMAIL).trim();

  if (!user || !pass) {
    return { sent: false, reason: 'SMTP_NOT_CONFIGURED' };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"Sir Hamza Bull Trader Academy" <${from}>`,
    to: toEmail,
    subject: 'Admin Password Reset Request — Sir Hamza Bull Trader Academy',
    text: `You requested a password reset for the Sir Hamza Bull Trader Academy Admin Panel.\n\nOpen this secure link within 15 minutes to set a new password:\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0b0c10;color:#f5f2ea;border:1px solid #d4af37;border-radius:8px;">
        <h2 style="color:#f0cf6b;margin-top:0;">Sir Hamza Bull Trader Academy</h2>
        <p style="color:#c8c3b8;">A password reset was requested for the Admin Panel account (${ADMIN_EMAIL}).</p>
        <p style="margin:24px 0;">
          <a href="${resetUrl}" style="display:inline-block;padding:12px 22px;background:#d4af37;color:#0b0c10;font-weight:bold;text-decoration:none;border-radius:6px;">
            Reset Admin Password
          </a>
        </p>
        <p style="font-size:12px;color:#8d887e;">This link expires in 15 minutes and can only be used once.</p>
      </div>
    `,
  });

  return { sent: true };
}

function validatePasswordStrength(password: string): string {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  if (password.length > 128) {
    return 'Password must be 128 characters or fewer.';
  }
  return '';
}

async function startServer() {
  ensureAuthStore();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '64kb' }));

  // Admin Login
  app.post('/api/admin/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`login:${ip}`, 15, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait 10 minutes.' });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Email address and password are required.' });
    }

    const store = ensureAuthStore();
    const emailMatches = email === ADMIN_EMAIL;
    const passwordMatches = verifyPassword(password, store.passwordSalt, store.passwordHash);

    if (!emailMatches || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid admin email or password.' });
    }

    const { token, expiresAt } = createSessionToken(ADMIN_EMAIL);
    return res.json({
      ok: true,
      email: ADMIN_EMAIL,
      token,
      expiresAt,
    });
  });

  // Session Check
  app.get('/api/admin/session', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    return res.json({
      authenticated: true,
      email: req.adminSession!.email,
      expiresAt: req.adminSession!.expiresAt,
    });
  });

  // Logout
  app.post('/api/admin/logout', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    activeSessions.delete(req.adminSession!.jti);
    return res.json({ ok: true });
  });

  // Change Password (Authenticated Admin)
  app.post('/api/admin/change-password', requireAdminAuth, (req, res) => {
    const oldPassword = typeof req.body?.oldPassword === 'string' ? req.body.oldPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const confirmNewPassword =
      typeof req.body?.confirmNewPassword === 'string' ? req.body.confirmNewPassword : '';

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: 'All password fields are required.' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match.' });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({ error: 'New password must differ from the old password.' });
    }

    const store = ensureAuthStore();
    if (!verifyPassword(oldPassword, store.passwordSalt, store.passwordHash)) {
      return res.status(401).json({ error: 'Old password is incorrect.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    saveAuthStore({
      email: ADMIN_EMAIL,
      passwordSalt: salt,
      passwordHash: hash,
      passwordChanged: true,
      updatedAt: new Date().toISOString(),
    });

    // Revoke older sessions and issue a fresh token for the current admin session
    activeSessions.clear();
    const { token, expiresAt } = createSessionToken(ADMIN_EMAIL);

    return res.json({
      ok: true,
      message: 'Admin password updated securely.',
      token,
      expiresAt,
    });
  });

  // Forgot Password — Sends secure reset link strictly to sirhamzawebsite@gmail.com
  app.post('/api/admin/forgot-password', async (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`forgot:${ip}`, 8, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many reset requests. Please try again later.' });
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ error: 'Please enter the registered admin email address.' });
    }

    if (email !== ADMIN_EMAIL) {
      return res.status(400).json({
        error: `Password recovery is only allowed for the registered admin email (${ADMIN_EMAIL}).`,
      });
    }

    // Invalidate previous reset tokens and mint a fresh single-use cryptographic token
    resetTokens.clear();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    resetTokens.set(tokenHash, {
      email: ADMIN_EMAIL,
      expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
      used: false,
    });

    const baseUrl = resolveAppBaseUrl(req);
    const resetUrl = `${baseUrl}/#admin?resetToken=${encodeURIComponent(rawToken)}`;

    try {
      const result = await sendPasswordResetEmail(ADMIN_EMAIL, resetUrl);
      if (!result.sent) {
        console.info(`[Admin Password Reset] SMTP is not configured. Reset URL for ${ADMIN_EMAIL}: ${resetUrl}`);
        return res.status(503).json({
          error:
            'SMTP email credentials are not configured on the server yet. Set SMTP_HOST, SMTP_USER, and SMTP_PASS (Gmail App Password) in Secrets so the reset link can be emailed to sirhamzawebsite@gmail.com.',
        });
      }

      return res.json({
        ok: true,
        emailSent: true,
        message: `A secure password reset link has been sent to ${ADMIN_EMAIL}. Check your inbox and open the link within 15 minutes.`,
      });
    } catch (err) {
      console.error('[Admin Password Reset] Failed to send email:', err);
      return res.status(500).json({
        error: 'Could not send reset email via SMTP. Verify SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.',
      });
    }
  });

  // Verify Password Reset Token before displaying New Password form
  app.get('/api/admin/verify-reset-token', (req, res) => {
    const rawToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    const match = findValidResetRecord(rawToken);
    if (!match) {
      return res.status(400).json({
        valid: false,
        error: 'This password reset link is invalid or has expired.',
      });
    }
    return res.json({
      valid: true,
      email: match.record.email,
    });
  });

  // Complete Password Reset using verified token
  app.post('/api/admin/reset-password', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`reset:${ip}`, 10, 15 * 60 * 1000)) {
      return res.status(429).json({ error: 'Too many reset attempts. Please wait.' });
    }

    const rawToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const confirmNewPassword =
      typeof req.body?.confirmNewPassword === 'string' ? req.body.confirmNewPassword : '';

    const match = findValidResetRecord(rawToken);
    if (!match) {
      return res.status(400).json({
        error: 'Reset link is invalid, already used, or has expired.',
      });
    }

    if (!newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: 'New password and confirmation are required.' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    // Consume token and update password hash atomically
    match.record.used = true;
    resetTokens.delete(match.storedHash);

    const { salt, hash } = hashPassword(newPassword);
    saveAuthStore({
      email: ADMIN_EMAIL,
      passwordSalt: salt,
      passwordHash: hash,
      passwordChanged: true,
      updatedAt: new Date().toISOString(),
    });

    activeSessions.clear();

    return res.json({
      ok: true,
      message: 'Your admin password has been reset. Please log in with your new password.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sir Hamza Bull Trader Academy server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
