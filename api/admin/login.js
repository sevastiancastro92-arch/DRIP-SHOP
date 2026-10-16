import { createAdminCookie, verifyAdminPassword } from '../../lib/admin-session.js';
import { createHash } from 'node:crypto';
import { getFirebaseAdmin } from '../../lib/firebase-admin.js';

const WINDOW_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 6;

async function consumeLoginAttempt(req) {
    const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['x-vercel-forwarded-for'] || 'unknown';
    const ip = String(forwarded).split(',')[0].trim().slice(0, 128) || 'unknown';
    const key = createHash('sha256').update(ip).digest('hex');
    const { db } = getFirebaseAdmin();
    const ref = db.ref(`security/adminLoginAttempts/${key}`);
    const now = Date.now();
    const result = await ref.transaction((state) => {
        if (state?.lockedUntil > now) return state;
        const active = state?.windowStartedAt > now - WINDOW_MS;
        const next = {
            windowStartedAt: active ? state.windowStartedAt : now,
            failures: (active ? Number(state.failures) || 0 : 0) + 1
        };
        if (next.failures >= MAX_ATTEMPTS) next.lockedUntil = now + LOCK_MS;
        return next;
    }, undefined, false);
    const current = result.snapshot.val();
    return Boolean(current?.lockedUntil > now);
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
        return res.status(503).json({ success: false, error: 'El acceso de administración no está configurado' });
    }

    const password = req.body?.password;
    if (typeof password !== 'string' || password.length > 256) {
        return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }
    if (!verifyAdminPassword(password)) {
        try {
            if (await consumeLoginAttempt(req)) {
                return res.status(429).json({ success: false, error: 'Demasiados intentos; inténtalo más tarde' });
            }
        } catch (error) {
            console.error('No se pudo aplicar el límite de intentos del panel', error);
            return res.status(503).json({ success: false, error: 'El acceso de administración no está disponible' });
        }
        return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }

    try {
        const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['x-vercel-forwarded-for'] || 'unknown';
        const ip = String(forwarded).split(',')[0].trim().slice(0, 128) || 'unknown';
        const key = createHash('sha256').update(ip).digest('hex');
        await getFirebaseAdmin().db.ref(`security/adminLoginAttempts/${key}`).remove();
    } catch (error) {
        console.error('No se pudo limpiar el contador de acceso de administración', error);
    }

    res.setHeader('Set-Cookie', createAdminCookie());
    return res.status(200).json({ success: true });
}
