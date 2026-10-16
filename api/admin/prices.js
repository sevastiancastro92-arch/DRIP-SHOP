import { getFirebaseAdmin } from '../../lib/firebase-admin.js';
import { isAdminRequest } from '../../lib/admin-session.js';
import { ALLOWED_VARIANT_IDS } from '../../lib/variants.js';

function parseSalePrice(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1000000) return null;
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 0.000001) return null;
    return cents / 100;
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'PUT'].includes(req.method)) {
        res.setHeader('Allow', 'GET, PUT');
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }
    if (!isAdminRequest(req)) return res.status(401).json({ success: false, error: 'Inicia sesión como administrador' });

    try {
        const { db } = getFirebaseAdmin();
        if (req.method === 'GET') {
            const snapshot = await db.ref('store/salePrices').get();
            return res.status(200).json({ success: true, allowedVariantIds: ALLOWED_VARIANT_IDS, salePrices: snapshot.val() || {} });
        }

        const prices = req.body?.prices;
        if (!prices || typeof prices !== 'object' || Array.isArray(prices) || Object.keys(prices).length < 1) {
            return res.status(400).json({ success: false, error: 'Envía al menos un precio válido' });
        }
        const updates = {};
        for (const [rawId, rawPrice] of Object.entries(prices)) {
            const id = Number(rawId);
            const price = parseSalePrice(rawPrice);
            if (!Number.isSafeInteger(id) || !ALLOWED_VARIANT_IDS.includes(id) || price === null) {
                return res.status(400).json({ success: false, error: 'Hay una variante no permitida o un precio inválido' });
            }
            updates[`store/salePrices/${id}`] = price;
        }
        await db.ref().update(updates);
        return res.status(200).json({ success: true, saved: Object.keys(prices).length });
    } catch (error) {
        console.error('No se pudieron cargar o guardar los precios de tienda', error);
        return res.status(500).json({ success: false, error: 'No se pudieron guardar los precios' });
    }
}
