import { useEffect, useRef, useState } from "react";
import "./FilesPanel.css";

/**
 * Props:
 *  - visible: boolean
 *  - files: Array<{ id, name, size, data?, status: 'reading' | 'done' | 'error', message?: string }>
 *  - onFileUpload: (file: File) => void
 *  - onRemoveFile?: (id: string) => void
 *  - onClose: () => void
 *  - maxSize?: number  // tek dosya limiti
 *  - totalLimit?: number  // toplam kota (byte)
 */
export default function FilesPanel({
  visible,
  files = [],
  onFileUpload,
  onRemoveFile,
  onClose,
  maxSize,
  totalLimit,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState(null);
  const limit = maxSize ?? 5 * 1024 * 1024;

  // toast auto-hide timer
  const hideTimerRef = useRef(null);

  // Toplam kullanılan byte (error olmayanları say)
  const usedBytes = files
    .filter((f) => f.status !== "error")
    .reduce((acc, f) => acc + (f.size || 0), 0);

  const percent =
    totalLimit ? Math.min(100, Math.round((usedBytes / totalLimit) * 100)) : 0;

  const prevStatusRef = useRef(new Map());

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 B";
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // Status değişimlerinde (reading -> done/error) toast
  useEffect(() => {
    let changedFile = null;

    for (const f of files) {
      const prev = prevStatusRef.current.get(f.id);
      if (prev !== f.status && (f.status === "done" || f.status === "error")) {
        changedFile = f;
      }
    }

    // status haritasını güncelle
    const next = new Map();
    for (const f of files) next.set(f.id, f.status);
    prevStatusRef.current = next;

    if (changedFile) {
      setToast({
        type: changedFile.status === "done" ? "success" : "error",
        text:
          changedFile.status === "error"
            ? changedFile.message || `${changedFile.name}: Upload failed`
            : `${changedFile.name}: Upload successful`,
      });

      // sadece yeni toast kurulurken önceki timer'ı temizle
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setToast(null);
        hideTimerRef.current = null;
      }, 2500);
    }

    // burada cleanup DÖNDÜRMÜYORUZ—aksi halde başka renderlarda timer gereksiz iptal olur
  }, [files]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  // (Opsiyonel) panel kapanınca toast'ı gizle
  // useEffect(() => { if (!visible) setToast(null); }, [visible]);

  const handleInput = (e) => {
    const list = Array.from(e.target.files || []);
    list.forEach((f) => onFileUpload?.(f));
    e.target.value = "";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files || []);
    list.forEach((f) => onFileUpload?.(f));
    setDragOver(false);
  };

  // progress bar rengi
  const barClass = percent >= 90 ? "danger" : percent >= 70 ? "warn" : "ok";

  return (
    <div className={`files-panel ${visible ? "open" : ""}`}>
      <div className="files-panel-header">
        <h3>Files</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="files-panel-body">
        <div className="upload-actions">
          <label htmlFor="file-input" className="pick-btn">
            Select File
          </label>
          <input
            id="file-input"
            className="file-input"
            type="file"
            multiple
            accept=".csv,.tsv,.txt"
            onChange={handleInput}
          />

        <div
            className={`dropzone ${dragOver ? "drag-over" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
          >
            <div className="plus">+</div>
            <div className="drop-hint">Drag &amp; Drop</div>
          </div>
        </div>

        {/* TOPLAM KOTA GÖRSELİ — totalLimit geldiyse göster */}
        {typeof totalLimit === "number" && (
          <div className="quota-box" aria-label="Toplam kota">
            <div className="quota-line">
              <span>Total:</span>
              <strong>{formatBytes(usedBytes)}</strong>
              <span className="sep">/</span>
              <span>{formatBytes(totalLimit)}</span>
            </div>
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={`bar ${barClass}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        <div className="upload-hint">Max: {formatBytes(limit)} / file</div>

        {files.length > 0 && (
          <ul className="files-list">
            {files.map((f) => {
              const pillClass =
                f.status === "reading"
                  ? "pill loading"
                  : f.status === "done"
                  ? "pill ok"
                  : f.status === "error"
                  ? "pill err"
                  : "pill";

              return (
                <li key={f.id} className="file-item">
                  <span className="file-name" title={f.name}>
                    {f.name}
                  </span>

                  <div className="file-right">
                    <span className={pillClass}>
                      {formatBytes(f.size).replace(" ", "\u00A0")}
                    </span>

                    {onRemoveFile && (
                      <button
                        className="trash-btn"
                        title="Sil"
                        onClick={() => onRemoveFile(f.id)}
                        disabled={f.status === "reading"}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.text}</div>}
    </div>
  );
}
