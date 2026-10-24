import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Initialize Firebase Cloud Storage with the configured bucket
const configuredBucket = firebaseConfig.storageBucket || `${firebaseConfig.projectId}.firebasestorage.app`;
export const storage = getStorage(app, `gs://${configuredBucket}`);

// Bound retry time to 20s so uploads never hang indefinitely at 0% on mobile or failed connections
storage.maxUploadRetryTime = 20000;
storage.maxOperationRetryTime = 20000;

export const googleProvider = new GoogleAuthProvider();
export const STORAGE_BUCKET_NAME = configuredBucket;
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

// Connection test as required by skill
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
      return false;
    }
    // A permission denied error on /test/connection is normal because security rules deny unmatched paths
    return true;
  }
}

testConnection();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: unknown) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

export async function logoutUser() {
  await signOut(auth);
}

/**
 * Fast diagnostic check to verify whether Google Cloud Storage bucket exists and is ready
 */
export async function checkStorageBucketStatus(): Promise<{ ready: boolean; notFound: boolean; message: string }> {
  try {
    const response = await fetch(`https://firebasestorage.googleapis.com/v0/b/${configuredBucket}/o`, {
      method: 'GET',
    });
    if (response.status === 404) {
      return {
        ready: false,
        notFound: true,
        message: `Cloud Storage bucket '${configuredBucket}' does not exist yet. Please enable Storage in your Firebase Console.`,
      };
    }
    return {
      ready: true,
      notFound: false,
      message: 'Cloud Storage bucket is accessible.',
    };
  } catch (err: unknown) {
    return {
      ready: false,
      notFound: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
