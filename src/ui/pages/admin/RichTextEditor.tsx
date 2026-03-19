import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

type Props = {
  value: any | null;
  onChange: (doc: any, plainText: string) => void;
};

export function RichTextEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || undefined,
    editorProps: {
      attributes: {
        class: "rt-editor",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (!value) return;
    // Only reset when value is different (rough heuristic).
    try {
      const current = editor.getJSON();
      if (JSON.stringify(current) !== JSON.stringify(value)) {
        editor.commands.setContent(value);
      }
    } catch {
      // ignore
    }
  }, [editor, value]);

  if (!editor) return <div className="card u-p-12 u-opacity-85">Загрузка редактора…</div>;

  return <EditorContent editor={editor} />;
}

