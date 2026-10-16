import { randomUUID } from 'node:crypto';
import { getFirebaseAdmin, verifyFirebaseBearer } from '../lib/firebase-admin.js';
import { ALLOWED_VARIANT_SET } from '../lib/variants.js';

const API_BASE = 'https://dripclientstore.shop/api/v1';

function dollarsToCents(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return null;
    return Math.round(amount * 100);
}

async function refundRejectedOrder(userRef, orderId, amountCents) {
    const result = await userRef.transaction((user) => {
        if (!user || typeof user !== 'object') return;
        const order = user.orders?.[orderId];
        if (!order || order.status !== 'processing') return;
        const balanceCents = Math.round(Number(user.balance) * 100);
        if (!Number.isSafeInteger(balanceCents)) return;
        user.balance = (balanceCents + amountCents) / 100;
        user.orders[orderId] = { ...order, status: 'failed', updatedAt: Date.now() };
        return user;
    }, undefined, false);
    return result.committed && result.snapshot.val()?.orders?.[orderId]?.status === 'failed';
}

async function updateOrder(userRef, orderId, values) {
    try {
        await userRef.child(`orders/${orderId}`).update({ ...values, updatedAt: Date.now() });
        return true;
    } catch (error) {
        console.error('No se pudo actualizar el estado de la orden', { orderId, message: error.message });
        return false;
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const variantId = Number(req.body?.variant_id);
    const quantity = Number(req.body?.quantity ?? 1);
    if (!Number.isSafeInteger(variantId) || !ALLOWED_VARIANT_SET.has(variantId)) {
        return res.status(400).json({ success: false, error: 'El producto seleccionado no está autorizado' });
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 25) {
        return res.status(400).json({ success: false, error: 'La cantidad debe ser un entero entre 1 y 25' });
    }

    const apiToken = process.env.DRIP_API_TOKEN;
    if (!apiToken) {
        console.error('DRIP_API_TOKEN no está configurado');
        return res.status(503).json({ success: false, error: 'El servicio de generación no está configurado' });
    }

    let decodedToken;
    let db;
    try {
        decodedToken = await verifyFirebaseBearer(req);
        if (!decodedToken?.uid) return res.status(401).json({ success: false, error: 'Inicia sesión para continuar' });
        ({ db } = getFirebaseAdmin());
    } catch (error) {
        console.error('No se pudo verificar la sesión o conectar con Firebase Admin', error);
        if (/missing|invalid/i.test(error.message || '')) {
            return res.status(503).json({ success: false, error: 'La verificación de sesión no está configurada' });
        }
        return res.status(401).json({ success: false, error: 'La sesión no es válida; vuelve a iniciar sesión' });
    }

    try {
        const priceSnapshot = await db.ref(`store/salePrices/${variantId}`).get();
        const unitPriceCents = dollarsToCents(priceSnapshot.val());
        if (unitPriceCents === null) {
            return res.status(409).json({ success: false, error: 'Este producto todavía no tiene precio de venta configurado' });
        }
        const totalCents = unitPriceCents * quantity;
        if (!Number.isSafeInteger(totalCents)) {
            return res.status(400).json({ success: false, error: 'El total de la compra no es válido' });
        }

        const orderId = randomUUID();
        const userRef = db.ref(`users/${decodedToken.uid}`);
        let outcome = 'invalid_balance';
        const transaction = await userRef.transaction((user) => {
            if (!user || typeof user !== 'object') {
                outcome = 'user_not_found';
                return;
            }
            const balanceCents = Math.round(Number(user.balance) * 100);
            if (!Number.isSafeInteger(balanceCents) || balanceCents < 0) {
                outcome = 'invalid_balance';
                return;
            }
            if (balanceCents < totalCents) {
                outcome = 'insufficient_balance';
                return;
            }
            outcome = 'reserved';
            user.balance = (balanceCents - totalCents) / 100;
            user.orders = user.orders && typeof user.orders === 'object' ? user.orders : {};
            user.orders[orderId] = {
                status: 'processing',
                variant_id: variantId,
                quantity,
                unitPrice: unitPriceCents / 100,
                total: totalCents / 100,
                createdAt: Date.now()
            };
            return user;
        }, undefined, false);

        if (!transaction.committed) {
            const code = outcome === 'insufficient_balance' ? 402 : outcome === 'user_not_found' ? 404 : 409;
            const message = outcome === 'insufficient_balance' ? 'Saldo insuficiente; no se generó ninguna key' : 'No se pudo validar el saldo de la cuenta';
            return res.status(code).json({ success: false, error: message });
        }

        let providerResponse;
        let providerData;
        try {
            providerResponse = await fetch(`${API_BASE}/generate_key.php`, {
                method: 'POST',
                headers: {
                    'X-API-Token': apiToken,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: new URLSearchParams({ variant_id: String(variantId), quantity: String(quantity) }),
                signal: AbortSignal.timeout(20000)
            });
            const text = await providerResponse.text();
            if (text.trimStart().startsWith('<')) {
                await updateOrder(userRef, orderId, { status: 'needs_review' });
                return res.status(502).json({ success: false, order_id: orderId, error: 'El proveedor requiere revisión; la compra quedó pendiente de conciliación' });
            }
            try {
                providerData = JSON.parse(text);
            } catch {
                await updateOrder(userRef, orderId, { status: 'needs_review' });
                return res.status(502).json({ success: false, order_id: orderId, error: 'Respuesta inesperada del proveedor; la compra quedó pendiente de conciliación' });
            }
        } catch (error) {
            console.error('Resultado incierto al solicitar la key', { orderId, message: error.message });
            await updateOrder(userRef, orderId, { status: 'needs_review' });
            return res.status(502).json({ success: false, order_id: orderId, error: 'No se pudo confirmar el resultado; la compra quedó pendiente de conciliación' });
        }

        const keys = Array.isArray(providerData?.keys)
            ? providerData.keys.map((key) => String(key)).filter(Boolean)
            : typeof providerData?.keys === 'string' ? [providerData.keys]
            : providerData?.key ? [String(providerData.key)] : [];

        if ((!providerResponse.ok || providerData?.success === false) && keys.length > 0) {
            await updateOrder(userRef, orderId, { status: 'needs_review' });
            return res.status(502).json({ success: false, order_id: orderId, error: 'El proveedor devolvió una respuesta inconsistente; la compra quedó pendiente de conciliación' });
        }

        if (!providerResponse.ok || providerData?.success === false) {
            let refunded = false;
            try {
                refunded = await refundRejectedOrder(userRef, orderId, totalCents);
            } catch (error) {
                console.error('Falló el reembolso de una orden rechazada', { orderId, message: error.message });
            }
            console.error('El proveedor rechazó la generación', { orderId, status: providerResponse.status });
            if (!refunded) {
                console.error('No se pudo confirmar el reembolso automático', { orderId });
                return res.status(502).json({ success: false, order_id: orderId, error: 'El proveedor rechazó la generación; el reembolso requiere revisión' });
            }
            return res.status(502).json({ success: false, order_id: orderId, error: 'El proveedor rechazó la generación; el saldo fue restaurado' });
        }

        if (keys.length === 0) {
            await updateOrder(userRef, orderId, { status: 'needs_review' });
            return res.status(502).json({ success: false, order_id: orderId, error: 'No se recibió la key; la compra quedó pendiente de conciliación' });
        }

        await updateOrder(userRef, orderId, { status: 'completed', keys });
        return res.status(200).json({ success: true, order_id: orderId, keys, total: totalCents / 100 });
    } catch (error) {
        console.error('Error al procesar la compra', error);
        return res.status(500).json({ success: false, error: 'No se pudo completar la compra' });
    }
}
