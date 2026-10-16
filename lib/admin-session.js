import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'noxar_admin';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function sessionSecret() {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || secret.length < 32) throw new Error('Admin session secret is not configured securely');
    return secret;
}

function signature(payload) {
    return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

function parseCookies(header = '') {
    return Object.fromEntries(header.split(';').map((part) => {
        const index = part.indexOf('=');
        if (index < 0) return ['', ''];
        return [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    }).filter(([key]) => key));
}

export function createAdminCookie() {
    const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })).toString('base64url');
    const value = `${payload}.${signature(payload)}`;
    return `${COOKIE_NAME}=${value}; Path=/api/admin; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function isAdminRequest(req) {
    const token = parseCookies(req.headers?.cookie || '')[COOKIE_NAME];
    if (!token) return false;
    const [payload, suppliedSignature, extra] = token.split('.');
    if (!payload || !suppliedSignature || extra) return false;
    let expectedSignature;
    try {
        expectedSignature = signature(payload);
    } catch {
        return false;
    }
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
    try {
        const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return Number.isInteger(session.exp) && session.exp > Math.floor(Date.now() / 1000);
    } catch {
        return false;
    }
}

export function clearAdminCookie() {
    return `${COOKIE_NAME}=; Path=/api/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function verifyAdminPassword(candidate) {
    const configured = process.env.ADMIN_PASSWORD;
    if (!configured || typeof candidate !== 'string' || candidate.length > 256) return false;
    const a = Buffer.from(candidate);
    const b = Buffer.from(configured);
    return a.length === b.length && timingSafeEqual(a, b);
}
