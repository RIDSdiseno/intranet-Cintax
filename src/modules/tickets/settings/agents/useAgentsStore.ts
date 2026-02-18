import React from "react";
import type {
  Agent,
  AgentDirectoryFilter,
  AgentOrderBy,
  AgentTab,
  Group,
  NewAgentPayload,
} from "./types";

const STORAGE_KEY = "cintax.demo.agents.v1";

export const AGENT_GROUPS: Group[] = [
  { id: "administrativo", name: "Administrativo" },
  { id: "soporte-rids", name: "Soporte Rids" },
  { id: "ventas", name: "Ventas" },
];

const GROUPS_BY_ID = AGENT_GROUPS.reduce<Record<string, Group>>((acc, group) => {
  acc[group.id] = group;
  return acc;
}, {});

type UseAgentsStoreState = {
  agents: Agent[];
  activeTab: AgentTab;
  orderBy: AgentOrderBy;
  directoryFilter: AgentDirectoryFilter;
  search: string;
  tabCounts: Record<AgentTab, number>;
  directoryCounts: Record<AgentDirectoryFilter, number>;
  visibleAgents: Agent[];
  setActiveTab: React.Dispatch<React.SetStateAction<AgentTab>>;
  setOrderBy: React.Dispatch<React.SetStateAction<AgentOrderBy>>;
  setDirectoryFilter: React.Dispatch<React.SetStateAction<AgentDirectoryFilter>>;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  createAgent: (payload: NewAgentPayload) => void;
};

function createAgentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `agent-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function inferNameFromEmail(email: string) {
  const left = email.split("@")[0] ?? "";
  const clean = left.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

  if (!clean) return "Nuevo agente";

  return clean
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function groupsFromIds(groupIds: string[]) {
  return groupIds
    .map((id) => GROUPS_BY_ID[id])
    .filter((group): group is Group => Boolean(group));
}

export function getAgentBucket(agent: Agent): AgentTab {
  if (agent.status === "inactive") return "disabled";
  return agent.type === "field" ? "field" : "support";
}

export function getAgentFunctionLabel(agent: Agent) {
  if (agent.role === "Administrador de soporte") return "Administrador de soporte";
  if (agent.type === "field") return "Tecnico de campo";
  return "Agente de soporte";
}

function matchesDirectoryFilter(agent: Agent, directoryFilter: AgentDirectoryFilter) {
  if (directoryFilter === "administrators") {
    return agent.role === "Administrador de soporte";
  }

  if (directoryFilter === "agents_only") {
    return agent.role === "Agent";
  }

  return true;
}

function matchesSearch(agent: Agent, search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    agent.name,
    agent.email,
    getAgentFunctionLabel(agent),
    agent.groups.map((group) => group.name).join(" "),
    agent.lastSeenLabel,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

function createInitialAgents(): Agent[] {
  const now = Date.now();

  return [
    {
      id: "agent-rudy-calsin",
      name: "Rudy Calsin",
      email: "rudy.calsin@cintax.demo",
      type: "support",
      role: "Agent",
      groups: groupsFromIds(["administrativo"]),
      lastSeenAt: now - 4 * 60 * 1000,
      lastSeenLabel: "Hace 4 minutos",
      status: "active",
      level: "Senior",
      signature: "",
      workday: "occasional",
      visibilityScope: "all",
    },
    {
      id: "agent-soporte-rids",
      name: "Soporte RIDS",
      email: "soporte.rids@cintax.demo",
      type: "field",
      role: "Agent",
      groups: groupsFromIds(["soporte-rids"]),
      lastSeenAt: now - 22 * 60 * 1000,
      lastSeenLabel: "Hace 22 minutos",
      status: "active",
      level: "Intermediate",
      signature: "",
      workday: "occasional",
      visibilityScope: "assigned",
    },
    {
      id: "agent-soporte-rids-disabled",
      name: "SOPORTE RIDS",
      email: "soporte.rids.n2@cintax.demo",
      type: "support",
      role: "Agent",
      groups: groupsFromIds(["ventas"]),
      lastSeenAt: now - 25 * 60 * 60 * 1000,
      lastSeenLabel: "Hace 1 dia",
      status: "inactive",
      level: "Beginner",
      signature: "",
      workday: "occasional",
      visibilityScope: "group",
    },
    {
      id: "agent-admin-cintax",
      name: "Administrador Cintax",
      email: "admin.cintax@cintax.demo",
      type: "support",
      role: "Administrador de soporte",
      groups: groupsFromIds(["administrativo", "soporte-rids"]),
      lastSeenAt: now - 8 * 60 * 1000,
      lastSeenLabel: "Hace 8 minutos",
      status: "active",
      level: "Senior",
      signature: "",
      workday: "occasional",
      visibilityScope: "all",
    },
  ];
}

function readInitialAgents() {
  if (typeof window === "undefined") return createInitialAgents();

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createInitialAgents();

  try {
    const parsed = JSON.parse(raw) as Agent[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return createInitialAgents();
    }
    return parsed;
  } catch {
    return createInitialAgents();
  }
}

export function useAgentsStore(): UseAgentsStoreState {
  const [agents, setAgents] = React.useState<Agent[]>(() => readInitialAgents());
  const [activeTab, setActiveTab] = React.useState<AgentTab>("support");
  const [orderBy, setOrderBy] = React.useState<AgentOrderBy>("name_asc");
  const [directoryFilter, setDirectoryFilter] =
    React.useState<AgentDirectoryFilter>("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  }, [agents]);

  const filteredAgents = React.useMemo(
    () =>
      agents.filter(
        (agent) => matchesDirectoryFilter(agent, directoryFilter) && matchesSearch(agent, search)
      ),
    [agents, directoryFilter, search]
  );

  const tabCounts = React.useMemo(
    () =>
      filteredAgents.reduce<Record<AgentTab, number>>(
        (acc, agent) => {
          acc[getAgentBucket(agent)] += 1;
          return acc;
        },
        { support: 0, field: 0, disabled: 0 }
      ),
    [filteredAgents]
  );

  const directoryCounts = React.useMemo(() => {
    const countWithFilter = (nextFilter: AgentDirectoryFilter) =>
      agents.filter(
        (agent) => matchesDirectoryFilter(agent, nextFilter) && matchesSearch(agent, search)
      ).length;

    return {
      all: countWithFilter("all"),
      administrators: countWithFilter("administrators"),
      agents_only: countWithFilter("agents_only"),
    };
  }, [agents, search]);

  const visibleAgents = React.useMemo(() => {
    const rows = filteredAgents.filter((agent) => getAgentBucket(agent) === activeTab);

    rows.sort((a, b) => {
      if (orderBy === "name_desc") return b.name.localeCompare(a.name);
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [activeTab, filteredAgents, orderBy]);

  const createAgent = React.useCallback((payload: NewAgentPayload) => {
    const email = payload.email.trim().toLowerCase();
    const role = payload.roles[0] ?? "Agent";
    const assignableGroups = payload.visibilityScope === "group" ? payload.groupIds : [];

    const newAgent: Agent = {
      id: createAgentId(),
      name: inferNameFromEmail(email),
      email,
      type: payload.type,
      role,
      groups: groupsFromIds(assignableGroups),
      lastSeenAt: Date.now(),
      lastSeenLabel: "Hace unos segundos",
      status: "active",
      level: payload.level,
      signature: payload.signature.trim(),
      workday: payload.workday,
      visibilityScope: payload.visibilityScope,
    };

    setAgents((current) => [newAgent, ...current]);
    setActiveTab(payload.type === "field" ? "field" : "support");
  }, []);

  return {
    agents,
    activeTab,
    orderBy,
    directoryFilter,
    search,
    tabCounts,
    directoryCounts,
    visibleAgents,
    setActiveTab,
    setOrderBy,
    setDirectoryFilter,
    setSearch,
    createAgent,
  };
}
