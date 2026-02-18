export {
  getGroups as obtenerGruposTickets,
  getTickets as obtenerTickets,
  syncTickets as sincronizarTickets,
  getInboxDiagnostic as obtenerInboxDiagnostico,
  getTicketById as obtenerTicketPorId,
  getTicketEvents as obtenerEventosTicket,
  getTicketMessages as obtenerMensajesTicket,
  getTicketAgents as obtenerAgentesTickets,
  createTicketMessage as crearMensajeTicket,
  sendTicketReply as enviarRespuestaTicket,
  updateTicket as actualizarTicket,
  createTicket as crearTicket,
} from "../services/ticketsApi";
