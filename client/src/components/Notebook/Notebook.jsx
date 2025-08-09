import { useState, useRef } from "react";
import { X, ImageIcon, MessageCircle, Folder} from "lucide-react";
import { FaStop, FaPlay } from "react-icons/fa";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import AutoResizeTextarea from "../AutoResizeTextarea/AutoResizeTextarea";
import CodeEditor from "../CodeEditor/CodeEditor";
import DownloadMenu from "../DownloadMenu/DownloadMenu"
import CommentBlock from "../CommentBlock/CommentBlock";
import FilesPanel from "../FilesPanel/FilesPanel"
import "./Notebook.css";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;


// Gereksiz traceback satırlarını temizle
function cleanTraceback(text = "") {
  if (!text) return text;

  const skip = [
    /File "\/code\/runner\.py"/, // bizim launcher
    /<frozen runpy>/, // frozen runpy satırları
    /runpy\.py/, // Python'un runpy modülü
    /runpy\.run_path/, // runpy.run_path çağrısı
    /importlib\/__init__\.py/,  // bazen importlib stack'i görünür
  ];

  const lines = text.split("\n");
  const kept = [];

  for (const ln of lines) {
    // bu satırların hiçbiriyle eşleşmiyorsa tut
    if (!skip.some(rx => rx.test(ln))) kept.push(ln);
  }

  // art arda boş satırları sıkıştır
  const compact = [];
  for (const ln of kept) {
    if (!(ln.trim() === "" && compact[compact.length - 1]?.trim() === "")) {
      compact.push(ln);
    }
  }

  return compact.join("\n").trimEnd();
}


function Notebook() {
  const [title, setTitle] = useState("Untitled");
  const [blocks, setBlocks] = useState([
    { id: Date.now().toString(), 
      type: "code", 
      content: "",  
      executedContent: "",
      isRunning: false,
      isPending: false,
      isExecuted: false, 
      timestamp: new Date(),
      isEditing: false, },
      
  ]);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [cancelSignal, setCancelSignal] = useState({}); // her hücreye özel iptal sinyali


  // files panel toggle ve dosya listesi için state 
  const [filesPanelVisible, setFilesPanelVisible] = useState(false);
  const [files, setFiles] = useState([]);

 // LIMITLER
 const FILE_SIZE_LIMIT  = Number(import.meta.env.VITE_SINGLE_FILE_LIMIT)  || 5 * 1024 * 1024;
 const FILE_TOTAL_LIMIT = Number(import.meta.env.VITE_TOTAL_UPLOAD_LIMIT) || 50 * 1024 * 1024;


 // Yüklenen dosyaların toplam boyutu
 const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  
 const toggleFilesPanel = () => setFilesPanelVisible(v => !v);

const RUNTIMES = [
  { key: "python", label: "Python", menuLabel: "Python (3.11)", desc: "Python 3.11 environment" },
  { key: "base", label: "Base", menuLabel: "Base", desc: "numpy, pandas, matplotlib, scipy, seaborn, sklearn, pillow, requests, bs4, lxml, pyarrow, openpyxl" },
  { key: "ml",   label: "ML", menuLabel: "ML", desc: "Base + xgboost, lightgbm" },
];

// default yok; kullanıcı seçsin
const [runtime, setRuntime] = useState("python");
const [runtimeOpen, setRuntimeOpen] = useState(false);

const SIZES = [
  { key: "s", label: "Small (256MB / 0.25 CPU)", mem: "256m", cpu: "0.25" },
  { key: "m", label: "Medium (512MB / 0.5 CPU)", mem: "512m", cpu: "0.5" },
  { key: "l", label: "Large (1GB / 1 CPU)",      mem: "1g",   cpu: "1.0" },
];

const [size, setSize] = useState("m");
const selSize = SIZES.find(s => s.key === size) || SIZES[1]; // default Medium
const [sizeOpen, setSizeOpen] = useState(false);

const currentRuntimeLabel = RUNTIMES.find(r => r.key === runtime)?.label ?? "Python";

// DEV: spinner testini aç/kapat
const SLOW_READ_MIN = 1800; // ms
const SLOW_READ_MAX = 3200; // ms
const simulateSlowRead = true; // test için true yap, bittiğinde false'a al


const handleFileUpload = (file) => {
  if (file.size > FILE_SIZE_LIMIT) {
    setFiles(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        status: "error",
        message: `File size limit exceeded: ${(FILE_SIZE_LIMIT / 1024 / 1024).toFixed(1)} MB`,
      },
    ]);
    return;
  }

