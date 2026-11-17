# Modulo Tickets (Front)

## Flujo de visibilidad
- `admin/soporte`: alterna vista `Todos` (toda la intranet) y `Mis tickets`.
- `usuario normal`: alterna `Toda mi area` y `Mis tickets`. Arranca en
  `Mis tickets`, pero puede ver el area completa: los tickets que entran por
  correo nacen **sin asignar**, y forzar `Mis tickets` dejaba invisibles para
  el area los que todavia no tienen dueno. El alcance real lo impone el
  backend (`enforceArea`), no la UI.

> **Los tickets sin area siguen siendo solo para ADMIN.** `Toda mi area`
> muestra los que el backend logra clasificar (`resolveTicketArea`: columna
> `areaAsignada`, area del asignado, `categoria`, destinatario o palabras
> clave). Un correo a `soporte@cintax.cl` sin ninguna de esas senales queda
> sin area, y entonces no pertenece a ninguna: solo lo ve un ADMIN, que es
> quien tiene que clasificarlo o asignarlo. Si eso se vuelve un cuello de
> botella, la salida no es ampliar la visibilidad por area sino mejorar la
> clasificacion de entrada (`TICKETS_AREA_EMAIL_MAP`, casillas por area).
- La deteccion se basa en `role`, `isAdmin` e `isSupervisorOrAdmin` del JWT (`src/lib/auth.ts`).

### Dos niveles de admin
- `esAdminOSoporte()`: ADMIN, SUPERVISOR o SOPORTE. Gobierna la UI del dia a
  dia (crear ticket, reasignar, editar clasificacion, filtro por agente).
- `esAdminEstricto()`: solo ADMIN, igual que `isAdmin()` del backend. Es la que
  gobierna **Sincronizar** y **Ver inbox diagnostico**, porque esos dos
  endpoints responden 403 a cualquier otro rol.

## HUD y filtros disponibles
- `Vista`: `Mis tickets` / `Todos` (para agentes la segunda es `Toda mi area`).
- `Agente`: `Todos`, `No asignado` o trabajador especifico (solo admin/soporte).
- `Solicitante`: input con sugerencias (typeahead simple).
- `Estado`: `Todos`, `Abierto`, `Pendiente`, `Resuelto`, `Cerrado`.
- `Prioridad`: `Todas`, `Baja`, `Media`, `Alta`, `Urgente`.
- `Busqueda`: por numero/asunto/descripcion/email.
- Tabs por area/grupo se mantienen arriba de la tabla.
- Autoaplicacion de filtros con debounce de `400ms`.

### Los filtros viven en la URL

`TicketsPage` no guarda los filtros en estado: los lee de la query string
(`leerFiltrosDeUrl`) y la barra escribe ahi (`escribirFiltrosEnUrl`, con
`replace` para no dejar una entrada de historial por tecla). Una sola fuente,
no dos sincronizandose: con `useState` mas efectos en ambos sentidos cada
cambio dispara al otro y hay que inventar guardas para cortar el ciclo.

Gratis con eso: recargar no borra los filtros, el enlace se puede compartir, y
el asistente puede ofrecer un boton que abre la tabla ya filtrada.

La URL es entrada **no confiable** (la escribe el usuario, un enlace pegado o
el asistente): `leerFiltrosDeUrl` valida contra `ESTADOS_TICKET`,
`PRIORIDADES_TICKET` y el formato de `agente`, y lo que no reconoce cae al
valor por defecto. `?agente=7` en manos de alguien que no es admin no hace
nada: `normalizarFiltrosTicketsApi` lo descarta antes de llamar a la API, y el
backend acota por area de todos modos.

Solo se escriben los valores distintos del default, asi que sin filtrar la URL
queda limpia. La pagina **no** va en la URL: es estado de `useTickets` y se
reinicia al cambiar los filtros.

> **Cuidado al tocar `area`.** `setSearchParams({ area })` con un objeto
> reemplaza la query entera y se lleva los filtros por delante. Mientras
> vivian en estado de React no se notaba; ahora si. Por eso el cambio de area
> pasa por `ponerArea`, que usa la forma funcional y solo toca esa clave. La
> misma regla vale para cualquier parametro que se agregue despues.

### Los filtros sobreviven al abrir un ticket

Abrir un ticket se hace con `abrirTicket`, que manda los filtros actuales en
el `state` de la navegacion. `TicketDetailPage` los lee en `volverAListado`, y
los tres botones de "Volver a tickets" devuelven a **esa** lista.

Van en el `state` y no en la URL del ticket porque no son suyos:
`/tickets/8?estado=Abierto` sugiere que el detalle esta filtrado por algo,
cuando solo es la memoria de donde venias. Ahi `?modo=reply` si es del ticket
y por eso ese si viaja en la URL.

Entrar por un enlace directo no trae `state`, y el boton vuelve al listado por
defecto. Es lo correcto: no habia lista de donde venir.

## Endpoints usados
Los sirve `back/src/modules/tickets/` (montado en `/api/tickets`).

- `GET /api/tickets/groups?view=`: tabs y contadores. `view` tiene que ir con
  el mismo valor que el listado, o la pestana cuenta el area completa mientras
  la tabla muestra solo los tuyos.
- `GET /api/tickets`: listado con filtros avanzados y paginacion
  (`{ items, total, page, pageSize }`). El paginador vive en `useTickets`:
  cambiar area o filtros vuelve a la pagina 1.
- `POST /api/tickets`: crear ticket manual.
- `GET /api/tickets/:id`: detalle.
- `PATCH /api/tickets/:id`: cerrar y actualizar propiedades
  (estado, prioridad, categoria, agente, `tags`, `areaDetected`).
- `GET /api/tickets/:id/messages`: hilo.
- `POST /api/tickets/:id/messages`: responder/nota/reenviar (envia por Gmail).
- `GET /api/tickets/:id/events`: historial de auditoria.
- `GET /api/tickets/agents`: agentes para filtros y reasignacion.
- `POST /api/tickets/sync`: ingesta de correo (solo ADMIN). No modifica la
  casilla de soporte: los hilos quedan como estaban. El boton **Sincronizar**
  igual pide confirmacion, porque crea tickets de verdad.
- `GET /api/tickets/inbox/diagnostic`: diagnostico (solo admin).
- `POST /api/tickets/:id/reply`: compat legado.

## Ingesta de correo
Los correos a `TICKETS_MAILBOX` (`soporte@cintax.cl`) crean tickets solos:
`back/src/modules/tickets/email/ingestInbox.ts`, expuesto en `POST /api/tickets/sync`
y agendado cada 5 min cuando `ENABLE_TICKETS_CRON=true`. Deduplica por
`gmailThreadId` y `gmailMessageId`, asi que se puede reejecutar sin duplicar.

Por defecto **no marca los hilos como leidos** y barre por fecha (`newer_than`),
no por `is:unread`. Las dos cosas van juntas: buscar solo no leidos sin marcar
nada despues haria que cada corrida repitiera los mismos hilos viejos y los
correos nuevos quedaran fuera del cupo de `maxThreads`. Con
`TICKETS_MARK_READ=true` vuelve el comportamiento anterior, y el endpoint
acepta `?markRead=` / `?unreadOnly=` por llamada.

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
- `utils/areas.ts`: tipo `AreaDetected` y los nombres que ve el usuario
  (`CONTABLE` -> Contabilidad, `TRIBUTARIA` -> Comercial y Marketing,
  `LABORAL` -> Recursos Humanos). Unica fuente de esas etiquetas en el front.
- `pages/PaginaTickets.tsx` y `pages/PaginaDetalleTicket.tsx`: alias de paginas.
