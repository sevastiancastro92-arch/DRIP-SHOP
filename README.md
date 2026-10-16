# NØXAR Store

Tienda de licencias digitales con autenticación Firebase y generación de claves mediante el proveedor DRIP.

## Desarrollo y despliegue

El proyecto usa funciones serverless compatibles con Vercel. Configura `DRIP_API_TOKEN` como variable de entorno del proyecto en el proveedor de despliegue; **no guardes el valor en el repositorio, el navegador ni un archivo `.env` versionado**. `.env.example` solo documenta el nombre de la variable.

Si falta la variable, `POST /api/generate` responde `503` sin llamar al proveedor. La ruta acepta `variant_id` como entero positivo y `quantity` como entero positivo (por defecto `1`). Los IDs mostrados por ahora en el catálogo siguen siendo `9` y `76`; no se asume que sean el catálogo completo.

## Acción de seguridad pendiente

La versión anterior del código contenía una credencial de proveedor en el repositorio. Eliminarla del código actual no la invalida ni la borra del historial de Git. Revoca/rota esa credencial en el panel del proveedor y guarda únicamente la nueva en `DRIP_API_TOKEN` en el entorno de despliegue. No vuelvas a publicar la credencial anterior.

## Catálogo y variantes

Las tarjetas y sus IDs actuales están declarados en `index.html`. Para convertirlas en un catálogo dinámico y mapear correctamente sus variantes, hace falta la documentación vigente del endpoint de catálogo del proveedor, el formato de respuesta y los datos reales (nombre, opciones, precio, disponibilidad e imágenes, si aplica). No inventes IDs ni precios.
