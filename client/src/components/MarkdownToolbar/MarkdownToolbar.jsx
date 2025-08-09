import "./MarkdownToolbar.css";

export default function MarkdownToolbar({ onAction }) {
  return (
    <div className="md-toolbar">
      <button type="button" onClick={() => onAction("heading")} title="Heading">
        Tt
      </button>
      <button type="button" onClick={() => onAction("bold")} title="Bold">
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => onAction("italic")} title="Italic">
        <em>I</em>
      </button>
      <button type="button" onClick={() => onAction("code")} title="Code">
        {"</>"}
      </button>
      <button type="button" onClick={() => onAction("link")} title="Link">
        🔗
      </button>
      <button type="button" onClick={() => onAction("ol")} title="Ordered List">
        1.
      </button>
      <button type="button" onClick={() => onAction("ul")} title="Unordered List">
        •
      </button>
    </div>
);
}
