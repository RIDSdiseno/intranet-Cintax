import { useEffect } from "react";
import type { ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Underline as UnderlineIcon,
} from "lucide-react";

export type TicketRichTextState = {
  html: string;
  text: string;
  textLength: number;
  isEmpty: boolean;
};

type TicketRichTextEditorProps = {
  value: string;
  disabled?: boolean;
  maxCharacters?: number;
  placeholder?: string;
  onAttachClick?: () => void;
  onChange: (state: TicketRichTextState) => void;
};

function editorSnapshot(editor: Editor): TicketRichTextState {
  const html = editor.getHTML();
  const text = editor
    .getText({ blockSeparator: "\n" })
    .replace(/\u00a0/g, " ")
    .trim();

  return {
    html,
    text,
    textLength: text.length,
    isEmpty: text.length === 0,
  };
}

function ToolbarButton(props: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-black/70 transition ${
        props.active
          ? "border-[var(--secondary-color)] bg-[var(--secondary-color)]/10 text-[var(--secondary-color)]"
          : "border-black/10 bg-white hover:border-black/25"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {props.children}
    </button>
  );
}

// TipTap permite tener HTML estable + comandos listos (B/I/U, listas, links) sin mantener un editor manual.
export default function TicketRichTextEditor({
  value,
  disabled = false,
  maxCharacters = 5000,
  placeholder = "Escribe tu mensaje...",
  onAttachClick,
  onChange,
}: TicketRichTextEditorProps) {
  const editor = useEditor({
    editable: !disabled,
    content: value || "",
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "ticket-rich-editor prose prose-sm max-w-none min-h-[180px] px-3 py-3 text-sm text-black/85 outline-none",
      },
    },
    onUpdate({ editor: current }) {
      onChange(editorSnapshot(current));
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || "";
    if (current === incoming) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    onChange(editorSnapshot(editor));
  }, [editor, onChange]);

  if (!editor) {
    return (
      <div className="rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-black/45">
        Cargando editor...
      </div>
    );
  }

  const textLength = editorSnapshot(editor).textLength;
  const overLimit = textLength > maxCharacters;

  const onSetLink = () => {
    const previousHref = String(editor.getAttributes("link").href || "");
    const nextHref = window.prompt("URL del enlace", previousHref || "https://");
    if (nextHref === null) return;

    const cleanHref = nextHref.trim();
    if (!cleanHref) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .setLink({
        href: cleanHref,
      })
      .run();
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-black/10 px-2 py-2">
        <ToolbarButton
          title="Negrita (Ctrl+B)"
          active={editor.isActive("bold")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Cursiva (Ctrl+I)"
          active={editor.isActive("italic")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Subrayado (Ctrl+U)"
          active={editor.isActive("underline")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Lista con viñetas"
          active={editor.isActive("bulletList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Lista numerada"
          active={editor.isActive("orderedList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Cita"
          active={editor.isActive("blockquote")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Insertar enlace"
          active={editor.isActive("link")}
          disabled={disabled}
          onClick={onSetLink}
        >
          <Link2 size={14} />
        </ToolbarButton>

        <div className="mx-1 h-6 w-px bg-black/10" />

        <ToolbarButton
          title="Adjuntar archivos"
          disabled={disabled}
          onClick={() => onAttachClick?.()}
        >
          <Paperclip size={14} />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-end border-t border-black/10 px-3 py-2">
        <span className={`text-xs ${overLimit ? "text-rose-600" : "text-black/45"}`}>
          {textLength}/{maxCharacters}
        </span>
      </div>
    </div>
  );
}
