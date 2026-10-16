import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminCookie, isAdminRequest, verifyAdminPassword } from '../lib/admin-session.js';
import generateHandler from '../api/generate.js';
import productsHandler from '../api/products.js';
import adminPricesHandler from '../api/admin/prices.js';

function mockResponse() {
    return {
        code: 200,
        headers: {},
        body: null,
        setHeader(name, value) { this.headers[name] = value; },
        status(code) { this.code = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

test('admin cookie is signed, HttpOnly and accepted only with a valid signature', () => {
    const original = process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_SESSION_SECRET = 'test-session-secret-which-is-long-enough-32-characters';
    try {
        const cookie = createAdminCookie();
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /Secure/);
        assert.match(cookie, /SameSite=Strict/);
        const pair = cookie.split(';')[0];
        assert.equal(isAdminRequest({ headers: { cookie: pair } }), true);
        const [name, value] = pair.split('=');
        assert.equal(isAdminRequest({ headers: { cookie: `${name}=${value}x` } }), false);
    } finally {
        if (original === undefined) delete process.env.ADMIN_SESSION_SECRET;
        else process.env.ADMIN_SESSION_SECRET = original;
    }
});

test('admin password comparison uses only the configured server value', () => {
    const original = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = 'test-password-not-a-real-secret';
    try {
        assert.equal(verifyAdminPassword('test-password-not-a-real-secret'), true);
        assert.equal(verifyAdminPassword('wrong'), false);
    } finally {
        if (original === undefined) delete process.env.ADMIN_PASSWORD;
        else process.env.ADMIN_PASSWORD = original;
    }
});

test('admin price route rejects requests without an admin session', async () => {
    const res = mockResponse();
    await adminPricesHandler({ method: 'GET', headers: {} }, res);
    assert.equal(res.code, 401);
});

test('generation rejects variants outside the owner-approved allowlist', async () => {
    const res = mockResponse();
    await generateHandler({ method: 'POST', body: { variant_id: 999, quantity: 1 }, headers: {} }, res);
    assert.equal(res.code, 400);
    assert.equal(res.body.success, false);
});

test('generation fails closed when the provider token is not configured', async () => {
    const original = process.env.DRIP_API_TOKEN;
    delete process.env.DRIP_API_TOKEN;
    try {
        const res = mockResponse();
        await generateHandler({ method: 'POST', body: { variant_id: 9, quantity: 1 }, headers: {} }, res);
        assert.equal(res.code, 503);
    } finally {
        if (original !== undefined) process.env.DRIP_API_TOKEN = original;
    }
});

test('catalog fails closed when the provider token is not configured', async () => {
    const original = process.env.DRIP_API_TOKEN;
    delete process.env.DRIP_API_TOKEN;
    try {
        const res = mockResponse();
        await productsHandler({ method: 'GET' }, res);
        assert.equal(res.code, 503);
    } finally {
        if (original !== undefined) process.env.DRIP_API_TOKEN = original;
    }
});

test('catalog rejects HTML/Cloudflare challenge pages instead of presenting them as product data', async () => {
    const originalToken = process.env.DRIP_API_TOKEN;
    const originalFetch = globalThis.fetch;
    process.env.DRIP_API_TOKEN = 'test-only-token';
    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        headers: { get: () => 'text/html; charset=utf-8' },
        text: async () => '<!DOCTYPE html><html>Just a moment...</html>'
    });
    try {
        const res = mockResponse();
        await productsHandler({ method: 'GET' }, res);
        assert.equal(res.code, 502);
        assert.equal(res.body.success, false);
    } finally {
        if (originalToken === undefined) delete process.env.DRIP_API_TOKEN;
        else process.env.DRIP_API_TOKEN = originalToken;
        globalThis.fetch = originalFetch;
    }
});

test('catalog returns provider JSON and short cache headers without exposing provider credentials', async () => {
    const originalToken = process.env.DRIP_API_TOKEN;
    const originalFetch = globalThis.fetch;
    process.env.DRIP_API_TOKEN = 'test-only-token';
    let forwardedHeaders;
    globalThis.fetch = async (_url, options) => {
        forwardedHeaders = options.headers;
        return {
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            text: async () => '{"success":true,"products":[]}'
        };
    };
    try {
        const res = mockResponse();
        await productsHandler({ method: 'GET' }, res);
        assert.equal(res.code, 200);
        assert.deepEqual(res.body, { success: true, products: [] });
        assert.equal(res.headers['Cache-Control'], 's-maxage=60, stale-while-revalidate=300');
        assert.equal(Object.hasOwn(res.body, 'token'), false);
        assert.equal(forwardedHeaders['X-API-Token'], 'test-only-token');
    } finally {
        if (originalToken === undefined) delete process.env.DRIP_API_TOKEN;
        else process.env.DRIP_API_TOKEN = originalToken;
        globalThis.fetch = originalFetch;
    }
});
