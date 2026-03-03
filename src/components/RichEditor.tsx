// src/components/RichEditor.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Extension } from "@tiptap/core";

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Link2,
  Unlink,
  Eraser,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Type,
  Palette,
} from "lucide-react";

type Props = {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * ✅ FontSize via TextStyle mark attribute
 */
const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) =>
              (element as HTMLElement).style.fontSize?.replace(/["']/g, "") || null,
            renderHTML: (attrs) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize: null }).run();
        },
    };
  },
});

const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" },
  { label: "Roboto", value: "Roboto, system-ui, -apple-system, Segoe UI, Arial" },
  { label: "Segoe UI", value: "Segoe UI, system-ui, -apple-system, Roboto, Arial" },
  { label: "Arial", value: "Arial, system-ui" },
  { label: "Georgia", value: "Georgia, serif" },
  {
    label: "Courier",
    value:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace",
  },
] as const;

const SIZE_OPTIONS = [
  { label: "10", value: "10px" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
  { label: "28", value: "28px" },
  { label: "32", value: "32px" },
] as const;

function ToolbarBtn({
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // ✅ mantiene selección/cursor
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={[
        "inline-flex items-center justify-center h-9 w-9 rounded-lg border text-sm transition",
        active
          ? "border-vp-primary/40 bg-vp-primary/10 text-vp-primary"
          : "border-vp-border bg-white text-gray-700 hover:bg-gray-50",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-7 w-px bg-gray-200 mx-1" aria-hidden="true" />;
}

function getListActive(editor: Editor) {
  const bullet = editor.isActive("bulletList");
  const ordered = editor.isActive("orderedList");
  return { bullet, ordered };
}

export default function RichEditor({
  valueHtml,
  onChangeHtml,
  disabled,
  placeholder = "Escribe tu bitácora...",
}: Props) {
  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        // ✅ keepMarks / keepAttributes existen para las listas
        bulletList: { keepMarks: true, keepAttributes: true },
        orderedList: { keepMarks: true, keepAttributes: true },
        // ❌ listItem.keepMarks ya no existe en tu versión → eliminado
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      FontSize,
    ],
    content: valueHtml || "",
    editorProps: {
      attributes: {
        class:
          "ProseMirror min-h-[240px] w-full rounded-xl border border-vp-border bg-white px-3 py-2 text-sm focus:outline-none",
        "data-placeholder": placeholder,
      },
    },
    onUpdate({ editor }) {
      onChangeHtml(editor.getHTML());
    },
  });

  // Sync externo -> editor (sin disparar onUpdate)
  useEffect(() => {
    if (!editor) return;
    const next = valueHtml || "";
    const current = editor.getHTML();
    if (next !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [valueHtml, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  // ✅ Forzar re-render cuando cambie selección (para refrescar font/size)
  const [selTick, setSelTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const handler = () => setSelTick((x) => x + 1);
    editor.on("selectionUpdate", handler);
    editor.on("transaction", handler);
    return () => {
      editor.off("selectionUpdate", handler);
      editor.off("transaction", handler);
    };
  }, [editor]);

  const currentFontSize = useMemo(() => {
    if (!editor) return "14px";
    const a = editor.getAttributes("textStyle") as { fontSize?: string | null };
    return a.fontSize || "14px";
  }, [editor, valueHtml, selTick]);

  const currentFontFamily = useMemo(() => {
    if (!editor) return FONT_OPTIONS[0].value;
    const a = editor.getAttributes("textStyle") as { fontFamily?: string | null };
    return a.fontFamily || FONT_OPTIONS[0].value;
  }, [editor, valueHtml, selTick]);

  const currentColor = useMemo(() => {
    if (!editor) return "#111827";
    const a = editor.getAttributes("textStyle") as { color?: string | null };
    return a.color || "#111827";
  }, [editor, valueHtml, selTick]);

  if (!editor) return null;

  const { bullet: bulletActive, ordered: orderedActive } = getListActive(editor);

  function setLink() {
    const prev = (editor.getAttributes("link").href as string | undefined) || "";
    const url = window.prompt("Pegar link:", prev);
    if (url === null) return;

    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }

  function clearFormatting() {
    editor.chain().focus().unsetAllMarks().run();
  }

  function toggleBulletListSafe() {
    const chain = editor.chain().focus();
    if (editor.isActive("orderedList")) {
      chain.toggleOrderedList().run();
      chain.toggleBulletList().run();
      return;
    }
    chain.toggleBulletList().run();
  }

  function toggleOrderedListSafe() {
    const chain = editor.chain().focus();
    if (editor.isActive("bulletList")) {
      chain.toggleBulletList().run();
      chain.toggleOrderedList().run();
      return;
    }
    chain.toggleOrderedList().run();
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="rounded-xl border border-vp-border bg-white px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* ✅ Tipografía (SIN preventDefault en select) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 inline-flex items-center gap-1">
              <Type size={14} /> Fuente
            </span>

            <select
              className="h-9 rounded-lg border border-vp-border bg-white px-2 text-sm"
              disabled={disabled}
              value={currentFontFamily}
              onChange={(e) => {
                editor.chain().focus().setFontFamily(e.target.value).run();
              }}
              title="Tipografía"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ Tamaño (SIN preventDefault en select) */}
          <select
            className="h-9 w-[92px] rounded-lg border border-vp-border bg-white px-2 text-sm"
            disabled={disabled}
            value={currentFontSize}
            onChange={(e) => (editor as any).commands.setFontSize(e.target.value)}
            title="Tamaño"
          >
            {SIZE_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <Divider />

          {/* Estilos */}
          <ToolbarBtn
            title="Negrita"
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            disabled={disabled}
          >
            <Bold size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Cursiva"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            disabled={disabled}
          >
            <Italic size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Subrayado"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            disabled={disabled}
          >
            <UnderlineIcon size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Tachado"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            disabled={disabled}
          >
            <Strikethrough size={16} />
          </ToolbarBtn>

          <ToolbarBtn title="Quitar formato" onClick={clearFormatting} disabled={disabled}>
            <Eraser size={16} />
          </ToolbarBtn>

          <Divider />

          {/* Listas */}
          <ToolbarBtn
            title="Lista"
            onClick={toggleBulletListSafe}
            active={bulletActive}
            disabled={disabled}
          >
            <List size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Lista numerada"
            onClick={toggleOrderedListSafe}
            active={orderedActive}
            disabled={disabled}
          >
            <ListOrdered size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Cita"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            disabled={disabled}
          >
            <Quote size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Bloque de código"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive("codeBlock")}
            disabled={disabled}
          >
            <Code size={16} />
          </ToolbarBtn>

          <Divider />

          {/* Alineación */}
          <ToolbarBtn
            title="Alinear izquierda"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            active={editor.isActive({ textAlign: "left" })}
            disabled={disabled}
          >
            <AlignLeft size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Centrar"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            active={editor.isActive({ textAlign: "center" })}
            disabled={disabled}
          >
            <AlignCenter size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Alinear derecha"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            active={editor.isActive({ textAlign: "right" })}
            disabled={disabled}
          >
            <AlignRight size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Justificar"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            active={editor.isActive({ textAlign: "justify" })}
            disabled={disabled}
          >
            <AlignJustify size={16} />
          </ToolbarBtn>

          <Divider />

          {/* Color texto */}
          <label className="inline-flex items-center gap-2 h-9 rounded-lg border border-vp-border bg-white px-2 text-sm text-gray-700">
            <span className="inline-flex items-center gap-1 text-xs">
              <Palette size={14} />
              Color
            </span>
            <input
              type="color"
              title="Color de texto"
              value={currentColor}
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              className="h-6 w-8 cursor-pointer bg-transparent"
            />
          </label>

          {/* Resaltado */}
          <label className="inline-flex items-center gap-2 h-9 rounded-lg border border-vp-border bg-white px-2 text-sm text-gray-700">
            <Highlighter size={16} />
            <input
              type="color"
              title="Resaltado"
              disabled={disabled}
              onMouseDown={(e) => e.preventDefault()}
              onChange={(e) =>
                editor.chain().focus().toggleHighlight({ color: e.target.value }).run()
              }
              className="h-6 w-8 cursor-pointer bg-transparent"
            />
          </label>

          <Divider />

          {/* Links */}
          <ToolbarBtn title="Insertar link" onClick={setLink} disabled={disabled}>
            <Link2 size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Quitar link"
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={disabled || !editor.isActive("link")}
          >
            <Unlink size={16} />
          </ToolbarBtn>

          <Divider />

          {/* Undo/Redo */}
          <ToolbarBtn
            title="Deshacer"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={disabled || !editor.can().undo()}
          >
            <Undo size={16} />
          </ToolbarBtn>

          <ToolbarBtn
            title="Rehacer"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={disabled || !editor.can().redo()}
          >
            <Redo size={16} />
          </ToolbarBtn>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        {editor.isEmpty && !disabled ? (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-gray-400">
            {placeholder}
          </div>
        ) : null}

        <EditorContent editor={editor} />
      </div>
    </div>
  );
}