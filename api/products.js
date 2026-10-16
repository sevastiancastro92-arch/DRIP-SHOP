const API_BASE = 'https://dripclientstore.shop/api/v1';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const apiToken = process.env.DRIP_API_TOKEN;
    if (!apiToken) {
        console.error('DRIP_API_TOKEN no está configurado');
        return res.status(503).json({ success: false, error: 'El catálogo no está configurado' });
    }

    try {
        const response = await fetch(`${API_BASE}/products.php`, {
            method: 'GET',
            headers: {
                'X-API-Token': apiToken,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(10000)
        });

        const contentType = response.headers.get('content-type') || '';
        const body = await response.text();
        if (!contentType.toLowerCase().includes('application/json') || body.trimStart().startsWith('<')) {
            console.error('Respuesta no JSON del proveedor de catálogo', { status: response.status });
            return res.status(502).json({ success: false, error: 'El proveedor devolvió una respuesta inesperada' });
        }

        let data;
        try {
            data = JSON.parse(body);
        } catch {
            return res.status(502).json({ success: false, error: 'El proveedor devolvió un catálogo inválido' });
        }

        if (!response.ok || data?.success === false) {
            console.error('El proveedor rechazó la consulta de catálogo', { status: response.status });
            return res.status(response.status >= 400 && response.status < 500 ? response.status : 502)
                .json({ success: false, error: 'No se pudo cargar el catálogo del proveedor' });
        }

        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        return res.status(200).json(data);
    } catch (error) {
        console.error('Error al consultar el catálogo del proveedor', error);
        return res.status(502).json({ success: false, error: 'No se pudo conectar con el proveedor' });
    }
}
