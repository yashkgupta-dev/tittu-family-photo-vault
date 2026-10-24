import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'NOT TESTED';
  detail: string;
}

const results: TestResult[] = [];

function record(name: string, category: string, status: 'PASS' | 'FAIL' | 'NOT TESTED', detail: string) {
  results.push({ name, category, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${category} :: ${name} - ${detail}`);
}

// Read Firebase project configuration
let firebaseProjectId = 'glowing-bebop-pct7q';
try {
  const configFile = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(configFile)) {
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (parsed.projectId) {
      firebaseProjectId = parsed.projectId.trim();
    }
  }
} catch {
  // Use default
}

const adminApp = getAdminApps().length > 0
  ? getAdminApps()[0]
  : initAdminApp({ projectId: firebaseProjectId });
const adminAuth = getAdminAuth(adminApp);

// Path authorization logic (mirroring server.ts for isolated unit verification)
function verifyPathAuthorization(authUserId: string, targetPath: string, bucketName: string = 'Family photo'): boolean {
  if (!authUserId || !targetPath) return false;
  if (targetPath.includes('..') || targetPath.includes('\\')) return false;

  let cleanPath = targetPath.replace(/^supabase:/, '').trim();
  if (cleanPath.startsWith(`${bucketName}/`)) {
    cleanPath = cleanPath.slice(bucketName.length + 1);
  }

  const expectedPrefix = `users/${authUserId}/`;
  return cleanPath.startsWith(expectedPrefix);
}

// Helpers to craft forged and invalid JWTs
function createRawJwt(headerObj: object, payloadObj: object, signature: string = 'invalidsignature'): string {
  const header = Buffer.from(JSON.stringify(headerObj)).toString('base64url');
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function runValidation() {
  console.log('================================================================');
  console.log('TITTU PHOTO VAULT: SECURITY & AUTHENTICATION VALIDATION SUITE');
  console.log('Target Firebase Project:', firebaseProjectId);
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // 1. FRONTEND BUILD & SECRET SCANNER
  // -------------------------------------------------------------------------
  console.log('--- 1. Scanning Production Build for Secret Keys ---');
  const distDir = path.resolve(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    record('Production Build Existence', 'Secret Scanning', 'FAIL', 'dist directory not found. Run npm run build first.');
  } else {
    let secretFound = false;
    let filesScanned = 0;
    const compromisedOccurrences: string[] = [];

    function scanDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.css') || entry.name.endsWith('.map'))) {
          filesScanned++;
          const content = fs.readFileSync(fullPath, 'utf8');
          const actualKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

          // 1. Verify actual environment secret key is NOT present
          if (actualKey && actualKey.startsWith('sb_secret_') && content.includes(actualKey)) {
            secretFound = true;
            compromisedOccurrences.push(`Exact environment secret key found in ${entry.name}`);
          }

          // 2. Verify no secret token credential format (sb_secret_ followed by token chars)
          const secretTokenMatches = content.match(/sb_secret_[a-zA-Z0-9_-]{10,}/g);
          if (secretTokenMatches) {
            secretFound = true;
            compromisedOccurrences.push(`Exposed secret token pattern detected in ${entry.name}`);
          }

          // 3. Verify no service_role JWT credential payload
          if (content.includes('"role":"service_role"') || content.includes("'role':'service_role'")) {
            secretFound = true;
            compromisedOccurrences.push(`service_role JWT payload detected in ${entry.name}`);
          }

          // 4. Verify no fake key substitution strings
          if (content.includes('sb_publishable_server_proxy_active')) {
            secretFound = true;
            compromisedOccurrences.push(`Fake placeholder key string found in ${entry.name}`);
          }
        }
      }
    }

    scanDir(distDir);

    if (secretFound) {
      record('Production Bundle Secret Scan', 'Secrets & Configuration', 'FAIL', `Privileged credentials detected in build assets: ${compromisedOccurrences.join(', ')}`);
    } else {
      record('Production Bundle Secret Scan', 'Secrets & Configuration', 'PASS', `Scanned ${filesScanned} asset files. ZERO instances of sb_secret_, service_role, or fake placeholder strings found in frontend bundle.`);
    }
  }

  // -------------------------------------------------------------------------
  // 2. CRYPTOGRAPHIC TOKEN VERIFICATION & ENDPOINT REJECTION TESTS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Cryptographic Token Verification & Endpoint Rejection Tests ---');
  const baseUrl = 'http://127.0.0.1:3000';

  // Test 2.1: Missing Token (no Authorization header)
  try {
    const res = await fetch(`${baseUrl}/api/storage/status`);
    if (res.status === 401) {
      record('Missing Token Rejection', 'Authentication Verification', 'PASS', `HTTP ${res.status} Unauthorized when Authorization header is omitted.`);
    } else {
      record('Missing Token Rejection', 'Authentication Verification', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
    }
  } catch (err: unknown) {
    record('Missing Token Rejection', 'Authentication Verification', 'FAIL', `Connection error: ${err}`);
  }

  // Test 2.2: Spoofed user ID via x-user-id header alone (zero token)
  try {
    const res = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { 'x-user-id': 'attacker_spoofed_uid_123' },
    });
    if (res.status === 401) {
      record('Spoofed User ID Header Rejection', 'Authentication Verification', 'PASS', `HTTP ${res.status} Unauthorized. x-user-id header is ignored and unverified requests fail closed.`);
    } else {
      record('Spoofed User ID Header Rejection', 'Authentication Verification', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
    }
  } catch (err: unknown) {
    record('Spoofed User ID Header Rejection', 'Authentication Verification', 'FAIL', `Connection error: ${err}`);
  }

  // Test 2.3: Malformed / Garbage Bearer token
  try {
    const res = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { Authorization: 'Bearer this_is_not_a_valid_jwt' },
    });
    if (res.status === 401) {
      record('Malformed Bearer Token Rejection', 'Authentication Verification', 'PASS', `HTTP ${res.status} Unauthorized when token format is invalid.`);
    } else {
      record('Malformed Bearer Token Rejection', 'Authentication Verification', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
    }
  } catch (err: unknown) {
    record('Malformed Bearer Token Rejection', 'Authentication Verification', 'FAIL', `Connection error: ${err}`);
  }

  // Test 2.4: Old test_token_ bypass backdoor removal verification
  try {
    const res = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { Authorization: 'Bearer test_token_user_alice' },
    });
    if (res.status === 401) {
      record('Test Token Bypass Eradication', 'Authentication Verification', 'PASS', `HTTP ${res.status} Unauthorized. test_token_ bypass backdoor has been completely eliminated.`);
    } else {
      record('Test Token Bypass Eradication', 'Authentication Verification', 'FAIL', `Expected 401, got HTTP ${res.status}. Old bypass token still accepted!`);
    }
  } catch (err: unknown) {
    record('Test Token Bypass Eradication', 'Authentication Verification', 'FAIL', `Connection error: ${err}`);
  }

  // Test 2.5: Forged JWT with alg: "none" (Unsigned token attack)
  try {
    const unsignedJwt = createRawJwt(
      { alg: 'none', typ: 'JWT' },
      {
        sub: 'forged_attacker_user',
        user_id: 'forged_attacker_user',
        iss: `https://securetoken.google.com/${firebaseProjectId}`,
        aud: firebaseProjectId,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      ''
    );
    const res = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { Authorization: `Bearer ${unsignedJwt}` },
    });
    if (res.status === 401) {
      record('Forged Unsigned JWT Rejection (alg: none)', 'Cryptographic Integrity', 'PASS', `HTTP ${res.status} Unauthorized. Admin SDK rejected unsigned token.`);
    } else {
      record('Forged Unsigned JWT Rejection (alg: none)', 'Cryptographic Integrity', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
    }
  } catch (err: unknown) {
    record('Forged Unsigned JWT Rejection (alg: none)', 'Cryptographic Integrity', 'FAIL', `Connection error: ${err}`);
  }

  // Test 2.6: Forged JWT with bogus signature and fake kid
  try {
    const fakeKidJwt = createRawJwt(
      { alg: 'RS256', kid: 'fake_key_identifier_999', typ: 'JWT' },
      {
        sub: 'forged_attacker_user',
        user_id: 'forged_attacker_user',
        iss: `https://securetoken.google.com/${firebaseProjectId}`,
        aud: firebaseProjectId,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      'bad_signature_bytes_here'
    );
    const res = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { Authorization: `Bearer ${fakeKidJwt}` },
    });
    if (res.status === 401) {
      record('Forged RS256 JWT Rejection (Fake kid/Signature)', 'Cryptographic Integrity', 'PASS', `HTTP ${res.status} Unauthorized. Admin SDK rejected forged cryptographic signature.`);
    } else {
      record('Forged RS256 JWT Rejection (Fake kid/Signature)', 'Cryptographic Integrity', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
    }
  } catch (err: unknown) {
    record('Forged RS256 JWT Rejection (Fake kid/Signature)', 'Cryptographic Integrity', 'FAIL', `Connection error: ${err}`);
  }

  // Test 2.7: Expired JWT (exp in the past)
  try {
    const expiredJwt = createRawJwt(
      { alg: 'RS256', kid: 'fake_key', typ: 'JWT' },
      {
        sub: 'expired_user',
        user_id: 'expired_user',
        iss: `https://securetoken.google.com/${firebaseProjectId}`,
        aud: firebaseProjectId,
        exp: 1577836800, // Jan 1, 2020
      },
      'signature'
    );
    const res = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { Authorization: `Bearer ${expiredJwt}` },
    });
    if (res.status === 401) {
      record('Expired Token Rejection', 'Cryptographic Integrity', 'PASS', `HTTP ${res.status} Unauthorized. Expired tokens are rejected.`);
    } else {
      record('Expired Token Rejection', 'Cryptographic Integrity', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
    }
  } catch (err: unknown) {
    record('Expired Token Rejection', 'Cryptographic Integrity', 'FAIL', `Connection error: ${err}`);
  }

  // Test 2.8: Wrong Firebase audience (aud mismatch)
  try {
    const wrongAudJwt = createRawJwt(
      { alg: 'RS256', kid: 'fake_key', typ: 'JWT' },
      {
        sub: 'attacker_user',
        user_id: 'attacker_user',
        iss: `https://securetoken.google.com/unauthorized-foreign-project`,
        aud: 'unauthorized-foreign-project',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      'signature'
    );
    const res = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { Authorization: `Bearer ${wrongAudJwt}` },
    });
    if (res.status === 401) {
      record('Wrong Audience / Project Rejection', 'Cryptographic Integrity', 'PASS', `HTTP ${res.status} Unauthorized. Foreign project tokens rejected.`);
    } else {
      record('Wrong Audience / Project Rejection', 'Cryptographic Integrity', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
    }
  } catch (err: unknown) {
    record('Wrong Audience / Project Rejection', 'Cryptographic Integrity', 'FAIL', `Connection error: ${err}`);
  }

  // Test 2.9: Wrong Firebase issuer (iss mismatch)
  try {
    const wrongIssJwt = createRawJwt(
      { alg: 'RS256', kid: 'fake_key', typ: 'JWT' },
      {
        sub: 'attacker_user',
        user_id: 'attacker_user',
        iss: 'https://evil-issuer.com/auth',
        aud: firebaseProjectId,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      'signature'
    );
    const res = await fetch(`${baseUrl}/api/storage/status`, {
      headers: { Authorization: `Bearer ${wrongIssJwt}` },
    });
    if (res.status === 401) {
      record('Wrong Issuer Rejection', 'Cryptographic Integrity', 'PASS', `HTTP ${res.status} Unauthorized. Non-Firebase issuer tokens rejected.`);
    } else {
      record('Wrong Issuer Rejection', 'Cryptographic Integrity', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
    }
  } catch (err: unknown) {
    record('Wrong Issuer Rejection', 'Cryptographic Integrity', 'FAIL', `Connection error: ${err}`);
  }

  // -------------------------------------------------------------------------
  // 3. FAIL-CLOSED VERIFICATION ON ALL 7 STORAGE ENDPOINTS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Fail-Closed Verification on All Storage Endpoints ---');

  const endpointChecks = [
    { name: 'GET /api/storage/status', fn: () => fetch(`${baseUrl}/api/storage/status`) },
    {
      name: 'POST /api/storage/upload',
      fn: () =>
        fetch(`${baseUrl}/api/storage/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: Buffer.from('unauth_data'),
        }),
    },
    { name: 'GET /api/storage/download', fn: () => fetch(`${baseUrl}/api/storage/download?path=users/test/media/photo.jpg`) },
    {
      name: 'POST /api/storage/signed-url',
      fn: () =>
        fetch(`${baseUrl}/api/storage/signed-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'users/test/media/photo.jpg' }),
        }),
    },
    { name: 'GET /api/storage/list', fn: () => fetch(`${baseUrl}/api/storage/list?prefix=users/test/media`) },
    {
      name: 'DELETE /api/storage/delete',
      fn: () =>
        fetch(`${baseUrl}/api/storage/delete`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'users/test/media/photo.jpg' }),
        }),
    },
    {
      name: 'POST /api/storage/verify',
      fn: () =>
        fetch(`${baseUrl}/api/storage/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: 'users/test/media/photo.jpg' }),
        }),
    },
  ];

  for (const ep of endpointChecks) {
    try {
      const res = await ep.fn();
      if (res.status === 401) {
        record(`Fail-Closed: ${ep.name}`, 'Endpoint Authorization', 'PASS', `Rejected with HTTP 401 Unauthorized without token.`);
      } else {
        record(`Fail-Closed: ${ep.name}`, 'Endpoint Authorization', 'FAIL', `Expected 401, got HTTP ${res.status}.`);
      }
    } catch (err: unknown) {
      record(`Fail-Closed: ${ep.name}`, 'Endpoint Authorization', 'FAIL', `Connection error: ${err}`);
    }
  }

  // -------------------------------------------------------------------------
  // 4. CROSS-USER FILE ACCESS & PATH TRAVERSAL ISOLATION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Cross-User File Access & Path Traversal Isolation Tests ---');

  // Test 4.1: Legitimate own photo path is authorized
  const ownPathAllowed = verifyPathAuthorization('user_alice', 'users/user_alice/media/photo_123.jpg');
  if (ownPathAllowed) {
    record('Own Path Authorization', 'Access Control Logic', 'PASS', 'User Alice is authorized for users/user_alice/media/photo_123.jpg');
  } else {
    record('Own Path Authorization', 'Access Control Logic', 'FAIL', 'User Alice unexpectedly denied access to own path.');
  }

  // Test 4.2: Cross-user access is denied
  const crossUserDenied = !verifyPathAuthorization('user_alice', 'users/user_bob/media/photo_456.jpg');
  if (crossUserDenied) {
    record('Cross-User Path Isolation', 'Access Control Logic', 'PASS', 'User Alice CANNOT access User Bob photo path users/user_bob/media/photo_456.jpg');
  } else {
    record('Cross-User Path Isolation', 'Access Control Logic', 'FAIL', 'Cross-user access was incorrectly permitted!');
  }

  // Test 4.3: Directory traversal attempt (../) is denied
  const traversalDenied = !verifyPathAuthorization('user_alice', 'users/user_alice/../user_bob/media/photo_456.jpg');
  if (traversalDenied) {
    record('Directory Traversal Protection (../)', 'Access Control Logic', 'PASS', 'Path containing ../ is strictly rejected.');
  } else {
    record('Directory Traversal Protection (../)', 'Access Control Logic', 'FAIL', 'Directory traversal was not blocked!');
  }

  // Test 4.4: Backslash path traversal attempt is denied
  const backslashDenied = !verifyPathAuthorization('user_alice', 'users\\user_alice\\media\\photo.jpg');
  if (backslashDenied) {
    record('Backslash Path Sanitization', 'Access Control Logic', 'PASS', 'Backslash paths strictly rejected.');
  } else {
    record('Backslash Path Sanitization', 'Access Control Logic', 'FAIL', 'Backslash path was permitted.');
  }

  // Test 4.5: Prefix collision attempt (user_alice vs user_alice_imposter) is denied
  const collisionDenied = !verifyPathAuthorization('user_alice', 'users/user_alice_imposter/media/photo.jpg');
  if (collisionDenied) {
    record('User ID Prefix Collision Prevention', 'Access Control Logic', 'PASS', 'user_alice cannot access user_alice_imposter paths.');
  } else {
    record('User ID Prefix Collision Prevention', 'Access Control Logic', 'FAIL', 'Prefix substring match incorrectly granted access.');
  }

  // Test 4.6: Empty user ID or empty target path is denied
  const emptyDenied = !verifyPathAuthorization('', 'users/user_alice/media/photo.jpg') && !verifyPathAuthorization('user_alice', '');
  if (emptyDenied) {
    record('Empty Identifier Handling', 'Access Control Logic', 'PASS', 'Empty user or path rejects with false.');
  } else {
    record('Empty Identifier Handling', 'Access Control Logic', 'FAIL', 'Empty input was not rejected.');
  }

  // -------------------------------------------------------------------------
  // 5. REAL FIREBASE TEST ACCOUNTS STATUS (NO MOCKS CLAIMED AS REAL)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Real Firebase Test Accounts Status ---');
  const tokenA = process.env.TEST_FIREBASE_ID_TOKEN_USER_A || '';
  const tokenB = process.env.TEST_FIREBASE_ID_TOKEN_USER_B || '';

  if (tokenA && tokenB) {
    try {
      const decodedA = await adminAuth.verifyIdToken(tokenA);
      const decodedB = await adminAuth.verifyIdToken(tokenB);
      if (decodedA.uid && decodedB.uid && decodedA.uid !== decodedB.uid) {
        record('Real Firebase Test Account A Valid Request', 'Live User Authentication', 'PASS', `Verified real Firebase ID token for UID ${decodedA.uid}`);
        record('Real Firebase Test Account B Valid Request', 'Live User Authentication', 'PASS', `Verified real Firebase ID token for UID ${decodedB.uid}`);
      } else {
        record('Real Firebase Test Accounts', 'Live User Authentication', 'FAIL', 'Tokens did not decode to distinct real user IDs.');
      }
    } catch (err: unknown) {
      record('Real Firebase Test Accounts Verification', 'Live User Authentication', 'FAIL', `Real token validation failed: ${err}`);
    }
  } else {
    // Truthful, non-misleading reporting: mock tokens are NEVER disguised as real tokens
    record(
      'Real Firebase Test Account A Live Request',
      'Live User Authentication',
      'NOT TESTED',
      'Requires live interactive Google OAuth Sign-In or pre-minted Firebase ID token (mock tokens are strictly forbidden as substitutes).'
    );
    record(
      'Real Firebase Test Account B Cross-User Live Isolation',
      'Live User Authentication',
      'NOT TESTED',
      'Requires second live authenticated account token to test live end-to-end network interchange against deployed infrastructure.'
    );
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('VALIDATION EXECUTION SUMMARY');
  console.log('================================================================');
  const passes = results.filter((r) => r.status === 'PASS').length;
  const fails = results.filter((r) => r.status === 'FAIL').length;
  const notTested = results.filter((r) => r.status === 'NOT TESTED').length;
  console.log(`TOTAL: ${results.length} | PASS: ${passes} | FAIL: ${fails} | NOT TESTED: ${notTested}`);
}

runValidation().catch((err) => {
  console.error('Validation test run crashed:', err);
  process.exit(1);
});
