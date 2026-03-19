import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export function RichTextViewer({ doc }: { doc: any }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: doc || undefined,
    editable: false,
    editorProps: {
      attributes: {
        style: "padding:0; background: transparent; border:0;",
      },
    },
  });

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

