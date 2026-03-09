import { useState } from "react";
import ManualTaskCreator from "./ManualTaskCreator";
import ExcelTaskUploader from "./ExcelTaskUploader";

type Tab = "manual" | "excel" | "reassign";

export default function TaskAssignmentTabs() {
  const [tab, setTab] = useState<Tab>("manual");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")}>
          Manual
        </TabButton>
        <TabButton active={tab === "excel"} onClick={() => setTab("excel")}>
          Excel
        </TabButton>
      </div>

      {tab === "manual" && <ManualTaskCreator />}
      {tab === "excel" && <ExcelTaskUploader />}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl text-sm border transition",
        active
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white hover:bg-gray-50 border-gray-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}