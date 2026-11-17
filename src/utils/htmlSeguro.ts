// src/utils/htmlSeguro.ts
//
// HTML que viene de la base de datos y hay que mostrar en pantalla o convertir
// a texto.
//
// **Se trata como hostil**, aunque lo normal sea que lo haya escrito un
// companero con el editor. Las bitacoras se guardan como HTML y el backend no
// filtra nada: comprueba que sea un string, le quita los espacios de los
// bordes y lo guarda (`clienteBitacora.controller.ts`). Lo que se mande por la
// API, se guarda. Y el editor TipTap no es una barrera: es la interfaz, no el
// unico camino al endpoint.
//
// Estas funciones vivian dentro de `BitacoraEquipoPage`. Se movieron aqui sin
// cambiarles nada, porque `BitacoraPage` necesita el mismo saneado y una
// pantalla no deberia depender de otra para algo asi: el siguiente que
// necesite sanear HTML tiene que encontrarlo donde se busca, y no escribir el
// suyo mal configurado.

import sanitizeHtml from "sanitize-html";

/**
 * Parsea HTML sin ejecutar nada de lo que traiga.
 *
 * **Esta es la funcion que importa de este archivo.** La forma intuitiva de
 * leer HTML es crear un div y asignarle `innerHTML`, y es justo la que no hay
 * que usar: aunque el div nunca se monte en la pagina, sus nodos pertenecen al
 * documento real, asi que el navegador carga las imagenes y dispara sus
 * manejadores. Un `<img src=x onerror="...">` guardado en una bitacora se
 * ejecuta con la sesion de quien la esta mirando. `<script>` no corre por esa
 * via, pero `onerror` si.
 *
 * `DOMParser` construye un documento aparte e inerte: crea los mismos nodos,
 * no carga recursos y no ejecuta nada. El arbol se recorre igual.
 */
export function documentoInerte(html: string): Document {
  return new DOMParser().parseFromString(html || "", "text/html");
}

/**
 * El texto plano de un HTML.
 *
 * Para buscar, comparar o precargar un editor de texto: donde hace falta lo
 * que dice y no como se ve.
 */
export function htmlATexto(html: string): string {
  if (typeof DOMParser === "undefined") return html || "";
  return (documentoInerte(html).body.textContent || "").trim();
}

/**
 * Junta los parrafos vacios y los saltos repetidos que deja el editor.
 *
 * Es cosmetico, no de seguridad: el saneado lo hace `safeHtml`.
 */
export function compactHtml(raw: string) {
  const html = raw || "";

  let out = html.replace(/\r\n/g, "\n");
  out = out.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "<br/>");
  out = out.replace(/(<br\s*\/?>\s*){3,}/gi, "<br/><br/>");
  out = out.replace(/^(<br\s*\/?>\s*)+/gi, "");

  return out.trim();
}

/**
 * HTML listo para pintar: conserva el formato y tira todo lo demas.
 *
 * La lista de etiquetas y atributos es una allowlist, no una lista de cosas
 * prohibidas. Esa diferencia es el punto: lo que no este nombrado aqui no
 * pasa, incluidos los `on*` y cualquier etiqueta que se invente manana. Los
 * estilos van acotados por expresion regular para que no entre `url()` ni
 * nada que cargue algo de fuera.
 *
 * `sanitize-html` solo admite por defecto los protocolos http, https, mailto,
 * tel y ftp, asi que un enlace `javascript:` tampoco pasa.
 */
export function safeHtml(html: string) {
  const cleaned = compactHtml(html);

  return sanitizeHtml(cleaned, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "blockquote",
      "code",
      "pre",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "a",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      p: ["style"],
      span: ["style"],
      li: ["style"],
      ol: ["style"],
      ul: ["style"],
      code: ["class"],
      pre: ["class"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        color: [/^#([0-9a-fA-F]{3}){1,2}$/],
        "background-color": [/^#([0-9a-fA-F]{3}){1,2}$/],
        "font-size": [/^\d+(px|rem|em)$/],
        "font-family": [/^[\w\s,"'-]+$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });
}
