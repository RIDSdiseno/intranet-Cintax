export type AgentType = "support" | "field";

export type AgentRole = "Agent" | "Administrador de soporte";

export type TicketVisibilityScope = "all" | "group" | "assigned";

export type AgentStatus = "active" | "inactive";

export type AgentTab = "support" | "field" | "disabled";

export type AgentOrderBy = "name_asc" | "name_desc";

export type AgentDirectoryFilter = "all" | "administrators" | "agents_only";

export type AgentLevel = "Beginner" | "Intermediate" | "Senior";

export type AgentWorkday = "full_time" | "occasional";

export type Group = {
  id: string;
  name: string;
};

export type Agent = {
  id: string;
  name: string;
  email: string;
  type: AgentType;
  role: AgentRole;
  groups: Group[];
  lastSeenAt: number;
  lastSeenLabel: string;
  status: AgentStatus;
  level: AgentLevel;
  signature: string;
  workday: AgentWorkday;
  visibilityScope: TicketVisibilityScope;
};

export type NewAgentPayload = {
  email: string;
  type: AgentType;
  workday: AgentWorkday;
  level: AgentLevel;
  signature: string;
  roles: AgentRole[];
  visibilityScope: TicketVisibilityScope;
  groupIds: string[];
};
