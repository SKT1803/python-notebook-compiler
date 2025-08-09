import { useRef, useEffect } from "react";
import './AutoResizeTextarea.css';


function AutoResizeTextarea({ value, onChange, className, placeholder }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={1}
      style={{ overflow: "hidden", resize: "none" }}
    />
  );
}

export default AutoResizeTextarea;
