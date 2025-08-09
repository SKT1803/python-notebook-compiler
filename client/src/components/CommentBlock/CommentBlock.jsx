import React, { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import MarkdownToolbar from "../MarkdownToolbar/MarkdownToolbar";
import "./CommentBlock.css";

function CommentBlock({
  value,
  onChange,
  isExecuted,
  isEditing,
  onEditingChange,
  onExecute
}) {
  const textareaRef = useRef();

  // —— Undo/Redo history state ——
  const [history, setHistory] = useState([value]);
  const [histIndex, setHistIndex] = useState(0);
  const skipNext = useRef(false);

  // Value her değiştiğinde history’e ekle (undo/redo dışındaki değişimler)
  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    setHistory((h) => {
      const truncated = h.slice(0, histIndex + 1);
      return [...truncated, value];
    });
    setHistIndex((i) => i + 1);
  }, [value]);

  // Textarea’yı içerik boyuna göre auto-resize et
  useEffect(() => {
    const ta = textareaRef.current;
    if (isEditing && ta) {
      ta.style.height = "auto";
      ta.style.height = `${ta.scrollHeight}px`;
    }
  }, [value, isEditing]);

  // —— Klavye kısayolları: Undo/Redo, Tab, Ctrl+Enter ——
  const handleKeyDown = (e) => {
    const ta = textareaRef.current;

    // Undo: Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      if (histIndex > 0) {
        const newIndex = histIndex - 1;
        skipNext.current = true;
        onChange({ target: { value: history[newIndex] } });
        setHistIndex(newIndex);
      }
      return;
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))
    ) {
      e.preventDefault();
      if (histIndex < history.length - 1) {
        const newIndex = histIndex + 1;
        skipNext.current = true;
        onChange({ target: { value: history[newIndex] } });
        setHistIndex(newIndex);
      }
      return;
    }

    // Tab indent
    if (e.key === "Tab") {
      e.preventDefault();
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      skipNext.current = true;
      onChange({
        target: { value: value.slice(0, start) + "  " + value.slice(end) }
      });
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      }, 0);
      return;
    }

    // Submit: Ctrl+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onEditingChange(false);
      onExecute?.();
    }
  };

  // —— Markdown format uygulayıcı ——
  const applyFormat = (type) => {
    const ta = textareaRef.current;
    const text = ta.value;
    let start = ta.selectionStart;
    let end = ta.selectionEnd;
    let newText = text;
    let caretPos = end;

    switch (type) {
      case "heading": {
        const lineStart = text.lastIndexOf("\n", start - 1) + 1;
        newText = text.slice(0, lineStart) + "# " + text.slice(lineStart);
        caretPos = start + 2;
        break;
      }
      case "bold": {
        newText =
          text.slice(0, start) +
          "**" +
          text.slice(start, end) +
          "**" +
          text.slice(end);
        caretPos = start + 2 + (end - start);
        break;
      }
      case "italic": {
        newText =
          text.slice(0, start) +
          "*" +
          text.slice(start, end) +
          "*" +
          text.slice(end);
        caretPos = start + 1 + (end - start);
        break;
      }
      case "code": {
        const sel = text.slice(start, end);
        const block = "```\n" + sel + "\n```";
        newText = text.slice(0, start) + block + text.slice(end);
        caretPos = start + block.length;
        break;
      }
      case "ol": {
        const before = text.lastIndexOf("\n", start - 1) + 1;
        const after = text.indexOf("\n", end);
        const blockEnd = after === -1 ? text.length : after;
        const lines = text.slice(before, blockEnd).split("\n");
        const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
        newText = text.slice(0, before) + numbered + text.slice(blockEnd);
        caretPos = start + (numbered.length - (end - before));
        break;
      }
      case "ul": {
        const before = text.lastIndexOf("\n", start - 1) + 1;
        const after = text.indexOf("\n", end);
        const blockEnd = after === -1 ? text.length : after;
        const lines = text.slice(before, blockEnd).split("\n");
        const bulleted = lines.map((l) => `- ${l}`).join("\n");
        newText = text.slice(0, before) + bulleted + text.slice(blockEnd);
        caretPos = start + 2 + (bulleted.length - (end - before));
        break;
      }
      case "link": {
        let sel = text.slice(start, end).trim();
        // Seçim yoksa kelime yakala
        if (!sel) {
          const left = text.lastIndexOf(" ", start - 1) + 1;
          const right = text.indexOf(" ", start);
          const wordEnd = right === -1 ? text.length : right;
          const word = text.slice(left, wordEnd).trim();
          if (/^https?:\/\//i.test(word)) {
            sel = word;
            start = left;
            end = wordEnd;
          }
        }


          // Protokolsüz linkleri düzelt (www. gibi)
          if (sel && !/^(https?:\/\/|mailto:|tel:)/i.test(sel)) {
            sel = `https://${sel}`;
          }

        if (sel && /^https?:\/\//i.test(sel)) {
          let label;
          try {
            const parts = new URL(sel).hostname.split(".");
            label = parts.length > 1 ? parts[parts.length - 2] : parts[0];
          } catch {
            label = sel;
          }
          const snippet = `[${label}](${sel})`;
          newText = text.slice(0, start) + snippet + text.slice(end);
          caretPos = start + snippet.length;
        } else {
          const placeholder = "https://";
          const snippet = `[link text ](${placeholder})`;
          newText = text.slice(0, start) + snippet + text.slice(end);
          caretPos =
            start +
            snippet.indexOf(placeholder) +
            placeholder.length +
            1;
        }
        break;
      }
      default:
        return;
    }

    // Ortak değişiklik + history’e ekleme
    skipNext.current = true;
    onChange({ target: { value: newText } });
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = caretPos;
    }, 0);
  };

  const handlePreviewClick = () => onEditingChange(true);

  // —— Preview modu ——  
  if (!isEditing && isExecuted) {
    const display = value.trim()
      ? value
      : "_(empty comment – click to edit)_";
    return (
      <div className="comment-block single-preview" onClick={handlePreviewClick}>
        <div className="comment-preview">
          <ReactMarkdown>{display}</ReactMarkdown>
        </div>
      </div>
    );
  }

  // —— Edit + Live Preview modu ——  
  return (
    <div className="comment-block split-view">
      <MarkdownToolbar onAction={applyFormat} />
      <textarea
        ref={textareaRef}
        className="comment-block-view"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment..."
      />
      <div className="comment-preview">
        <ReactMarkdown>{value || "_(Preview)_"}</ReactMarkdown>
      </div>
    </div>
  );
}

export default CommentBlock;
