# Verde Cerca

Sitio web responsive para reservar ensaladas personalizadas. Los clientes pueden elegir hasta tres ingredientes y reservar para hoy o mañana. El panel privado permite revisar, completar y resumir los pedidos.

## Tecnologías

- HTML, CSS y JavaScript
- Supabase Database, Auth y Realtime
- Render Static Sites

## Configurar Supabase

1. Crea un proyecto en Supabase.
2. Ejecuta [`supabase-setup.sql`](./supabase-setup.sql) desde **SQL Editor**.
3. En **Authentication > Users**, crea la cuenta administrativa autorizada por las políticas RLS.
4. Configura la URL y la publishable key en `app.js`.

La publishable key puede utilizarse en el navegador. Nunca agregues una secret key o `service_role` al repositorio.

## Ejecutar localmente

Como es un sitio estático, puedes abrir `index.html` o servir la carpeta con cualquier servidor HTTP local.

## Publicar en Render

El archivo [`render.yaml`](./render.yaml) define un Static Site llamado `verde-cerca`. En Render, selecciona **New > Blueprint**, conecta este repositorio y aplica la configuración detectada.