// toplam kota kontrolü
if (totalBytes + file.size > FILE_TOTAL_LIMIT) {
  setFiles(prev => [
    ...prev,
    {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      status: "error",
      message: `Total upload quota exceeded: ${((totalBytes + file.size)/1024/1024).toFixed(2)} MB / ${(FILE_TOTAL_LIMIT/1024/1024).toFixed(0)} MB`,
    },
  ]);
  return;
}

  const reader = new FileReader();
  const id = Date.now().toString();

  // önce reading olarak ekle (spinner bu durumda görünüyor)
  setFiles(prev => [...prev, { id, name: file.name, size: file.size, status: "reading" }]);

  reader.onload = (e) => {
    const doneUpdate = () =>
      setFiles(prev =>
        prev.map(f => (f.id === id ? { ...f, data: e.target.result, status: "done" } : f))
      );

    if (simulateSlowRead) {
      const delay = Math.floor(Math.random() * (SLOW_READ_MAX - SLOW_READ_MIN + 1)) + SLOW_READ_MIN;
      setTimeout(doneUpdate, delay); // spinner bu sürede döner
    } else {
      doneUpdate();
    }
  };

  reader.onerror = () => {
    setFiles(prev => prev.map(f => (f.id === id ? { ...f, status: "error", message: "Read error" } : f)));
  };

  reader.readAsDataURL(file);
};


const removeFile = (id) => {
  setFiles(prev => prev.filter(f => f.id && f.id !== id));
};

  const addBlock = (index, type) => {
    const newBlock = {
      id: Date.now().toString(),
      type,
      content: "",
      executedContent: "",
      timestamp: new Date(),
      isRunning: false,
      isExecuted: false, 
      isEditing: type === "comment",
    };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    setBlocks(newBlocks);
  };

const updateBlock = (index, newContent) => {
  const updated = [...blocks];
  const prevContent = updated[index].content;

  updated[index].content = newContent;

  // Eğer içerik değiştiyse, ama hücre henüz çalıştırılmadıysa, isExecuted false yapılmalı.
  // Ama tekrar çalıştırılmadıkça, isExecuted flag'ini değiştirme!
  if (prevContent !== newContent && !updated[index].isRunning) {
    // Burada sadece içerik değiştiğini işaretlemek istiyorsan başka flag kullanabilirsin.
    updated[index].contentChangedSinceExecution = true;
    // isExecuted değişmez!
  }

  setBlocks(updated);
};

  const deleteBlock = (index) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    setBlocks(newBlocks);
  };


const getCumulativeCode = (blocks, currentIndex) => {
  let code = "";
  const includedBlockIds = new Set();

  for (let i = 0; i < currentIndex; i++) {
    const block = blocks[i];

    if (
      block.type !== "code" ||
      !block.isExecuted ||
      block.content.trim() === "" ||
      block.output?.includes("Traceback")
    ) {
      continue;
    }

    const lines = (block.executedContent || block.content).split("\n");
    let includeNextLines = false;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];

      // Blok başlatan satırlar (def, class, if, for, while, vb.)
      if (/^\s*(def |class |if |for |while |try |with )/.test(line)) {
        includeNextLines = true;
        code += line + "\n";
        continue;
      }

      // Boş satır veya yorum ise doğrudan ekle
      if (/^\s*(#|$)/.test(line)) {
        code += line + "\n";
        continue;
      }

      // Girintili satırsa ve bir blok içindeysek ekle
      if (includeNextLines && /^\s+/.test(line)) {
        code += line + "\n";
        continue;
      }

      // Yeni tanımlama satırıysa doğrudan ekle
      if (/^\s*([a-zA-Z_]\w*\s*=|import |from )/.test(line)) {
        code += line + "\n";
        includeNextLines = false;
      }
    }
  }

  return code;
};

  //  Yorum bloğu çalıştırıldığında edit modu kapat
  const runCommentBlock = (index) => {
    const updated = [...blocks];
    updated[index] = {
      ...updated[index],
      isExecuted: true,
      contentChangedSinceExecution: false,
      isEditing: false,  
    };
    setBlocks(updated);
  };


