# NØXAR Store

Tienda de keys con Firebase Auth/Realtime Database y generación mediante DRIP Store. Despliegue objetivo confirmado: **Vercel `dripshop1`** (`dripshop1.vercel.app`) conectado al repositorio `sevastiancastro92-arch/DRIP-SHOP`.

## Variables protegidas de Vercel

En `Vercel → dripshop1 → Settings → Environment Variables`, configura para Production y Preview:

- `DRIP_API_TOKEN`: token nuevo, rotado en DRIP Store. No reutilices el token que quedó expuesto.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON de una cuenta de servicio Firebase del proyecto correcto. Mantén esta credencial únicamente en el entorno server-side de Vercel.
- `FIREBASE_DATABASE_URL`: URL de Realtime Database del proyecto Firebase.
- `ADMIN_PASSWORD`: contraseña nueva, larga y única para el panel. No uses la que se compartió en el chat.
- `ADMIN_SESSION_SECRET`: secreto aleatorio de al menos 32 caracteres para firmar cookies. Ejemplo para generarlo localmente: `openssl rand -base64 48`.

No pongas secretos en GitHub, HTML, respuestas de chat ni `.env.example`. Después de guardar variables, redeploya `dripshop1` para que las funciones reciban la configuración.

## Panel y precios

`/admin.html` presenta un panel con inicio de sesión mediante `ADMIN_PASSWORD`. El servidor valida la contraseña, aplica bloqueo persistente por intentos usando Realtime Database y emite una cookie firmada `HttpOnly`, `Secure` y `SameSite=Strict` con caducidad de ocho horas. El navegador nunca recibe la contraseña ni el secreto de sesión.

Los precios finales se guardan en `store/salePrices/{variantId}` y cada cambio se registra en `store/priceAudit`. Solo se aceptan estos IDs que proporcionó el propietario: `9`, `76`, `10`, `11`, `12`, `182`, `184`, `181`, `183`, `217`, `13`, `14`, `15`. Las variantes sin precio configurado no se pueden comprar.

`database.rules.json` es una propuesta restrictiva para revisar antes de aplicarla en Firebase Console. Permite leer solo el propio perfil y crear un perfil inicial con saldo `0`; bloquea que el navegador cambie el saldo, el rol, los precios o los intentos de acceso. Firebase Admin del servidor puede actualizar saldos y precios. No reemplaces reglas existentes sin compararlas con las otras funciones de tu proyecto.

## Compra y saldo

`POST /api/generate` verifica el Firebase ID token con Firebase Admin, lee el precio del servidor y reserva/descuenta el saldo en una transacción de Realtime Database antes de contactar al proveedor. Si el proveedor rechaza explícitamente la solicitud, se restaura el saldo. Si el resultado externo es incierto (por ejemplo, Cloudflare o un timeout después de enviar la petición), la orden queda `needs_review` y no se reembolsa automáticamente: hacerlo podría entregar una key gratis si el proveedor sí alcanzó a generarla. Esas órdenes requieren conciliación con el historial del proveedor.

El balance existente se interpreta como valor numérico con dos decimales. La cantidad por solicitud está limitada a 25; la interfaz actual solicita una key por compra.

## Catálogo

`GET /api/products` consulta `products.php` desde el servidor, mantiene el token fuera del navegador, detecta respuestas HTML/Cloudflare y aplica caché de 60 segundos. Para mostrar nombres, precios base, opciones, stock e imágenes de manera fiel todavía hace falta un ejemplo JSON real de `products.php` sin credenciales. Hasta recibirlo, no se inventa el mapeo entre los IDs permitidos y los nombres de producto.

## Acción de seguridad urgente

El token de DRIP y la contraseña de administración compartidos deben considerarse expuestos. Rótalos en sus proveedores. Eliminar un secreto del código activo no lo quita del historial anterior de Git; la rotación es obligatoria. No se ha usado ninguno de esos valores en esta rama.
