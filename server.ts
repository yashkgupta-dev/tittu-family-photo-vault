import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Initialize Firebase Admin SDK using configured Firebase project ID
let firebaseProjectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
try {
  const configFile = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configFile)) {
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (parsed.projectId) {
      firebaseProjectId = parsed.projectId.trim();
    }
  }
} catch {
  // Ignore read error
}

if (!firebaseProjectId) {
  firebaseProjectId = 'glowing-bebop-pct7q';
}

const adminApp = getAdminApps().length > 0
  ? getAdminApps()[0]
  : initAdminApp({ projectId: firebaseProjectId });

const adminAuth = getAdminAuth(adminApp);

// Middleware for parsing JSON and raw bodies
app.use(express.json({ limit: '50mb' }));
app.use(express.raw({ limit: '100mb', type: ['image/*', 'application/octet-stream', 'video/*'] }));

// Supabase configuration from environment (server-side only, never leaked to client)
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
// Support server-side key or existing env variable
const rawKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
const rawBucket = (process.env.VITE_SUPABASE_BUCKET || 'Family photo').trim();

function sanitizeBucket(raw: string): string {
  if (!raw) return 'Family photo';
  let b = raw.trim();
  if ((b.startsWith('"') && b.endsWith('"')) || (b.startsWith("'") && b.endsWith("'"))) {
    b = b.slice(1, -1).trim();
  }
  try {
    b = decodeURIComponent(b);
  } catch {
    // Keep as is
  }
  return b.replace(/^\/+|\/+$/g, '').trim() || 'Family photo';
}

const targetBucket = sanitizeBucket(rawBucket);