const runBlock = async (index) => {
  const updated = [...blocks];


  if (updated[index].type === "comment") {
  runCommentBlock(index);
  return;
}


  if (updated[index].isRunning) {
    if (cancelSignal[index]) {
      cancelSignal[index].abort();
    }
    updated[index].isRunning = false;
    updated[index].output = "⛔ Process stopped.";
    updated[index].isExecuted = false;
    setBlocks([...updated]);
    return;
  }

  const controller = new AbortController();
  setCancelSignal((prev) => ({ ...prev, [index]: controller }));

  updated[index].isRunning = true;
  updated[index].isExecuted = false;
  updated[index].images = [];
  const startTime = Date.now();
  setBlocks([...updated]);

  const cumulativeCode = getCumulativeCode(updated, index);
  const fullCode = cumulativeCode + updated[index].content;

  try {
       const res = await fetch(`${BACKEND_URL}/execute`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       code: fullCode,
       runtime,
       mem: selSize.mem,
       cpu: selSize.cpu,

       files: files
        .filter(f => f.data && f.status === "done")
        .map(f => ({ name: f.name, data: f.data }))
     }),
    signal: controller.signal,
    });

    const data = await res.json();
    let outputMsg = data.output || `Error: ${data.error || "Unknown error."}`;

    outputMsg = cleanTraceback(outputMsg);

    const definedVars = [];
    const currentVars = {};
    const lines = updated[index].content.split("\n");

    for (const line of lines) {
      const match = line.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(.+)$/);
      if (match) {
        const [_, varName, newValue] = match;
        currentVars[varName] = newValue.trim();
      }
    }

    for (const varName in currentVars) {
      let previousValue = null;

      for (let i = index - 1; i >= 0; i--) {
        const prevBlock = blocks[i];
        if (
          prevBlock.type === "code" &&
          prevBlock.isExecuted &&
          prevBlock.executedContent
        ) {
          const prevLines = prevBlock.executedContent.split("\n");
          for (const line of prevLines) {
            const match = line.match(new RegExp(`^\\s*${varName}\\s*=\\s*(.+)$`));
            if (match) {
              previousValue = match[1].trim();
              break;
            }
          }
        }
        if (previousValue !== null) break;
      }

      if (previousValue !== null && previousValue !== currentVars[varName]) {
        definedVars.push(`${varName} = ${previousValue} → ${currentVars[varName]}`);
      } else {
        definedVars.push(`${varName} = ${currentVars[varName]}`);
      }
    }

    if (definedVars.length > 0) {
      outputMsg += `\n\nDefined variables:\n` + definedVars.join("\n");
    }

    updated[index].output = outputMsg;
    updated[index].images = data.images || [];
    updated[index].isExecuted = true;
    updated[index].executedContent = updated[index].content;
    updated[index].contentChangedSinceExecution = false;

  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    if (err.name === "AbortError") {
      updated[index].output = `⛔ Process stopped. Duration: ${duration} seconds`;
    } else {
      updated[index].output = "⚠️ Error: Unable to reach the server.";
    }
    updated[index].isExecuted = false;
    updated[index].images = []; // eski görüntüyü temizle
  }

  updated[index].isRunning = false;
  setBlocks([...updated]);

  setCancelSignal((prev) => {
    const newSignal = { ...prev };
    delete newSignal[index];
    return newSignal;
  });
};

  const hasContent = (block) =>
  block.type === "comment" || !!block?.content?.trim();

  const handleImageUpload = (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      updateBlock(index, event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    const reordered = [...blocks];
    const [removed] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, removed);
    setBlocks(reordered);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateBlock(index, event.target.result);
        setDragOverIndex(null);
      };
      reader.readAsDataURL(file);
    } else {
      setDragOverIndex(null);
    }
  };

