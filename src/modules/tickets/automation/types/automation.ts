export type AutomationTab = "CREATION" | "UPDATES" | "SCHEDULES";

export type ExecutionMode = "FIRST_MATCH" | "ALL_MATCH";

export type ActorType =
  | "AGENT"
  | "REQUESTER"
  | "AGENT_OR_REQUESTER"
  | "SYSTEM";

export type ScopeType = "TICKETS" | "CONTACTS" | "COMPANIES" | "THREADS";

export type ConditionOperator = "ANY" | "ALL";

export type AutomationTrigger = {
  id: string;
  type: string;
  value?: string;
};

export type AutomationConditionItem = {
  id: string;
  scope: ScopeType;
  field: string;
  comparator: string;
  value: string;
};

export type AutomationActionItem = {
  id: string;
  type: string;
  params: Record<string, string>;
};

export type AutomationRule = {
  id: string;
  tab: AutomationTab;
  name: string;
  description?: string;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string;
  impactedLast7Days: number;
  runMode: ExecutionMode;
  event: {
    actor: ActorType;
    triggers: AutomationTrigger[];
  };
  conditions: {
    operator: ConditionOperator;
    items: AutomationConditionItem[];
  };
  actions: {
    items: AutomationActionItem[];
  };
};

export type AutomationRuleDraft = Omit<
  AutomationRule,
  "id" | "updatedAt" | "updatedBy" | "impactedLast7Days"
> & {
  updatedBy?: string;
  impactedLast7Days?: number;
};

export const AUTOMATION_TAB_OPTIONS: Array<{ value: AutomationTab; label: string }> = [
  { value: "CREATION", label: "Creacion De Tickets" },
  { value: "UPDATES", label: "Actualizaciones Del Ticket" },
  { value: "SCHEDULES", label: "Activadores Por Horas" },
];

export const EXECUTION_MODE_OPTIONS: Array<{
  value: ExecutionMode;
  label: string;
}> = [
  { value: "FIRST_MATCH", label: "Ejecutando primera regla coincidente" },
  { value: "ALL_MATCH", label: "Ejecutar todas las reglas coincidentes" },
];

export const ACTOR_OPTIONS: Array<{ value: ActorType; label: string }> = [
  { value: "AGENT", label: "Agente" },
  { value: "REQUESTER", label: "Solicitante" },
  { value: "AGENT_OR_REQUESTER", label: "Agente o solicitante" },
  { value: "SYSTEM", label: "Sistema" },
];

export const EVENT_TYPE_OPTIONS = [
  "Se cambio la prioridad",
  "Se cambio el tipo",
  "Se cambio el estado",
  "Grupo esta actualizado",
  "Agente esta actualizado",
];

export const CONDITION_SCOPE_OPTIONS: Array<{ value: ScopeType; label: string }> = [
  { value: "TICKETS", label: "Tickets" },
  { value: "CONTACTS", label: "Contactos" },
  { value: "COMPANIES", label: "Empresas" },
  { value: "THREADS", label: "Hilos" },
];

export const COMPARATOR_OPTIONS = [
  { value: "contains", label: "contiene" },
  { value: "not_contains", label: "no contiene" },
  { value: "equals", label: "es igual" },
  { value: "starts_with", label: "empieza con" },
  { value: "ends_with", label: "termina con" },
];

export const FIELD_OPTIONS_BY_SCOPE: Record<
  ScopeType,
  Array<{ value: string; label: string }>
> = {
  TICKETS: [
    { value: "subject", label: "Asunto" },
    { value: "description", label: "Descripcion" },
    { value: "status", label: "Estado" },
    { value: "priority", label: "Prioridad" },
    { value: "group", label: "Grupo" },
    { value: "tags", label: "Etiquetas" },
  ],
  COMPANIES: [
    { value: "company_name", label: "Nombre de la empresa" },
    { value: "company_domain", label: "Dominio de la empresa" },
    { value: "health_score", label: "Puntuacion de salud" },
  ],
  CONTACTS: [
    { value: "email", label: "Email" },
    { value: "name", label: "Nombre" },
    { value: "phone", label: "Telefono" },
  ],
  THREADS: [
    { value: "keywords", label: "Contiene palabras clave" },
    { value: "last_message", label: "Ultimo mensaje" },
  ],
};

export const ACTION_OPTIONS = [
  { value: "assign_group", label: "Asignar a grupo" },
  { value: "assign_agent", label: "Asignar a agente" },
  { value: "change_priority", label: "Cambiar prioridad" },
  { value: "change_status", label: "Cambiar estado" },
  { value: "send_email", label: "Enviar correo" },
  { value: "add_tag", label: "Agregar etiqueta" },
];

