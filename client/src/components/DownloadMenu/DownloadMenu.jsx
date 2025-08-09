import { useState } from "react";
import "./DownloadMenu.css"; 

const DownloadMenu = ({ blocks, title }) => {
  const [isOpen, setIsOpen] = useState(false);

  const fileTitle = title?.trim() === "" ? "Untitled" : title;

  
  const handleDownloadPy = () => {
    //  Her bloğu tek tek ele al: code ise ham kod, comment ise "# …"
    const pyContent = blocks
      .map((block) => {
        if (block.type === "code" && block.content.trim() !== "") {
          return block.content.trim();
        }
        if (block.type === "comment") {
          const text = block.content.trim() || "(boş yorum)";
          // her satırı '#' ile prefixle
          return text
            .split("\n")
            .map((line) => `# ${line}`)
            .join("\n");
        }
        // image blokları atla
        return null;
      })
      // null ya da boş stringleri filtrele
      .filter((part) => part != null && part !== "")
      // bloklar arası çift satır boşluk
      .join("\n\n");

    const blob = new Blob([pyContent], { type: "text/x-python" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileTitle}.py`;
    a.click();
  };

  const handleDownloadIpynb = () => {
    const notebook = {
      cells: blocks.map((block) => {
        if (block.type === "code") {
          return {
            cell_type: "code",
            source: block.content.split("\n"),
            metadata: {},
            outputs: block.output
              ? [
                  {
                    output_type: "stream",
                    name: "stdout",
                    text: block.output.split("\n"),
                  },
                ]
              : [],
            execution_count: block.isExecuted ? 1 : null,
          };
        } else {
          return {
            cell_type: "markdown",
            source: block.content.split("\n"),
            metadata: {},
          };
        }
      }),
      metadata: {},
      nbformat: 4,
      nbformat_minor: 2,
    };

    const blob = new Blob([JSON.stringify(notebook, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileTitle}.ipynb`;
    a.click();
  };

  const handleDownloadPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    let y = 20;
    let noteCounter = 1;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (block.type !== "image" && block.content) {
        doc.setFontSize(12);
        const prefix = `${noteCounter}. `;
        const lines = doc.splitTextToSize(prefix + block.content, 170);
        doc.text(lines, 20, y);
        y += lines.length * 7 + 10;
        noteCounter++;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      } else if (block.type === "image" && block.content) {
        await new Promise((resolve) => {
          const img = new Image();
          img.src = block.content;
          img.onload = () => {
            const maxWidth = 170;
            const ratio = img.width / img.height;
            let imgWidth = maxWidth;
            let imgHeight = maxWidth / ratio;
            if (imgHeight > 200) {
              imgHeight = 200;
              imgWidth = imgHeight * ratio;
            }
            if (y + imgHeight > 280) {
              doc.addPage();
              y = 20;
            }
            doc.addImage(img, "JPEG", 20, y, imgWidth, imgHeight);
            y += imgHeight + 10;
            resolve();
          };
        });
      }
    }

    doc.save(`${fileTitle}.pdf`);
  };

  return (
    <div className="download-menu-container">
      <button className="download-button" onClick={() => setIsOpen(!isOpen)}>
        Download ▼
      </button>
      {isOpen && (
        <div className="download-options">
          <button className="do-pdf" onClick={handleDownloadPDF} disabled>Download (.pdf)</button>
          <button onClick={handleDownloadIpynb}>Download Notebook (.ipynb)</button>
          <button onClick={handleDownloadPy}>Download Script (.py)</button>
        </div>
      )}
    </div>
  );
};

export default DownloadMenu;

