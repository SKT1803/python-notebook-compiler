import { useEffect, useRef, useState } from "react";
import Highlighter from "../Highlighter/Highlighter";
import "./CodeEditor.css";

export default function CodeEditor({
  value,
  onChange,
  placeholder = "Write your Python code...",
  startLine = 0,
  onRun,
}) {
  const textareaRef = useRef(null);
  const [height, setHeight] = useState(0);

  // Satır sayısına göre yükseklik hesapla
  useEffect(() => {
    const lineHeight = 20; // CSS’de line-height: 20px
    const padding = 8 * 2;  // CSS’de padding: 8px 12px (dikey toplam 16px)
    const lines = Math.max(1, value.split("\n").length);
    setHeight(lines * lineHeight + padding);
  }, [value]);

    const handleKeyDown = (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = textareaRef.current;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      onChange({ target: { value: value.slice(0, start) + "  " + value.slice(end) } });
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      }, 0);
    }

    // Ctrl+Enter veya Cmd+Enter ile çalıştır (Code cell i)
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (typeof onRun === "function") {
        onRun();
      }
    }
  };
  
  // Kaç satırlı bir içerik varsa, 0-based index ile mapleyip startLine+1’den başlatıyoruz
  const lines = value.split("\n");
  const lineCount = Math.max(1, lines.length);

  return (
    <div className="editor-container">
      <div className="editor-line-numbers">
        {Array.from({ length: lineCount }).map((_, i) => (
          <div key={i} className="line-number">
            {startLine + i + 1}
          </div>
        ))}
      </div>
      <div className="editor-input-area" style={{ height }}>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder=""
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          style={{ height }}
        />
        <Highlighter code={value} placeholder={placeholder} />
      </div>
    </div>
  );
}
