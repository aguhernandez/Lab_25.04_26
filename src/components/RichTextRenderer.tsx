interface RichTextRendererProps {
  content: string;
  className?: string;
}

export default function RichTextRenderer({ content, className = '' }: RichTextRendererProps) {
  if (!content || !content.trim()) return null;

  return (
    <div
      className={`rich-text-renderer ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
