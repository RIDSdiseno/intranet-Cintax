import TaskAssignmentTabs from "../components/task-assignment/TaskAssignmentTabs";

export default function TaskAssignmentPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Asignación y creación de tareas</h1>
        <p className="text-sm text-gray-500">
          Crear tareas manualmente o por Excel, y reasignarlas.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <TaskAssignmentTabs />
      </div>
    </div>
  );
}