# Checklist de migración

La app **ya no es mock**. Auth, persistencia y Realtime van a Supabase. Este archivo es el registro de decisiones, no un “aún no conectar”.

## Hecho en producto

- [x] Flujo cotización: borrador → en revisión → enviada al cliente → aprobada / rechazada
- [x] Enviar PDF **no** congela precios; **aprobar o archivar** sí
- [x] Cobros inmutables + `payment_events`
- [x] Auth Supabase + perfiles + invitaciones
- [x] Persistencia por entidad (no snapshot global)
- [x] Correo Resend + PDF en Storage (`quote-pdfs`)
- [x] Fotos de visita en Storage (`visit-photos`), APIs con sesión
- [x] `/api/workspace` autenticado; con Supabase no mezcla cotizaciones del hub
- [x] Realtime en `quotations`, `inbox_events`, `projects`, `quotation_visit_photos` (aplicar SQL `20260826140000_…`)
- [x] Tests del pipeline (`npm test` / `tsx --test`)

## Al desplegar / proyecto live

- [ ] Aplicar `20260826140000_quote_pdfs_and_realtime.sql` (bucket + publication). El envío de correo **crea el bucket** si falta; Realtime sí necesita el SQL.
- [ ] Confirmar RLS: colaborador no edita `unit_cost` ni cuotas cobradas
- [ ] Verificar que el dashboard en vivo usa las mismas `NEXT_PUBLIC_*` que este repo

## Fuera de v1

- [ ] WhatsApp Cloud (queda Compartir / `wa.me`)
- [ ] Portal del cliente para aprobar
- [ ] Generación de PDF 100% server-side (hoy: captura en navegador + archivo guardado al enviar)

## Anti-patrones

1. Volver a publicar el workspace entero por `/api/workspace` o BroadcastChannel.
2. Confiar solo en `if (role === 'admin')` en React sin RLS.
3. Generar `TKS-Q-…` en el cliente bajo concurrencia.
4. Desmarcar / borrar abonos cobrados.
5. Congelar la cotización al enviar el PDF (la regla vigente es al aprobar).
