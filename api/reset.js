import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set } from "firebase/database";

// Configuración de Firebase provista
const firebaseConfig = {
  apiKey: "AIzaSyCEM7fa1Erl2NLpM8VTRYCVyHW-cl-JEjw",
  authDomain: "sociosxit-fa932.firebaseapp.com",
  databaseURL: "https://sociosxit-fa932-default-rtdb.firebaseio.com",
  projectId: "sociosxit-fa932",
  storageBucket: "sociosxit-fa932.firebasestorage.app",
  messagingSenderId: "942961938934",
  appId: "1:942961938934:web:8f9e5620253d122a9e77d7"
};

// Inicializar Firebase en el entorno Serverless de Vercel
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    const { key } = req.body;

    if (!key) {
        return res.status(400).json({ success: false, message: 'Ingresa una key válida' });
    }

    // Limpiamos la key para usarla como clave segura en la base de datos (reemplazando caracteres especiales si los hubiera)
    const sanitizedKey = key.replace(/[.#$[\]/]/g, '_');
    const cooldownRef = ref(db, `resets_cooldown/${sanitizedKey}`);

    try {
        const now = Date.now();
        const COOL_DOWN_HOURS = 14;
        const COOL_DOWN_MS = COOL_DOWN_HOURS * 60 * 60 * 1000;

        // 1. Verificar el último registro en Firebase
        const snapshot = await get(cooldownRef);
        if (snapshot.exists()) {
            const lastResetTime = snapshot.val().lastReset;
            const timeElapsed = now - lastResetTime;

            if (timeElapsed < COOL_DOWN_MS) {
                const timeLeftMs = COOL_DOWN_MS - timeElapsed;
                const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
                const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

                return res.status(200).json({
                    success: false,
                    cooldown: true,
                    message: `Debes esperar ${hoursLeft}h ${minutesLeft}m para volver a resetear esta key (Límite: 1 vez cada 14 horas).`,
                    data: {
                        code: "COOLDOWN_ACTIVE",
                        error: `Cooldown activo. Tiempo restante: ${hoursLeft}h ${minutesLeft}m`
                    }
                });
            }
        }

        // 2. Si pasó el cooldown, procedemos a consumir la API de Drip
        const apiToken = '90db09800ec2b121bc2fc725f31190f3c49312565909574452e1b0ffa2e6360b';
        
        const params = new URLSearchParams();
        params.append('api', 'drip');
        params.append('key', key);

        const apiResponse = await fetch('https://dripclientstore.shop/api/v1/reset_key.php', {
            method: 'POST',
            headers: {
                'X-API-Token': apiToken,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        const data = await apiResponse.json();

        // Consideramos exitoso si la API responde bien o si ya estaba libre (ALREADY_FREE)
        const isSuccess = data.success === true || data.code === 'ALREADY_FREE';

        if (isSuccess) {
            // Guardamos el nuevo timestamp del reset en Firebase
            await set(cooldownRef, {
                lastReset: now,
                key: key
            });
        }

        return res.status(200).json({ 
            success: isSuccess, 
            data: data 
        });

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: 'Error de conexión con el servidor o Firebase',
            error: error.message 
        });
    }
}
