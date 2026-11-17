import { API_BASE_URL, fetchJSON } from "../../../lib/api";
import type { InformeResponse, ListaInformesResponse } from "../types";

const INFORMES_BASE_URL = `${API_BASE_URL}/informes`;

/** Los informes ya generados, del mas reciente al mas antiguo. */
export async function listarInformes() {
  return fetchJSON<ListaInformesResponse>(INFORMES_BASE_URL);
}

/** Un informe completo. Lanza si ese periodo todavia no se genero (404). */
export async function obtenerInforme(clave: string) {
  return fetchJSON<InformeResponse>(
    `${INFORMES_BASE_URL}/${encodeURIComponent(clave)}`
  );
}

/**
 * Genera el informe de un periodo y lo guarda.
 *
 * Las fechas van como "2026-11-28", que es lo que entrega un
 * `<input type="date">`. **La clave del informe la calcula el servidor** y
 * vuelve en la respuesta: aca no se arma ninguna.
 *
 * Reemplaza al informe **manual** que ese periodo ya tuviera; el automatico
 * del cron queda intacto y conviven como dos entradas. Tarda varios segundos:
 * la IA redacta el resumen durante la llamada.
 */
export async function generarInforme(rango: { desde: string; hasta: string }) {
  return fetchJSON<InformeResponse>(`${INFORMES_BASE_URL}/generar`, {
    method: "POST",
    body: JSON.stringify(rango),
  });
}
