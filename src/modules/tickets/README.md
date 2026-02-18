# Modulo Tickets (Front)

## Flujo de visibilidad
- `admin/soporte`: puede alternar vista `Todos` y `Mis tickets`.
- `usuario normal`: vista forzada a `Mis tickets`.
- La deteccion se basa en `role`, `isAdmin` e `isSupervisorOrAdmin` del JWT (`src/lib/auth.ts`).

## HUD y filtros disponibles
- `Vista`: `Mis tickets` / `Todos` (solo admin/soporte).
- `Agente`: `Todos`, `No asignado` o trabajador especifico (solo admin/soporte).
- `Solicitante`: input con sugerencias (typeahead simple).
- `Estado`: `Todos`, `Abierto`, `Pendiente`, `Resuelto`, `Cerrado`.
- `Prioridad`: `Todas`, `Baja`, `Media`, `Alta`, `Urgente`.
- `Busqueda`: por numero/asunto/descripcion/email.
- Tabs por area/grupo se mantienen arriba de la tabla.
- Autoaplicacion de filtros con debounce de `400ms`.

## Endpoints usados
- `GET /api/tickets/groups`: tabs y contadores.
- `GET /api/tickets`: listado con filtros avanzados y paginacion.
- `PATCH /api/tickets/:id`: cerrar y actualizar propiedades.
- `GET /api/tickets/:id`: detalle.
- `GET /api/tickets/:id/messages`: hilo.
- `POST /api/tickets/:id/messages`: responder/nota/reenviar.
- `POST /api/tickets/:id/reply`: compat legado.

## Acciones de UI
- `Ver`: navega a `/tickets/:id`.
- `Responder`: `/tickets/:id?modo=reply`.
- `Nota`: `/tickets/:id?modo=note`.
- `Reenviar`: `/tickets/:id?modo=forward`.
- `Cerrar`: confirm dialog y `PATCH` real.
- En ticket cerrado:
  - `Responder/Reenviar` deshabilitados.
  - `Nota interna` permitida solo para admin/soporte.

## Flujo de correo en detalle
- El composer valida localmente `Para`, `CC`, `BCC` antes de enviar.
- `Reenviar` exige asunto.
- `POST /api/tickets/:id/messages` responde `emailStatus`:
  - `SENT`: correo enviado.
  - `SKIPPED`: mensaje guardado sin salida externa (ej. nota interna).
  - `FAILED`: mensaje guardado, pero fallo el envio.
- El front muestra toast distinto segun `emailStatus` y `emailError`.

## Estructura agregada
- `api/tickets.api.ts`: alias en espanol sin romper imports actuales.
- `components/BarraFiltrosTickets.tsx`: HUD de filtros.
- `hooks/useTickets.ts`: carga con debounce y estado de listado.
- `utils/normalizarFiltros.ts`: normalizacion de filtros para API.
- `pages/PaginaTickets.tsx` y `pages/PaginaDetalleTicket.tsx`: alias de paginas.
