# Supabase — Technik Dashboard

La app **ya corre contra Supabase** (auth, tablas, Storage, Realtime). El hub `/api/workspace` en RAM es solo fallback local sin DB y **exige sesión**.

## Decisiones de producto (v1)

| Decisión | Valor v1 | Nota |
|----------|----------|------|
| Canal del cliente | Registro interno por staff | Sin portal de aprobación. `client_response` lo marca admin. |
| Congelar precios / alcance | Al **aprobar o archivar** | Enviar el PDF **no** bloquea edición. Duplicar si hay que partir de un folio cerrado. |
| Cobros inmutables | Sí, una vez `paid_at` | No borrar ni desmarcar abonos cobrados. Corrección = `payment_events`. |
| Correo al cliente | Resend desde `cotizaciones@` | To + CC. El PDF se guarda en Storage (`quote-pdfs`) para reenviar. |
| WhatsApp | Botón Compartir | No hay WhatsApp Cloud. Fallback `wa.me` / hoja nativa. |
| Multi-tenant | Single company | Sin `org_id`. |
| Rechazo con proyecto | Bloqueado | Cerrar/cancelar el proyecto antes de marcar `rechazada`. |
| Archivo | `status = closed` | Filtro Archivadas. |
| Sync | Tablas + Realtime | No usar el snapshot global del hub como fuente de verdad. |

### Precios / economía interna

Constantes en [`lib/technik/company.ts`](../lib/technik/company.ts):

| Constante | Valor | Uso |
|-----------|-------|-----|
| `MATERIAL_PUBLIC_MARKUP` | 0.10 | Precio público sugerido = costo × 1.10 |
| `LABOR_BURDEN_RATE` | 0.20 | IMSS/INFONAVIT solo en economía interna |
| `INTERNAL_PROFIT_RATE` | 0.60 | Ganancia = (MO base + mat. + extras) × 60% |
| `ANNUAL_BONUS_RATE` | 0.10 | Bono anual = (ganancia + mat. + extras) × 10% |
| `DEFAULT_LABOR_HOURLY_RATE` | 110 | Tarifa $/h default en catálogo |

## Qué hay aquí

| Archivo | Contenido |
|---------|-----------|
| [`migrations/`](migrations/) | Schema, RLS, Storage, fotos, tesorería, PDFs, Realtime |
| [`MIGRATION_CHECKLIST.md`](MIGRATION_CHECKLIST.md) | Estado vs prototipo |

Migración reciente: [`20260826140000_quote_pdfs_and_realtime.sql`](migrations/20260826140000_quote_pdfs_and_realtime.sql) — bucket `quote-pdfs` y publication Realtime.

Aplicar en el proyecto live: `supabase db push` (o pegar el SQL en el SQL editor).

## Variables

Cliente: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o publishable).

Servidor: `SUPABASE_SERVICE_ROLE_KEY` (nunca `NEXT_PUBLIC_`). Resend: `RESEND_API_KEY`, `RESEND_QUOTES_FROM`.
