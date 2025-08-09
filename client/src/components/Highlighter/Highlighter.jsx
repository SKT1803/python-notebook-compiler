import { highlightCode } from "./highlight";
import "./Highlighter.css";

export default function Highlighter({ code, placeholder }) {
  // Kod boşsa placeholder göster
  if (!code) {
    return (
      <pre className="highlighter-container placeholder">
        {placeholder}
      </pre>
    );
  }

  // 1) highlightCode ile HTML’i üret
  const highlighted = highlightCode(code);

  // 2) Konsola bas
  console.log("HIGHLIGHTED HTML:\n", highlighted);

  // 3) Gerçek DOM olarak render et
  return (
    <pre
      className="highlighter-container"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}
