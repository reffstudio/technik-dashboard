# Checklist de migración (cuando toque cablear)

Orden del plan de readiness. **No ejecutar** hasta cerrar UX y state machine en el prototipo.

## 0. Preflight

- [x] Cerrar flujos: revisión → envío → respuesta cliente → proyecto → abonos (prototype)
- [x] Confirmar decisiones v1 en [`README.md`](README.md) (canal cliente, cobros inmutables, outbound mock, post-envío, rechazo, precios)
- [x] Cobros inmutables + `payment_events` mock en store
- [x] Duplicar / archivar cotización; bloqueo post-`clientSentAt`
- [ ] Crear proyecto Supabase (staging)
- [ ] Instalar CLI: `npx supabase link` / `supabase db push`

## 1. Schema

- [ ] Aplicar `20260810180000_enums_and_core.sql`
- [ ] Aplicar `20260810180100_rls.sql`
- [ ] Aplicar `20260810180200_storage.sql`
- [ ] Aplicar `20260813120000_visit_photos.sql`
- [ ] Seed mínimo: departments + 1 admin profile ligado a `auth.users`
- [ ] Probar `select public.next_code('quotation')` bajo dos sesiones concurrentes

## 2. Auth + profiles

- [ ] Desactivar login seed / passwords en `User`
- [ ] `@supabase/ssr` o `@supabase/supabase-js` + session persistente
- [ ] Invite/create user: Auth + insert `profiles` (role, department_id)
- [ ] Verificar RLS: empleado no actualiza `unit_cost` / installments

## 3. Reemplazar store (sin snapshot global)

- [ ] Lecturas: queries / views (`catalog_items_public`, `quotation_lines_safe`)
- [ ] Escrituras: mutaciones por entidad (no `localStorage` workspace)
- [ ] Folios: solo `next_code(...)` en servidor
- [ ] Al marcar abono pagado: `update installments` + `insert payment_events`
- [ ] Realtime: subscribe a `quotations`, `projects`, `project_installments` (fila a fila)
- [ ] Retirar [`lib/technik/live.ts`](../lib/technik/live.ts) sync de snapshot
- [ ] Notificaciones header: eventos Realtime / `quotation_events` / `project_events`

## 4. Storage

- [ ] Avatars → bucket `avatars/{userId}/…`; guardar `profiles.avatar_path`
- [ ] Imágenes PDF → `quote-images/{quotationId}/…`; guardar `quotation_public_items.image_path`
- [ ] Fotos de visita → `visit-photos/{quotationId}/{photoId}.jpg` (+ `.thumb.jpg`); guardar `quotation_visit_photos`
- [ ] Dejar de persistir data URLs en estado
- [ ] Cliente ya comprime (max 1280 px / ~220 KB) antes de subir; no guardar originales ni EXIF

## 5. Post-v1 (fuera del go-live mínimo)

- [ ] Edge Function envío email/WhatsApp + outbox
- [ ] Portal/link de aprobación cliente (si se decide)
- [ ] PDF server-side (opcional; hoy HTML imprimible basta)
- [x] Archivo (`closed`) con UI (prototype)
- [x] Política de rechazo cliente **después** de crear proyecto (bloqueado en prototype)

## Anti-patrones a evitar

1. Portar BroadcastChannel + JSON completo del workspace a Realtime.
2. Confiar solo en `if (role === 'admin')` en React sin RLS.
3. Generar `TKS-Q-…` en el cliente bajo concurrencia.
4. Permitir desmarcar / borrar abonos cobrados (prototype ya lo bloquea; RLS debe reforzarlo).
5. Editar montos de cotización después de `client_sent_at` (usar duplicado).
