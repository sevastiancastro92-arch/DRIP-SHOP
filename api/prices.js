import { getFirebaseAdmin } from '../lib/firebase-admin.js';
import { ALLOWED_VARIANT_IDS } from '../lib/variants.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    try {
        const { db } = getFirebaseAdmin();
        const snapshot = await db.ref('store/salePrices').get();
        const stored = snapshot.val() || {};
        const salePrices = Object.fromEntries(ALLOWED_VARIANT_IDS
            .filter((id) => Number.isFinite(Number(stored[id])) && Number(stored[id]) > 0)
            .map((id) => [id, Number(stored[id])]));
        return res.status(200).json({ success: true, salePrices });
    } catch (error) {
        console.error('No se pudieron cargar los precios públicos', error);
        return res.status(503).json({ success: false, error: 'Los precios de la tienda no están disponibles' });
    }
}
