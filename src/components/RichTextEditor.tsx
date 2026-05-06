import { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, List } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write here...',
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const applyFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const toggleBold = () => applyFormat('bold');
  const toggleItalic = () => applyFormat('italic');
  const toggleUnderline = () => applyFormat('underline');
  const toggleList = () => applyFormat('insertUnorderedList');

  const isCommandActive = (command: string): boolean => {
    return document.queryCommandState(command);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-700">
      <div className="flex gap-1 p-3 border-b border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
        <button
          onClick={toggleBold}
          className={`p-2 rounded-lg transition-colors ${
            isCommandActive('bold')
              ? 'bg-[#fdda36] text-[#514163]'
              : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
          }`}
          title="Bold (Ctrl+B)"
          disabled={disabled}
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          onClick={toggleItalic}
          className={`p-2 rounded-lg transition-colors ${
            isCommandActive('italic')
              ? 'bg-[#fdda36] text-[#514163]'
              : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
          }`}
          title="Italic (Ctrl+I)"
          disabled={disabled}
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          onClick={toggleUnderline}
          className={`p-2 rounded-lg transition-colors ${
            isCommandActive('underline')
              ? 'bg-[#fdda36] text-[#514163]'
              : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
          }`}
          title="Underline (Ctrl+U)"
          disabled={disabled}
        >
          <Underline className="w-4 h-4" />
        </button>

        <div className="w-px bg-gray-200 dark:bg-gray-600" />

        <button
          onClick={toggleList}
          className={`p-2 rounded-lg transition-colors ${
            isCommandActive('insertUnorderedList')
              ? 'bg-[#fdda36] text-[#514163]'
              : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
          }`}
          title="Bullet List"
          disabled={disabled}
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={editorRef}
        onInput={handleInput}
        contentEditable={!disabled}
        suppressContentEditableWarning
        className="min-h-[200px] p-4 text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm leading-relaxed outline-none resize-y overflow-y-auto"
        style={{
          maxHeight: '400px',
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}
        data-placeholder={placeholder}
      />
    </div>
  );
}
