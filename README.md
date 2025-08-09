# PYTHON-COMPILER — Lightweight Notebook-style Python Runner (Docker-isolated)

A Vite + React front-end and a Go (Gin) back-end that execute Python code **inside isolated Docker containers**. 

Write code cells, add Markdown comments and images, upload data files, choose a runtime (“Python”, “Base”, “ML”), and run one cell or **Run All**. Plots are captured automatically and shown inline.

---

## Live Demo

**Frontend/UI Demo**
The live deployment currently includes **only the UI** — backend runtimes and Docker-based execution are not active in this environment.

You can explore the interface, create/edit notebooks, and see simulated execution outputs (Demo Mode), but actual code execution is **disabled**.

🌐 Live UI: [python-notebook-compiler](https://python-notebook-compiler.vercel.app/)

--- 

## Table of Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Running the project](#Running-the-project)
- [Local dev](#local-dev)
- [How it works (execution flow)](#how-it-works-execution-flow)
- [Front-end overview](#front-end-overview)
- [Back-end overview](#back-end-overview)
- [Runtime images](#runtime-images)
- [API](#api)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Export / download](#export--download)
- [Environment variables](#environment-variables)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [License](#license)

--- 

## Highlights

- **Notebook-style blocks**: `code`, `comment (Markdown)`, and `image`. Drag & drop to reorder.

- **Execute**: Run a single cell or **Run All**. Cancel a running cell.

- **Clean output**: stdout/stderr with execution duration; noisy traceback frames (launcher/runpy/etc.) are filtered for readability.

- **Plot capture**: In `Base` and `ML` runtimes, `matplotlib` is patched so figures are saved and returned to the UI as inline PNGs.

- **Runtime selection**:

  - **Python** (3.11 slim)

  - **Base**: numpy, pandas, scipy, scikit-learn, matplotlib, seaborn, pillow, requests, bs4, lxml, pyarrow, openpyxl

  - **ML**: Base + xgboost, lightgbm

- **Resource** limits: Small/Medium/Large presets mapped to Docker `--memory` and `--cpus`.

- **Files panel**: Drag & drop or file picker, single-file and total quota indicators, toast notifications, remove files.

- **Export**s: Download as `.ipynb` (Jupyter compatible) or `.py` script. (PDF button present but disabled for now.)

- **Line numbers & highlighting**: Custom tokenizer for Python syntax highlighting.

- **Markdown comments**: Toolbar for heading/bold/italic/code/list/link, live preview, undo/redo.


---

## Architecture
```bash

Client (Vite/React)
  ├─ Notebook (block flow, Run/Run All, runtime & resources)
  ├─ CodeEditor (line numbers, Tab indent, Ctrl/Cmd+Enter)
  ├─ CommentBlock (Markdown + toolbar, live preview)
  ├─ FilesPanel (uploads, quotas, drag & drop, toasts)
  └─ DownloadMenu (.ipynb / .py)

Server (Go + Gin)
  ├─ POST /execute
  ├─ Validates size limits from base64 payloads
  ├─ Writes temp workspace (user code + uploaded files)
  ├─ Generates runner.py (matplotlib patch in Base/ML)
  ├─ Runs isolated Docker container (no network)
  └─ Returns combined output + captured plots (data URIs)

Runtimes (Docker)
  ├─ python:3.11-slim
  ├─ py-sandbox:base
  └─ py-sandbox:ml


```

**Data flow**: UI → `/execute` → temp dir on server → `runner.py` → `docker run` → output & `_plots/*.png` → UI.


---

## Tech stack

**Front-end**

- React 18 + Vite

-  Drag & drop: `@hello-pangea/dnd`

- Markdown: `react-markdown` + custom toolbar

- Icons: `lucide-react`, `react-icons`

- PDF export infra: `jspdf` (button currently disabled)

- Custom syntax highlighter (`highlight.js` in the repo) — rule-based tokenization (no external lib)

**Back-end**

- Go 1.23

- Gin web framework + CORS middleware

- Executes code via **Docker CLI** with strict isolation and resource caps

**Runtimes (Docker images)**

- `python:3.11-slim`

- `py-sandbox:base` → numpy, pandas, scipy, scikit-learn, matplotlib, seaborn, pillow, requests, bs4, lxml, pyarrow, openpyxl

- `py-sandbox:ml` → Base + xgboost, lightgbm


---

## Running the project








---

## License

<pre>

This software and its source code are proprietary and confidential.
No part of this project may be copied, modified, distributed, published,
or used in any form without the express written permission of the copyright holder.

Unauthorized use of this software, including commercial use, redistribution,
or modification, is strictly prohibited and may result in legal action.

For inquiries about licensing or usage, please contact
  
</pre>













