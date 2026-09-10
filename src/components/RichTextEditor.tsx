import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered,
  Table, Link as LinkIcon, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight,
  Loader2,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ACCEPTED_EXTS = ['.jpg', '.jpeg', '.png'];

function isAcceptedFile(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTS.some(ext => file.name.toLowerCase().endsWith(ext));
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write here...',
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setIsFocused] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    editorRef.current?.focus();
    syncContent();
  }, []);

  const syncContent = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const isActive = (command: string, val?: string): boolean => {
    try {
      return val ? document.queryCommandValue(command) === val : document.queryCommandState(command);
    } catch {
      return false;
    }
  };

  const insertTable = () => {
    const rows = 3;
    const cols = 3;
    let html = '<table style="border-collapse:collapse;width:100%;"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td style="border:1px solid #ccc;padding:6px;">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table>';
    exec('insertHTML', html);
  };

  const insertLink = () => {
    const url = window.prompt('Enter URL:');
    if (url) exec('createLink', url);
  };

  const insertImage = (dataUrl: string) => {
    const img = `<img src="${dataUrl}" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" />`;
    exec('insertHTML', img);
  };

  const handleFile = async (file: File) => {
    if (!isAcceptedFile(file)) {
      setErrorMsg('Only JPG and PNG images are supported.');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    setImageLoading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      insertImage(dataUrl);
    } catch {
      setErrorMsg('Failed to process image.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setImageLoading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFile(file);
        return;
      }
    }
  };

  const btnClass = (active: boolean): string =>
    `p-2 rounded-lg transition-colors flex-shrink-0 ${
      active
        ? 'bg-[#fdda36] text-[#514163]'
        : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-500'
    }`;

  const divider = <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />;

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden bg-white dark:bg-gray-700">
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 items-center">
        <button onClick={() => exec('bold')} className={btnClass(isActive('bold'))} title="Bold (Ctrl+B)" disabled={disabled}>
          <Bold className="w-4 h-4" />
        </button>
        <button onClick={() => exec('italic')} className={btnClass(isActive('italic'))} title="Italic (Ctrl+I)" disabled={disabled}>
          <Italic className="w-4 h-4" />
        </button>
        <button onClick={() => exec('underline')} className={btnClass(isActive('underline'))} title="Underline (Ctrl+U)" disabled={disabled}>
          <Underline className="w-4 h-4" />
        </button>
        <button onClick={() => exec('strikeThrough')} className={btnClass(isActive('strikeThrough'))} title="Strikethrough" disabled={disabled}>
          <Strikethrough className="w-4 h-4" />
        </button>

        {divider}

        <button onClick={() => exec('formatBlock', 'H1')} className={btnClass(isActive('formatBlock', 'H1'))} title="Heading 1" disabled={disabled}>
          <Heading1 className="w-4 h-4" />
        </button>
        <button onClick={() => exec('formatBlock', 'H2')} className={btnClass(isActive('formatBlock', 'H2'))} title="Heading 2" disabled={disabled}>
          <Heading2 className="w-4 h-4" />
        </button>
        <button onClick={() => exec('formatBlock', 'H3')} className={btnClass(isActive('formatBlock', 'H3'))} title="Heading 3" disabled={disabled}>
          <Heading3 className="w-4 h-4" />
        </button>

        {divider}

        <button onClick={() => exec('insertUnorderedList')} className={btnClass(isActive('insertUnorderedList'))} title="Bullet List" disabled={disabled}>
          <List className="w-4 h-4" />
        </button>
        <button onClick={() => exec('insertOrderedList')} className={btnClass(isActive('insertOrderedList'))} title="Numbered List" disabled={disabled}>
          <ListOrdered className="w-4 h-4" />
        </button>

        {divider}

        <button onClick={insertTable} className={btnClass(false)} title="Insert Table" disabled={disabled}>
          <Table className="w-4 h-4" />
        </button>
        <button onClick={insertLink} className={btnClass(false)} title="Insert Link" disabled={disabled}>
          <LinkIcon className="w-4 h-4" />
        </button>

        {divider}

        <button onClick={() => exec('justifyLeft')} className={btnClass(isActive('justifyLeft'))} title="Align Left" disabled={disabled}>
          <AlignLeft className="w-4 h-4" />
        </button>
        <button onClick={() => exec('justifyCenter')} className={btnClass(isActive('justifyCenter'))} title="Align Center" disabled={disabled}>
          <AlignCenter className="w-4 h-4" />
        </button>
        <button onClick={() => exec('justifyRight')} className={btnClass(isActive('justifyRight'))} title="Align Right" disabled={disabled}>
          <AlignRight className="w-4 h-4" />
        </button>

        {divider}

        <button onClick={() => fileInputRef.current?.click()} className={btnClass(false)} title="Insert Image (JPG/PNG)" disabled={disabled || imageLoading}>
          {imageLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {errorMsg && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
          {errorMsg}
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={syncContent}
        onBlur={() => { syncContent(); setIsFocused(false); }}
        onFocus={() => setIsFocused(true)}
        onPaste={handlePaste}
        className="rich-text-editor min-h-[200px] p-4 text-gray-900 dark:text-white bg-white dark:bg-gray-700 text-sm leading-relaxed outline-none resize-y overflow-y-auto"
        style={{ maxHeight: '500px', wordBreak: 'break-word' }}
        data-placeholder={placeholder}
      />
    </div>
  );
}