const runAllBlocks = async () => {
  setIsRunningAll(true);

  // Başlangıçta sadece kod bloklarını pending yap
  let updated = blocks.map((blk) => ({
    ...blk,
    isPending: blk.type === "code" && blk.content.trim() !== "",
  }));
  setBlocks(updated);

  let isCancelled = false;

  // Döngüde hem comment hem code bloklarını inline işle
  for (let i = 0; i < updated.length; i++) {
    const blk = updated[i];

    // Comment bloğu: inline çalıştır
    if (blk.type === "comment") {
      updated[i] = {
        ...blk,
        isExecuted: true,
        contentChangedSinceExecution: false,
        isEditing: false,
        isPending: false,
      };
      continue;
    }

    // Code bloğu: orijinal mantığı koru
    if (blk.type === "code" && blk.content.trim() !== "") {
      if (isCancelled) break;

      // AbortController ve spinner
      const controller = new AbortController();
      setCancelSignal((prev) => ({ ...prev, [i]: controller }));

      updated[i] = {
        ...updated[i],
        isPending: false,
        isRunning: true,
        isExecuted: false,
        images: [], // önceki koşudan kalan görselleri temizle
      };
      setBlocks([...updated]);

      const startTime = Date.now();
      const cumulativeCode = getCumulativeCode(updated, i);
      const fullCode = cumulativeCode + blk.content;

      try {
         const res = await fetch(`${BACKEND_URL}/execute`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({
             code: fullCode,
             runtime,
             mem: selSize.mem,
             cpu: selSize.cpu,
             files: files
              .filter(f => f.data && f.status === "done")
              .map(f => ({ name: f.name, data: f.data }))
           }),
           signal: controller.signal,
         });

        const data = await res.json();
        let outputMsg = data.output || `Error: ${data.error || "Unknown error."}`;
        outputMsg = cleanTraceback(outputMsg);

        const definedVars = [];
        const currentVars = {};
        for (const line of blk.content.split("\n")) {
          const m = line.match(/^\s*([a-zA-Z_]\w*)\s*=\s*(.+)$/);
          if (m) currentVars[m[1]] = m[2].trim();
        }
        for (const varName in currentVars) {
          let previousValue = null;
          for (let j = i - 1; j >= 0; j--) {
            const prev = updated[j];
            if (prev.type === "code" && prev.isExecuted && prev.executedContent) {
              for (const pline of prev.executedContent.split("\n")) {
                const m2 = pline.match(new RegExp(`^\\s*${varName}\\s*=\\s*(.+)$`));
                if (m2) {
                  previousValue = m2[1].trim();
                  break;
                }
              }
            }
            if (previousValue !== null) break;
          }
          if (previousValue !== null && previousValue !== currentVars[varName]) {
            definedVars.push(`${varName} = ${previousValue} → ${currentVars[varName]}`);
          } else {
            definedVars.push(`${varName} = ${currentVars[varName]}`);
          }
        }
        if (definedVars.length > 0) {
          outputMsg += `\n\nDefined variables:\n` + definedVars.join("\n");
        }

        // Sonuçları kaydet
        updated[i] = {
          ...updated[i],
          images: Array.isArray(data.images) ? data.images : [],
          output: outputMsg,
          isExecuted: true,
          executedContent: blk.content,
          contentChangedSinceExecution: false,
        };
      } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        if (err.name === "AbortError") {
          updated[i].output = `⛔ Process stopped. Duration: ${duration} seconds`;
          updated[i].images = [];
          isCancelled = true;
          // iptal sonrası sonraki kod bloklarını da işaretle
          for (let j = i + 1; j < updated.length; j++) {
            if (updated[j].type === "code" && updated[j].content.trim() !== "") {
              updated[j] = {
                ...updated[j],
                isPending: false,
                output: "⛔ Not executed. Operation cancelled.",
                images: [],
                isExecuted: false,
              };
            }
          }
          break;
        } else {
          updated[i].output = "⚠️ Error: Unable to reach the server.";
          updated[i].images = [];
          updated[i].isExecuted = false;
        }
      }

      // Spinner’ı kapat
      updated[i] = { ...updated[i], isRunning: false };
      setBlocks([...updated]);

      // AbortController kaydını temizle
      setCancelSignal((prev) => {
        const next = { ...prev };
        delete next[i];
        return next;
      });
    }
  }

  // Döngü bitince tüm state’i tek seferde güncelle
  setBlocks(updated);
  setIsRunningAll(false);
};

  return (
   <div className={`notebook-container${filesPanelVisible ? " with-panel" : ""}`}>
      <div className="notebook-header">
        <div className="header-row">
          
     {/* ─── dosyalar paneli toggle butonu ─── */}
     <div className="header-files-icon">
       <button
         className="files-toggle-btn"
         onClick={toggleFilesPanel}
         title="Open/Close File Manager"
       >
         <Folder size={20} />
       </button>
     </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="title-input"
            placeholder="Untitled"
          />
          <div className="header-actions">

                    {/* Runtime dropdown */}
                    <div className="dropdown-wrap">
                      <button
                        className="runtime-btn"
                        onClick={() => setRuntimeOpen(o => !o)}
                        type="button"
                        title={`Runtime: ${currentRuntimeLabel}`}
                      >
                        <span>Runtime: {currentRuntimeLabel}</span>
                        <span>▼</span>
                      </button>

                      {runtimeOpen && (
                        <div className="dropdown-menu" onMouseLeave={() => setRuntimeOpen(false)}>
                          {RUNTIMES.map(r => (
                            <button
                              key={r.key}
                              className="dropdown-item"
                              onClick={() => { setRuntime(r.key); setRuntimeOpen(false); }}
                              title={r.desc}
                            >
                              {/* {r.label} */}
                              {r.menuLabel}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Resources dropdown */}
                          <div className="dropdown-wrap">
                            <button
                              className="runtime-btn-resource"
                              onClick={() => setSizeOpen(o => !o)}
                              type="button"
                              title={`Resources: ${selSize.label}`}
                            >
                              <span>Resources: {selSize.label.split(" ")[0]}</span>
                              <span>▼</span>
                            </button>
                            {sizeOpen && (
                              <div className="dropdown-menu" onMouseLeave={() => setSizeOpen(false)}>
                                {SIZES.map(s => (
                                  <button
                                    key={s.key}
                                    className="dropdown-item"
                                    onClick={() => { setSize(s.key); setSizeOpen(false); }}
                                    title={s.label}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
            <button
                className={`runall-button ${blocks.some(hasContent) ? "active" : ""}`}
                onClick={blocks.some(hasContent) && !isRunningAll ? runAllBlocks : undefined}
                disabled={!blocks.some(hasContent) || isRunningAll}
              >
                {isRunningAll ? <FaStop size={16} /> : <FaPlay size={16} />} Run All
              </button>
            <DownloadMenu
              blocks={blocks}
              title={title}
            />
          </div>
        </div>
      </div>
 <DragDropContext onDragEnd={handleDragEnd}>
  <Droppable droppableId="notebook">
    {function (provided) {
      let codeCounter = 0;
      let commentCounter = 0;

      // Sadece code bloklarını sayacak şekilde offset’ler
      const lineOffsets = [];
      let current = 0;

      blocks.forEach((blk) => {
       if (blk.type === "code") {
         // Bu code bloğu current’dan başlıyor
         lineOffsets.push(current);
         // Kaç satır varsa current’a ekle
         const lines = Math.max(1, blk.content.split("\n").length);
         current += lines;
       } else {
         // code değilse offset null (veya 0 olarak da kullanabilirsin)
         lineOffsets.push(null);
       }
     });

      return (
        <div
          className="notebook-content"
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          {blocks.length === 0 ? (
            <div className="hover-area always-visible">
              <div className="action-buttons">
                <button className="action-btn code-btn" onClick={() => addBlock(-1, "code")}>
                  <span style={{ fontSize: "16px" }}>{'</>'}</span>
                </button>
                <button className="action-btn image-btn" onClick={() => addBlock(-1, "image")}>
                  <ImageIcon size={16} />
                </button>
                <button className="action-btn comment-btn" onClick={() => addBlock(-1, "comment")}>
                  <MessageCircle size={16} />
                </button>
              </div>
            </div>
          ) : (
            blocks.map((block, index) => {
              const typePrefix = block.type === "comment" ? "c" : block.type === "code" ? "i" : null;
              const typeIndex =
                block.type === "comment"
                  ? ++commentCounter
                  : block.type === "code"
                  ? ++codeCounter
                  : null;

              return (
                <Draggable key={block.id} draggableId={block.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <div className="content-block">
                        {block.type === "image" ? (
                          <div
                            className={`image-content ${dragOverIndex === index ? "drag-over" : ""}`}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                          >
                            {block.content ? (
                              <img src={block.content} alt="uploaded" />
                            ) : (
                              <label className="empty-image" htmlFor={`img-${block.id}`}>
                                Click or Drop to add image
                              </label>
                            )}
                            <input
                              id={`img-${block.id}`}
                              type="file"
                              accept="image/*"
                              className="file-input"
                              onChange={(e) => handleImageUpload(e, index)}
                            />
                          </div>
                        ) : block.type === "code" ? (

                          <>
                          <CodeEditor
                            value={block.content}
                            onChange={(e) => updateBlock(index, e.target.value)}
                            startLine={lineOffsets[index] ?? 0}
                            onRun={() => runBlock(index)}
                          />
                               {block.type === "code" && (block.output !== undefined) && (
                                  <div className="output-block">
                                    <div className="output-tools">
                                      <span className="block-index">[o:{typeIndex}]</span>
                                  </div>
                                    <pre className="output-content">{block.output}</pre>
                                     {Array.isArray(block.images) && block.images.length > 0 && (
                                    <div className="plot-gallery">
                                      {block.images.map((src, i) => (
                                        <img key={i} src={src} alt={`plot-${i}`} className="plot-img" />
                                      ))}
                                    </div>
                                  )}
                                  </div>
                                )}

                          </>
                        ) : (
                               <CommentBlock
                                  value={block.content}
                                  onChange={(e) => {
                                    const updated = [...blocks];
                                    updated[index].content = e.target.value;
                                    setBlocks(updated);
                                  }}
                                  isExecuted={block.isExecuted}
                                  isEditing={block.isEditing}          
                                  onEditingChange={(isEd) => {         
                                    const updated = [...blocks];
                                    updated[index].isEditing = isEd;
                                    setBlocks(updated);
                                  }}
                                  onExecute={() => runBlock(index)}     
                                />
                        )}

                        <button className="delete-btn" onClick={() => deleteBlock(index)}>
                          <X size={14} />
                        </button>

                        <div className="block-tools">
                          {(block.type === "code" || block.type === "comment") && (

                        <button
                            className={`run-btn ${hasContent(block) ? "active" : ""}`}
                            onClick={
                              hasContent(block) && (!isRunningAll || block.isRunning)
                                ? () => runBlock(index)
                                : undefined
                            }
                            disabled={!hasContent(block) || (isRunningAll && !block.isRunning)}
                            style={{ position: "relative" }}
                          >
                            {(block.isRunning || block.isPending) && (
                              <span className="spin-border-overlay"></span>
                            )}
                            {block.isRunning ? <FaStop size={14} /> : <FaPlay size={14} />}
                        </button>

                          )}

                          {typePrefix && typeIndex && (
                            <span className="block-index">
                              [{typePrefix}:{typeIndex}]
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className={`hover-area ${
                          blocks.length === 1 && index === 0 ? "always-visible" : ""
                        }`}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {(hoveredIndex === index || (blocks.length === 1 && index === 0)) && (
                          <div className="action-buttons">
                            <button
                              className="action-btn code-btn"
                              onClick={() => addBlock(index, "code")}
                            >
                              <span style={{ fontSize: "16px" }}>{'</>'}</span>
                            </button>
                            <button
                              className="action-btn image-btn"
                              onClick={() => addBlock(index, "image")}
                            >
                              <ImageIcon size={16} />
                            </button>
                            <button
                              className="action-btn comment-btn"
                              onClick={() => addBlock(index, "comment")}
                            >
                              <MessageCircle size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Draggable>
              );
            })
          )}
          {provided.placeholder}
        </div>
      );
    }}
  </Droppable>
</DragDropContext>

    {/* ─── dosyalar paneli ─── */}
     <FilesPanel
       visible={filesPanelVisible}
       files={files}
       onFileUpload={handleFileUpload}
       onRemoveFile={removeFile} 
       onClose={() => setFilesPanelVisible(false)}
       maxSize={FILE_SIZE_LIMIT}
       totalBytes={totalBytes}        
       totalLimit={FILE_TOTAL_LIMIT} 
     />

    </div>
  );
}

export default Notebook;





























