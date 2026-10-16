export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const { variant_id, quantity = 1 } = req.body || {};

    const parsedVariantId = Number(variant_id);
    const parsedQuantity = Number(quantity);
    if (!Number.isSafeInteger(parsedVariantId) || parsedVariantId <= 0) {
        return res.status(400).json({ success: false, error: 'El variant_id debe ser un entero positivo' });
    }
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1) {
        return res.status(400).json({ success: false, error: 'La cantidad debe ser un entero positivo' });
    }

    const API_TOKEN = process.env.DRIP_API_TOKEN;
    const API_BASE = "https://dripclientstore.shop/api/v1";

    if (!API_TOKEN) {
        console.error('DRIP_API_TOKEN no está configurado');
        return res.status(503).json({ success: false, error: 'El servicio de generación no está configurado' });
    }

    try {
        const response = await fetch(`${API_BASE}/generate_key.php`, {
            method: 'POST',
            headers: {
                'X-API-Token': API_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                variant_id: String(parsedVariantId),
                quantity: String(parsedQuantity)
            })
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data || data.success === false) {
            console.error('El proveedor rechazó la generación', { status: response.status });
            return res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
                success: false,
                error: 'El proveedor no pudo completar la generación'
            });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error de conexión con el proveedor', error);
        return res.status(502).json({ success: false, error: 'No se pudo conectar con el proveedor' });
    }
}
