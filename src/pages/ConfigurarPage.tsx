import React, { useState } from "react";
import { User, Save, Camera, Trash2 } from "lucide-react";

type TabId = "perfil";

export default function ConfigurarPage() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("El archivo excede los 2MB permitidos.");
        return;
      }
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const [activeTab, setActiveTab] = useState<TabId>("perfil");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    nombre: "Rosalía",
    cargo: "Anibistrador",
    email: "administrador@cintax.com",
    telefono: "+56 9 1234 5678",
    currentPass: "",
    newPass: "",
    confirmPass: "",
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert("Cambios guardados correctamente (Simulación)");
    }, 1000);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const tabs = [
    {
      id: "perfil",
      label: "Mi Perfil",
      icon: User,
      desc: "Gestiona tu información personal",
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--primary-color)" }}
        >
          Configuración
        </h1>
        <p className="text-black/60 text-sm">
          Administra tus preferencias personales y credenciales de acceso.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <nav className="w-full md:w-64 flex-shrink-0">
          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-white text-[var(--secondary-color)] shadow-sm border border-black/5"
                      : "text-black/60 hover:bg-black/5 hover:text-black/80"
                  }`}
                >
                  <Icon
                    size={18}
                    className={
                      isActive ? "text-[var(--secondary-color)]" : "opacity-70"
                    }
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 bg-white rounded-2xl shadow-sm border border-black/5 p-6 min-h-[400px]">
          <div className="mb-6 pb-4 border-b border-black/5 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-[var(--primary-color)]">
                {tabs.find((t) => t.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-black/50 mt-1">
                {tabs.find((t) => t.id === activeTab)?.desc}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 active:scale-95"
              style={{ background: "var(--secondary-color)" }}
            >
              <Save size={16} />
              {loading ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>

          {activeTab === "perfil" && (
            <form className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-6 mb-8 p-4 border border-black/5 rounded-2xl bg-black/[0.02]">
                  {/* Avatar con Previsualización */}
                  <div className="relative shrink-0">
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-sm overflow-hidden flex items-center justify-center bg-[var(--tertiary-color)]">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Avatar preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-3xl font-bold text-[var(--secondary-color)]">
                          {formData.nombre.charAt(0)}
                        </span>
                      )}
                    </div>
                    {/* Botón flotante de cámara (opcional, decorativo) */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow border border-black/10 text-black/60 hover:text-[var(--secondary-color)] transition-colors"
                    >
                      <Camera size={16} />
                    </button>
                  </div>

                  {/* Controles */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                        style={{ background: "var(--secondary-color)" }}
                      >
                        Subir nueva imagen
                      </button>
                      {previewUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="px-3 py-2 text-sm font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                          Eliminar
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-black/50">
                      Se recomienda una imagen cuadrada de al menos 400x400px.
                      <br />
                      Formatos permitidos: JPG o PNG. Máximo 2MB.
                    </p>

                    {/* Input oculto */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/png, image/jpeg"
                      onChange={handleImageChange}
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => handleChange("nombre", e.target.value)}
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">
                    Cargo
                  </label>
                  <input
                    type="text"
                    value={formData.cargo}
                    readOnly
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-black/[0.02] outline-none text-black/60 cursor-default"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-black/[0.02] outline-none text-black/60 cursor-default"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-black/70 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => handleChange("telefono", e.target.value)}
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors"
                  />
                </div>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
