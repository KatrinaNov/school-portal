import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";

/**
 * Firebase config:
 * - For GitHub Pages/static hosting you must ship this object to the client.
 * - Do NOT put service account keys here (they are server-only).
 *
 * Fill values from Firebase Console → Project settings → Your apps → Web app.
 */
export const firebaseConfig = {
  apiKey: "AIzaSyC7BCl3X1y9fk1ziboSFm61L-rgSVVjHAA",
  authDomain: "school-portal-33088.firebaseapp.com",
  projectId: "school-portal-33088",
  storageBucket: "school-portal-33088.firebasestorage.app",
  messagingSenderId: "543827573158",
  appId: "1:543827573158:web:17db4793bc8caa68eeb767"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Analytics is optional (not required for Auth/Firestore).
export async function getAnalyticsIfSupported() {
  try {
    const ok = await isAnalyticsSupported();
    return ok ? getAnalytics(app) : null;
  } catch {
    return null;
  }
}

