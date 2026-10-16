export default async function handler(req, res) {
    // Permitir solo peticiones POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    const { key } = req.body;

    if (!key) {
        return res.status(400).json({ success: false, message: 'Ingresa una key válida' });
    }

    try {
        const apiToken = '90db09800ec2b121bc2fc725f31190f3c49312565909574452e1b0ffa2e6360b';
        
        // Petición equivalente al cURL
        const params = new URLSearchParams();
        params.append('api', 'drip');
        params.append('key', key);

        const response = await fetch('https://dripclientstore.shop/api/v1/reset_key.php', {
            method: 'POST',
            headers: {
                'X-API-Token': apiToken,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        const data = await response.text();

        return res.status(200).json({ 
            success: true, 
            response: data 
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: 'Error de conexión con el servidor de la API',
            error: error.message 
        });
    }
}
