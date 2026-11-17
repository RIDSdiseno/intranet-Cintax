type TicketSettingsMenuProps = {
  isAdmin: boolean;
};

/**
 * Menu de configuracion de la ticketera: hoy no tiene nada que ofrecer.
 *
 * Sus tres destinos (Automatizaciones, Agentes y Grupos) son maquetas que
 * guardan en `localStorage` y no tienen backend, por eso sus rutas estan
 * comentadas en `src/routes/AppRoutes.tsx`. Mientras siga asi, el menu abria
 * un desplegable cuyas tres opciones caian en la pagina de "no encontrado".
 *
 * Cuando esas pantallas tengan persistencia real: descomentar las rutas en
 * AppRoutes y reponer aca el <Dropdown> con los items
 * `/tickets/settings/automations`, `/admin/agentes` y
 * `/tickets/settings/groups` (ver historial de git de este archivo).
 */
export default function TicketSettingsMenu(_props: TicketSettingsMenuProps) {
  return null;
}
