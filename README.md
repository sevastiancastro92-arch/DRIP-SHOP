# NØXAR Store — MVP de pruebas

Tienda de keys desplegada desde GitHub en Vercel. Proyecto objetivo confirmado: `dripshop1` (`dripshop1.vercel.app`). El catálogo usa Firebase Auth/Realtime Database y el proveedor DRIP Store.

## Preparación en Vercel

En `Vercel → dripshop1 → Settings → Environment Variables`, agrega para Preview (y Production solo cuando estés listo):

- `DRIP_API_TOKEN`: **el token nuevo después de rotarlo**.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON de una cuenta de servicio del proyecto Firebase correcto.
- `FIREBASE_DATABASE_URL`: URL de la Realtime Database.
- `ADMIN_PASSWORD`: contraseña nueva y exclusiva para el panel.
- `ADMIN_SESSION_SECRET`: secreto aleatorio de al menos 32 caracteres (`openssl rand -base64 48`).

Configura los valores directamente en Vercel, no en GitHub ni por chat. Después, redeploya `dripshop1`. `.env.example` solo muestra los nombres.

## Panel de precios

Abre `/admin.html`, inicia con la contraseña guardada como `ADMIN_PASSWORD` y edita los precios de las 13 variantes autorizadas. La sesión del panel usa una cookie firmada `HttpOnly`, `Secure` y `SameSite=Strict`. Los precios quedan en `store/salePrices/{variantId}`. Las variantes sin precio no se pueden comprar.

## Compra con saldo

`POST /api/generate` verifica la sesión Firebase Auth en el servidor, valida el ID de variante y el precio, y descuenta el saldo mediante una transacción de Realtime Database antes de llamar a DRIP. Si el saldo no alcanza, el proveedor no recibe ninguna solicitud. Ante rechazo explícito del proveedor, el sistema devuelve el saldo; ante respuesta incierta deja la orden pendiente de revisión para no dar keys gratis.

El servidor necesita `FIREBASE_SERVICE_ACCOUNT_JSON` para verificar sesiones y operar saldo/precios. Revisa `database.rules.json` antes de aplicarlo: impide que el navegador cambie el saldo, rol o precios. No reemplaces reglas existentes sin compararlas.

## Catálogo pendiente

`GET /api/products` consulta el catálogo sin exponer el token y rechaza páginas HTML de Cloudflare. Falta una muestra JSON real de `products.php` sin credenciales para mostrar los nombres, opciones, precios base, stock e imágenes correctos. Hasta entonces se mantienen los datos visuales actuales y no se inventa el mapeo de las 13 variantes.

## Seguridad

El token DRIP y la contraseña admin compartidos deben considerarse expuestos. Rótalos; no se usa ninguno de esos valores en esta rama. Eliminar una clave del código actual no la elimina del historial Git, así que la rotación sigue siendo necesaria.
