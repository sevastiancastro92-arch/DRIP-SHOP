import { clearAdminCookie } from '../../lib/admin-session.js';

export default function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }
    res.setHeader('Set-Cookie', clearAdminCookie());
    return res.status(200).json({ success: true });
}
