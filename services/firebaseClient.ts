import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// Firebase config is read from Vite env variables. These are not secrets,
// real security comes from Firebase Auth + Storage rules.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY,
};

let appCheckInitialized = false;

export const getFirebaseServices = () => {
  const required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'] as const;
  const missing = required.filter(key => !firebaseConfig[key]);
  if (missing.length > 0) {
    return null; // not configured
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const storage = getStorage(app);

  // Optional App Check with reCAPTCHA v3
  if (!appCheckInitialized && firebaseConfig.recaptchaSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(firebaseConfig.recaptchaSiteKey as string),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckInitialized = true;
  }

  return { app, auth, storage };
};
