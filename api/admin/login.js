import { createAdminCookie, verifyAdminPassword } from '../../lib/admin-session.js';

export default function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }
    if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
        return res.status(503).json({ success: false, error: 'El acceso de administración no está configurado' });
    }

    const password = req.body?.password;
    if (!verifyAdminPassword(password)) {
        return res.status(401).json({ success: false, error: 'Credenciales incorrectas' });
    }

    res.setHeader('Set-Cookie', createAdminCookie());
    return res.status(200).json({ success: true });
}
