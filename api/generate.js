export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { variant_id, quantity } = req.body;

    if (!variant_id) {
        return res.status(400).json({ success: false, error: 'Falta el variant_id' });
    }

    const API_TOKEN = process.env.DRIP_API_TOKEN || "90db09800ec2b121bc2fc725f31190f3c49312565909574452e1b0ffa2e6360b";
    const API_BASE = "https://dripclientstore.shop/api/v1";

    try {
        const response = await fetch(`${API_BASE}/generate_key.php`, {
            method: 'POST',
            headers: {
                'X-API-Token': API_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: new URLSearchParams({
                variant_id: variant_id,
                quantity: quantity || 1
            })
        });

        const data = await response.json();

        if (!response.ok || data.success === false) {
            return res.status(response.status || 400).json({
                success: false,
                error: data.error || 'Error al generar la key con el proveedor'
            });
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Error de conexión con el proveedor: ' + error.message });
    }
}
