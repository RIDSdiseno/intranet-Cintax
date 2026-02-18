export type TicketSettingsRule = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
  impactedLast7Days: number;
};

export type TemplateCategory =
  | "Todas"
  | "Comunicacion con el cliente"
  | "Satisfaccion"
  | "Eficiencia soporte tecnico"
  | "Colaboracion interna";

export type RuleTypeLabel =
  | "Creacion de Tickets"
  | "Actualizaciones Del Ticket"
  | "Activadores Por Horas";

export type TicketTemplate = {
  id: string;
  title: string;
  description: string;
  category: Exclude<TemplateCategory, "Todas">;
  ruleType: RuleTypeLabel;
  locked: boolean;
};

export type TicketAgent = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Activo" | "Inactivo";
};

export type TicketGroup = {
  id: string;
  name: string;
  description: string;
  assignedAgents: number;
};

const now = Date.now();

export const mockRulesCreation: TicketSettingsRule[] = [
  {
    id: "creation-1",
    name: "RRHH",
    description:
      "Si asunto o descripcion contiene liquidaciones, contrato o finiquito, asignar al grupo de RRHH y notificar al equipo.",
    enabled: true,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 8).toISOString(),
    updatedBy: "Soporte Consultoria",
    impactedLast7Days: 12,
  },
  {
    id: "creation-2",
    name: "Facturacion",
    description:
      "Cuando el ticket menciona boleta, factura o cobro, priorizar en media y asignar al grupo de Contabilidad.",
    enabled: true,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
    updatedBy: "Admin Cintax",
    impactedLast7Days: 24,
  },
  {
    id: "creation-3",
    name: "Onboarding clientes",
    description:
      "Para tickets nuevos de implementacion, etiquetar onboarding, asignar agente senior y enviar correo de bienvenida.",
    enabled: false,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 15).toISOString(),
    updatedBy: "Jefatura Soporte",
    impactedLast7Days: 6,
  },
];

export const mockRulesUpdates: TicketSettingsRule[] = [
  {
    id: "updates-1",
    name: "Reapertura automatica",
    description:
      "Si el solicitante responde cuando el ticket esta resuelto, cambiar estado a Abierto y reasignar al ultimo agente.",
    enabled: true,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedBy: "Admin Cintax",
    impactedLast7Days: 11,
  },
  {
    id: "updates-2",
    name: "Escalamiento prioridad alta",
    description:
      "Cuando se actualiza con palabras criticas o SLA vencido, subir prioridad a Alta y enviar aviso a supervision.",
    enabled: true,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 7).toISOString(),
    updatedBy: "Mesa Central",
    impactedLast7Days: 9,
  },
  {
    id: "updates-3",
    name: "Cierre por confirmacion cliente",
    description:
      "Si el cliente confirma solucion, mover estado a Cerrado y registrar etiqueta de cierre exitoso.",
    enabled: false,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 20).toISOString(),
    updatedBy: "Soporte Consultoria",
    impactedLast7Days: 3,
  },
];

export const mockRulesTimeTriggers: TicketSettingsRule[] = [
  {
    id: "time-1",
    name: "Recordatorio 24h sin respuesta",
    description:
      "Cada hora revisar tickets pendientes sin respuesta de agente por mas de 24h y notificar en canal interno.",
    enabled: true,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 4).toISOString(),
    updatedBy: "Supervisor Soporte",
    impactedLast7Days: 18,
  },
  {
    id: "time-2",
    name: "Cierre automatico 72h",
    description:
      "Cerrar tickets en estado resuelto sin actividad durante 72 horas y enviar email de cierre al solicitante.",
    enabled: false,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 11).toISOString(),
    updatedBy: "Admin Cintax",
    impactedLast7Days: 7,
  },
  {
    id: "time-3",
    name: "Resumen diario a jefatura",
    description:
      "Enviar cada dia a las 18:00 un resumen con tickets abiertos, vencidos y escalados por equipo.",
    enabled: true,
    updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 1).toISOString(),
    updatedBy: "Mesa Central",
    impactedLast7Days: 5,
  },
];

export const mockTemplates: TicketTemplate[] = [
  {
    id: "tpl-1",
    title: "Confirmacion automatica al crear ticket",
    description:
      "Envia un correo de bienvenida y entrega numero de seguimiento apenas se crea el ticket.",
    category: "Comunicacion con el cliente",
    ruleType: "Creacion de Tickets",
    locked: false,
  },
  {
    id: "tpl-2",
    title: "NPS luego de resolver",
    description:
      "Cuando el estado cambia a resuelto, dispara encuesta de satisfaccion y guarda la respuesta.",
    category: "Satisfaccion",
    ruleType: "Actualizaciones Del Ticket",
    locked: false,
  },
  {
    id: "tpl-3",
    title: "Escalamiento por SLA",
    description:
      "Si falta menos de 1 hora para vencer SLA, alerta a lider y marca ticket como critico.",
    category: "Eficiencia soporte tecnico",
    ruleType: "Activadores Por Horas",
    locked: true,
  },
  {
    id: "tpl-4",
    title: "Notificacion a equipo interno",
    description:
      "Comparte en canal interno cuando un ticket empresarial cambia de prioridad.",
    category: "Colaboracion interna",
    ruleType: "Actualizaciones Del Ticket",
    locked: false,
  },
  {
    id: "tpl-5",
    title: "Seguimiento a tickets sin respuesta",
    description:
      "Cada 6 horas recuerda al agente tickets abiertos pendientes de actualizacion.",
    category: "Eficiencia soporte tecnico",
    ruleType: "Activadores Por Horas",
    locked: true,
  },
  {
    id: "tpl-6",
    title: "Correo de cierre amable",
    description:
      "Al cerrar ticket, envia resumen de solucion con acceso rapido para reabrir.",
    category: "Comunicacion con el cliente",
    ruleType: "Actualizaciones Del Ticket",
    locked: false,
  },
];

export const mockAgents: TicketAgent[] = [
  {
    id: "ag-1",
    name: "Camila Fuentes",
    email: "camila.fuentes@cintax.cl",
    role: "Admin",
    status: "Activo",
  },
  {
    id: "ag-2",
    name: "Matias Rojas",
    email: "matias.rojas@cintax.cl",
    role: "Agente Senior",
    status: "Activo",
  },
  {
    id: "ag-3",
    name: "Daniela Herrera",
    email: "daniela.herrera@cintax.cl",
    role: "Agente",
    status: "Inactivo",
  },
  {
    id: "ag-4",
    name: "Nicolas Vega",
    email: "nicolas.vega@cintax.cl",
    role: "Agente",
    status: "Activo",
  },
];

export const mockGroups: TicketGroup[] = [
  {
    id: "grp-1",
    name: "Contabilidad",
    description: "Consultas de facturacion, boletas, notas de credito y cobranzas.",
    assignedAgents: 5,
  },
  {
    id: "grp-2",
    name: "Recursos Humanos",
    description: "Solicitudes sobre contratos, remuneraciones, anexos y beneficios.",
    assignedAgents: 4,
  },
  {
    id: "grp-3",
    name: "Comercial y Marketing",
    description: "Leads, acuerdos comerciales y coordinacion de campañas.",
    assignedAgents: 6,
  },
];
