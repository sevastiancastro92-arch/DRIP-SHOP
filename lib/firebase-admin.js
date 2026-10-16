import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';

export function getFirebaseAdmin() {
    const existing = getApps()[0];
    if (existing) {
        return { auth: getAuth(existing), db: getDatabase(existing) };
    }

    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const databaseURL = process.env.FIREBASE_DATABASE_URL;
    if (!rawServiceAccount || !databaseURL) {
        throw new Error('Firebase Admin server configuration is missing');
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(rawServiceAccount);
    } catch {
        throw new Error('Firebase Admin service account JSON is invalid');
    }
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
        throw new Error('Firebase Admin service account is incomplete');
    }
    let databaseHost;
    try {
        const databaseUrlObject = new URL(databaseURL);
        if (databaseUrlObject.protocol !== 'https:') throw new Error('HTTPS is required');
        databaseHost = databaseUrlObject.hostname;
    } catch {
        throw new Error('Firebase Realtime Database URL is invalid');
    }
    if (!databaseHost.includes(serviceAccount.project_id)) {
        throw new Error('Firebase Admin credential and database URL refer to different projects');
    }

    const app = initializeApp({
        credential: cert(serviceAccount),
        databaseURL
    });
    return { auth: getAuth(app), db: getDatabase(app) };
}

export async function verifyFirebaseBearer(req) {
    const authorization = req.headers?.authorization || req.headers?.Authorization || '';
    const idToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!idToken) return null;
    const { auth } = getFirebaseAdmin();
    return auth.verifyIdToken(idToken);
}