let serverSupabaseClient: SupabaseClient | null = null;
if (supabaseUrl && rawKey) {
  serverSupabaseClient = createClient(supabaseUrl, rawKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Extracts and cryptographically verifies the Firebase ID token from Authorization header.
 * Uses Firebase Admin SDK verifyIdToken() against the configured Firebase project.
 * Validates RSA signature, expiration (exp), issuer (iss), audience (aud), and subject (sub).
 *
 * CRITICAL SECURITY CONSTRAINTS:
 * 1. Zero test token or mock bypasses in production.
 * 2. Zero trust in client-supplied user IDs or x-user-id headers.
 * 3. Fails closed (returns null) on any missing, malformed, expired, forged, or unverified token.
 * 4. Derives authenticated UID exclusively from decodedToken.uid.
 */
async function authenticateRequest(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (decodedToken && decodedToken.uid && typeof decodedToken.uid === 'string') {
      return decodedToken.uid;
    }
    return null;
  } catch {
    // Fails closed on any signature forgery, expired token, wrong issuer/audience, or invalid format.
    // Raw tokens and secret credentials are never logged.
    return null;
  }
}

/**
 * Validates that the requested storage path strictly belongs to the authenticated user.
 * TITTU storage path schema: users/<userId>/media/<mediaId>_<cleanName>
 * Protects against path traversal (../) and cross-user impersonation.
 */
function isUserAuthorizedForPath(authenticatedUserId: string, targetPath: string): boolean {
  if (!authenticatedUserId || !targetPath) return false;
  // Guard against path traversal attacks (e.g. users/alice/../bob/media/photo.jpg)
  if (targetPath.includes('..') || targetPath.includes('\\')) return false;

  let cleanPath = targetPath.replace(/^supabase:/, '').trim();

  // Strip bucket prefix if present
  if (cleanPath.startsWith(`${targetBucket}/`)) {
    cleanPath = cleanPath.slice(targetBucket.length + 1);
  }

  // Clean path must strictly start with users/<authenticatedUserId>/
  const expectedPrefix = `users/${authenticatedUserId}/`;
  return cleanPath.startsWith(expectedPrefix);
}

// ----------------------------------------------------
// SECURE LEAST-PRIVILEGE STORAGE API ROUTES
// ----------------------------------------------------

/**
 * GET /api/storage/status - Returns configuration status and security posture
 * Requires valid Firebase authentication. Fails closed on unauthenticated requests.
 */
app.get('/api/storage/status', async (req, res) => {
  const authUserId = await authenticateRequest(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized: Valid Firebase ID token required.' });
  }

  if (!serverSupabaseClient) {
    return res.status(503).json({
      configured: false,
      message: 'Supabase storage is not configured on the server.',
    });
  }

  let isPrivate = true;
  let bucketExists = true;
  try {
    const { data: bInfo } = await serverSupabaseClient.storage.getBucket(targetBucket);
    if (bInfo) {
      isPrivate = !bInfo.public;
    }
  } catch {
    // Default to true
  }

  return res.json({
    configured: true,
    bucket: targetBucket,
    isPrivate,
    bucketExists,
    securityPosture: 'Least-privilege server-side proxy active. Cryptographic Firebase Admin verification enforced.',
  });
});

/**
 * POST /api/storage/upload - Authenticated photo upload
 * Restricts upload strictly to users/<authenticatedUserId>/media/...
 */
app.post('/api/storage/upload', async (req, res) => {
  const authUserId = await authenticateRequest(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized: Valid user authentication required.' });
  }

  const explicitPath = (req.headers['x-target-path'] as string) || '';
  if (explicitPath && !isUserAuthorizedForPath(authUserId, explicitPath)) {
    return res.status(403).json({
      error: 'Forbidden: Access denied. You cannot upload to or overwrite another user\'s photo path.',
      code: 'CROSS_USER_ACCESS_DENIED',
    });
  }

  const mediaId = (req.headers['x-media-id'] as string) || `media_${Date.now()}`;
  const fileName = (req.headers['x-file-name'] as string) || 'photo.jpg';
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const targetPath = explicitPath || `users/${authUserId}/media/${mediaId}_${cleanName}`;
  const contentType = (req.headers['content-type'] as string) || 'application/octet-stream';

  if (!serverSupabaseClient) {
    return res.status(503).json({ error: 'Supabase storage service unavailable.' });
  }

  // Verify binary payload
  const fileBuffer = req.body;
  if (!fileBuffer || (Buffer.isBuffer(fileBuffer) && fileBuffer.length === 0)) {
    return res.status(400).json({ error: 'Missing or empty upload file content.' });
  }

  try {
    const { error: uploadError } = await serverSupabaseClient.storage
      .from(targetBucket)
      .upload(targetPath, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ error: `Upload error: ${uploadError.message}` });
    }

    // Generate ephemeral signed URL (24 hours) for private bucket rendering
    let downloadUrl = '';
    const { data: signedData } = await serverSupabaseClient.storage
      .from(targetBucket)
      .createSignedUrl(targetPath, 60 * 60 * 24);

    if (signedData?.signedUrl) {
      downloadUrl = signedData.signedUrl;
    } else {
      downloadUrl = `/api/storage/download?path=${encodeURIComponent(targetPath)}`;
    }

    return res.json({
      storagePath: `supabase:${targetPath}`,
      downloadUrl,
      fileName: cleanName,
      size: fileBuffer.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/storage/download - Authenticated photo download
 * Validates that the requested photo strictly belongs to the authenticated user.
 */
app.get('/api/storage/download', async (req, res) => {
  const authUserId = await authenticateRequest(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  const requestedPath = (req.query.path as string) || '';
  if (!requestedPath) {
    return res.status(400).json({ error: 'Missing path parameter.' });
  }

  // Strict cross-user isolation: User A CANNOT download User B's photo
  if (!isUserAuthorizedForPath(authUserId, requestedPath)) {
    return res.status(403).json({
      error: 'Forbidden: Access denied. You are not authorized to download this photo.',
      code: 'CROSS_USER_ACCESS_DENIED',
    });
  }

  if (!serverSupabaseClient) {
    return res.status(503).json({ error: 'Supabase storage service unavailable.' });
  }

  let cleanPath = requestedPath.replace(/^supabase:/, '').trim();
  if (cleanPath.startsWith(`${targetBucket}/`)) {
    cleanPath = cleanPath.slice(targetBucket.length + 1);
  }

  try {
    const { data, error } = await serverSupabaseClient.storage
      .from(targetBucket)
      .download(cleanPath);

    if (error || !data) {
      return res.status(404).json({ error: `Photo not found: ${error?.message || 'Object missing'}` });
    }

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = cleanPath.split('/').pop() || 'photo.jpg';

    res.setHeader('Content-Type', data.type || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/storage/signed-url - Authenticated ephemeral signed URL generation
 * Validates that the requested photo strictly belongs to the authenticated user.
 */
app.post('/api/storage/signed-url', async (req, res) => {
  const authUserId = await authenticateRequest(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  const { path: requestedPath, expiresIn = 7200 } = req.body || {};
  if (!requestedPath) {
    return res.status(400).json({ error: 'Missing path in request body.' });
  }

  // Strict cross-user isolation
  if (!isUserAuthorizedForPath(authUserId, requestedPath)) {
    return res.status(403).json({
      error: 'Forbidden: Access denied. You are not authorized to access this photo.',
      code: 'CROSS_USER_ACCESS_DENIED',
    });
  }

  if (!serverSupabaseClient) {
    return res.status(503).json({ error: 'Supabase storage service unavailable.' });
  }

  let cleanPath = requestedPath.replace(/^supabase:/, '').trim();
  if (cleanPath.startsWith(`${targetBucket}/`)) {
    cleanPath = cleanPath.slice(targetBucket.length + 1);
  }

  try {
    const { data, error } = await serverSupabaseClient.storage
      .from(targetBucket)
      .createSignedUrl(cleanPath, Math.min(expiresIn, 86400));

    if (error || !data?.signedUrl) {
      return res.status(500).json({ error: error?.message || 'Failed to create signed URL.' });
    }

    return res.json({ signedUrl: data.signedUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/storage/list - Authenticated listing of objects
 * Restricts listing strictly to the user's own directory users/<authUserId>/
 */
app.get('/api/storage/list', async (req, res) => {
  const authUserId = await authenticateRequest(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  const requestedPrefix = (req.query.prefix as string) || `users/${authUserId}/media`;

  // Prevent path traversal and listing another user's folder
  if (requestedPrefix.includes('..') || requestedPrefix.includes('\\') || !requestedPrefix.startsWith(`users/${authUserId}/`)) {
    return res.status(403).json({
      error: 'Forbidden: Access denied. You cannot list objects belonging to another user.',
      code: 'CROSS_USER_ACCESS_DENIED',
    });
  }

  if (!serverSupabaseClient) {
    return res.status(503).json({ error: 'Supabase storage service unavailable.' });
  }

  try {
    const { data, error } = await serverSupabaseClient.storage
      .from(targetBucket)
      .list(requestedPrefix, { limit: 100 });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ items: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

/**
 * DELETE /api/storage/delete - Authenticated photo deletion
 * Validates that the requested photo strictly belongs to the authenticated user.
 */
app.delete('/api/storage/delete', async (req, res) => {
  const authUserId = await authenticateRequest(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  const { path: requestedPath } = req.body || {};
  if (!requestedPath) {
    return res.status(400).json({ error: 'Missing path in request body.' });
  }

  // Strict cross-user isolation: User A CANNOT delete User B's photo
  if (!isUserAuthorizedForPath(authUserId, requestedPath)) {
    return res.status(403).json({
      error: 'Forbidden: Access denied. You cannot delete another user\'s photo.',
      code: 'CROSS_USER_ACCESS_DENIED',
    });
  }

  if (!serverSupabaseClient) {
    return res.status(503).json({ error: 'Supabase storage service unavailable.' });
  }

  let cleanPath = requestedPath.replace(/^supabase:/, '').trim();
  if (cleanPath.startsWith(`${targetBucket}/`)) {
    cleanPath = cleanPath.slice(targetBucket.length + 1);
  }

  try {
    const { error } = await serverSupabaseClient.storage
      .from(targetBucket)
      .remove([cleanPath]);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, deletedPath: cleanPath });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/storage/verify - Authenticated integrity verification
 */
app.post('/api/storage/verify', async (req, res) => {
  const authUserId = await authenticateRequest(req);
  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
  }

  const { path: requestedPath, expectedSize } = req.body || {};
  if (!requestedPath) {
    return res.status(400).json({ error: 'Missing path in request body.' });
  }

  if (!isUserAuthorizedForPath(authUserId, requestedPath)) {
    return res.status(403).json({
      error: 'Forbidden: Access denied. Cannot verify another user\'s photo.',
      code: 'CROSS_USER_ACCESS_DENIED',
    });
  }

  if (!serverSupabaseClient) {
    return res.status(503).json({ error: 'Supabase storage service unavailable.' });
  }

  let cleanPath = requestedPath.replace(/^supabase:/, '').trim();
  if (cleanPath.startsWith(`${targetBucket}/`)) {
    cleanPath = cleanPath.slice(targetBucket.length + 1);
  }

  try {
    const { data, error } = await serverSupabaseClient.storage
      .from(targetBucket)
      .info(cleanPath);

    if (!error && data) {
      const verified = expectedSize ? data.size === expectedSize : true;
      return res.json({ verified, actualSize: data.size });
    }

    return res.json({ verified: false });
  } catch {
    return res.json({ verified: false });
  }
});

// ----------------------------------------------------
// VITE SPA INTEGRATION (Dev Middlewares / Prod Static)
// ----------------------------------------------------
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TITTU Server] Running on http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[TITTU Server] Failed to start:', err);
  process.exit(1);
});
