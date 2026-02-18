import React from "react";
import { Outlet } from "react-router-dom";
import { AutomationRulesProvider } from "../store/AutomationRulesContext";

export default function AutomationLayout() {
  return (
    <AutomationRulesProvider>
      <Outlet />
    </AutomationRulesProvider>
  );
}

