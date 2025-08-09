# PYTHON-COMPILER — Lightweight Notebook-style Python Runner (Docker-isolated)

A Vite + React front-end and a Go (Gin) back-end that execute Python code **inside isolated Docker containers**. 

Write code cells, add Markdown comments and images, upload data files, choose a runtime (“Python”, “Base”, “ML”), and run one cell or **Run All**. Plots are captured automatically and shown inline.

---

## Table of Contents

- [Highlights](#highlights)
- [Architecture](#architecture)
- [Directory structure](#directory-structure)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
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

## Highlights
Burada giriş bölümü var.

## Architecture
Kurulum talimatları burada.


Highlights
Notebook-style blocks: code, comment (Markdown), and image. Drag & drop to reorder.

Execute: Run a single cell or Run All. Cancel a running cell.

Clean output: stdout/stderr with execution duration; noisy traceback frames (launcher/runpy/etc.) are filtered for readability.

Plot capture: In Base and ML runtimes, matplotlib is patched so figures are saved and returned to the UI as inline PNGs.

Runtime selection:

Python (3.11 slim)

Base: numpy, pandas, scipy, scikit-learn, matplotlib, seaborn, pillow, requests, bs4, lxml, pyarrow, openpyxl

ML: Base + xgboost, lightgbm

Resource limits: Small/Medium/Large presets mapped to Docker --memory and --cpus.

Files panel: Drag & drop or file picker, single-file and total quota indicators, toast notifications, remove files.

Exports: Download as .ipynb (Jupyter compatible) or .py script. (PDF button present but disabled for now.)

Line numbers & highlighting: Custom tokenizer for Python syntax highlighting.

Markdown comments: Toolbar for heading/bold/italic/code/list/link, live preview, undo/redo.

Architecture
pgsql
Kopyala
Düzenle
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
Data flow: UI → /execute → temp dir on server → runner.py → docker run → output & _plots/*.png → UI.

Directory structure
bash
Kopyala
Düzenle
python-compiler/
├─ client/                     # Vite + React app
│  ├─ src/
│  │  ├─ components/
│  │  │  ├─ Notebook/
│  │  │  ├─ CodeEditor/
│  │  │  ├─ CommentBlock/
│  │  │  ├─ FilesPanel/
│  │  │  └─ DownloadMenu/
│  │  ├─ Highlighter/         # custom tokenizer-based syntax highlighter
│  │  └─ ...
│  └─ Dockerfile
├─ server/                     # Go (Gin) API
│  ├─ handlers/execute.go      # POST /execute
│  ├─ runtimes/
│  │  ├─ base/Dockerfile       # scientific Python stack
│  │  └─ ml/Dockerfile         # Base + xgboost, lightgbm
│  ├─ Dockerfile
│  └─ main.go
├─ docker-compose.yml
└─ data/                       # (optional) for persistence if needed
Tech stack
Front-end

React 18 + Vite

Drag & drop: @hello-pangea/dnd

Markdown: react-markdown + custom toolbar

Icons: lucide-react, react-icons

PDF export infra: jspdf (button currently disabled)

Custom syntax highlighter (highlight.js in the repo) — rule-based tokenization (no external lib)

Back-end

Go 1.23

Gin web framework + CORS middleware

Executes code via Docker CLI with strict isolation and resource caps

Runtimes (Docker images)

python:3.11-slim

py-sandbox:base → numpy, pandas, scipy, scikit-learn, matplotlib, seaborn, pillow, requests, bs4, lxml, pyarrow, openpyxl

py-sandbox:ml → Base + xgboost, lightgbm

Quick start
bash
Kopyala
Düzenle
# from the repo root
docker compose up --build
Front-end: http://localhost:5173

Back-end: http://localhost:8080

Compose builds the Base and ML images first, then brings up the server and client.

Local dev
Front-end (Vite dev server):

bash
Kopyala
Düzenle
cd client
npm i
npm run dev
# client/.env should contain:
# VITE_BACKEND_URL=http://localhost:8080
Back-end (Gin):

bash
Kopyala
Düzenle
cd server
go run main.go
The server must be able to talk to a running Docker daemon. On Linux you may need access to /var/run/docker.sock (user in the docker group). In Compose, the sock is mounted for you.

How it works (execution flow)
Request: The UI posts code, selected runtime, resource presets (mem, cpu), and optional files (Data URLs) to POST /execute.

Limits: The server calculates sizes without decoding (from base64 body length) and enforces:

SINGLE_FILE_LIMIT (per file)

TOTAL_UPLOAD_LIMIT (sum of all files in the request)

Workspace: A temp directory is created. Uploaded files are decoded and written; user code is saved as code_user.py.

Runner:

For Base/ML, runner.py sets MPLBACKEND=Agg, patches plt.show() to save figures into _plots/, and also saves remaining figures at the end.

For Python, a minimal runpy.run_path(...) launcher is used.

Docker: The server starts a throwaway container:

--network none (no internet access)

--memory <mem> and --cpus <cpu>

--pids-limit 50

-v <temp>:/code and -w /code

Response: Combined stdout/stderr and execution duration are returned. If plots exist, they are read from _plots/*.png, base64-encoded, and returned as data:image/png;base64,....
The UI displays text output + a gallery of plots.

State across cells: When running a single cell, the UI rebuilds a “cumulative code” prefix from previous successfully executed code cells (definitions, imports, assignments, blocks), so later cells see the state defined earlier—similar to a notebook session.

Traceback cleanup: Common launcher/runpy/importlib frames are filtered before rendering, so users see the meaningful part of the error.

Front-end overview
Notebook.jsx

Manages block list, drag & drop, titles, Run All, runtime & resource drop-downs, upload toggles.

Maintains per-cell run state (isRunning, isPending, isExecuted) and supports cancellation via AbortController.

File quotas: UI mirrors server defaults and shows a global progress bar.

CodeEditor

Textarea + overlaid highlighter. Global line numbering via startLine offset.

Shortcuts: Tab inserts two spaces; Ctrl/Cmd+Enter runs the cell.

CommentBlock

Undo/redo (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z), Tab indent, Ctrl/Cmd+Enter to “commit”.

Markdown toolbar: heading, bold/italic, code block, ordered/unordered lists, smart links with https:// normalization.

FilesPanel

Drag & drop area + multi-select input. Per-file status: reading → done/error. Toasts on completion/failure.

DownloadMenu

.ipynb: code cells become Jupyter code cells, comments become markdown cells, current text output is attached as a stream output.

.py: comment blocks are converted to # ... lines; blocks are separated by blank lines.

.pdf: groundwork in place using jspdf (button disabled for now).

Back-end overview
POST /execute (Gin)

Validates upload limits from base64 body length (no full decode required for checking).

Creates temp directory; writes uploaded files and code_user.py.

Generates runner.py depending on the selected runtime.

Builds and runs a Docker command with strict caps and --network none.

Returns:

json
Kopyala
Düzenle
{
  "output": "<stdout/stderr + duration>",
  "error": "<optional>",
  "images": ["data:image/png;base64,..."]
}
Runtime selection & caps

Runtime → Docker image: "python" → python:3.11-slim, "base" → py-sandbox:base, "ml" → py-sandbox:ml

Memory presets: 256m, 512m, 1g, 2g (validated and capped server-side)

CPU presets: 0.25, 0.5, 1.0, 2.0 (validated and capped server-side)

Runtime images
python:3.11-slim
Minimal runtime; no matplotlib (use Base/ML for plotting).

py-sandbox:base
Scientific stack: numpy pandas scipy scikit-learn matplotlib seaborn pillow requests beautifulsoup4 lxml pyarrow openpyxl.

py-sandbox:ml
Base + xgboost lightgbm.

Images are built automatically by docker-compose.yml (builder services pybase and pyml).

API
POST /execute
Request body

json
Kopyala
Düzenle
{
  "code": "print('hello')",
  "files": [{ "name": "data.csv", "data": "data:text/csv;base64,AAAA..." }],
  "runtime": "python | base | ml",
  "mem": "256m | 512m | 1g | 2g",
  "cpu": "0.25 | 0.5 | 1.0 | 2.0"
}
Response

json
Kopyala
Düzenle
{
  "output": "Cell ran successfully.\nDuration: 0.42 seconds",
  "error": "",
  "images": ["data:image/png;base64,..."]
}
Keyboard shortcuts
Code cell: Ctrl/Cmd + Enter → run • Tab → insert two spaces

Comment (Markdown) cell: Ctrl/Cmd + Enter → commit/preview • Ctrl+Z / Ctrl+Y undo/redo • Tab indent

Export / download
Jupyter Notebook (.ipynb): code → code cell, comments → markdown cell, current text output → stream output.

Python Script (.py): comments are converted to # lines; blank lines between blocks.

PDF: button present but disabled (can be enabled later).

Environment variables
Front-end (client/.env)
VITE_BACKEND_URL — e.g. http://localhost:8080 (in Compose it’s http://server:8080)

Back-end (server/.env)
Upload limits

TOTAL_UPLOAD_LIMIT (bytes) — default: 50 * 1024 * 1024

SINGLE_FILE_LIMIT (bytes) — default: 5 * 1024 * 1024

Runtime fallback

PY_IMAGE — default Docker image when runtime is unknown; default python:3.11-slim

Resource defaults and caps

DEFAULT_MEM → one of 256m|512m|1g|2g (default 512m)

DEFAULT_CPU → one of 0.25|0.5|1.0|2.0 (default 0.5)

MAX_MEM (default 2g)

MAX_CPU (default 2.0)

The server validates the values and caps them; out-of-range inputs fall back to safe defaults.

Security notes
Code runs in a throwaway Docker container with:

No network (--network none)

CPU/RAM limits (--cpus, --memory)

Process limit (--pids-limit 50)

A fresh temp workspace is created per request and deleted afterward.

Because the server talks to the Docker daemon (via a mounted socket in Compose), deploy this in trusted environments only.

Troubleshooting
“Docker is not running. Please start Docker Desktop.”
Start Docker Desktop / Docker daemon.

Permission errors on Linux
Ensure your user has access to /var/run/docker.sock (add to docker group, re-login).

WSL2/Windows
Use Docker Desktop with WSL2 backend enabled.

No plots displayed
Select Base or ML runtime (the plain Python runtime doesn’t include matplotlib).

Upload limit exceeded
Adjust SINGLE_FILE_LIMIT and TOTAL_UPLOAD_LIMIT on the server, and UI env mirrors (VITE_*) if desired.

Roadmap
 Enable PDF export

 Variable inspector / session view

 Cell dependency graph

 Additional runtimes (R/JS)

 Persistent user workspace

License
TBD.

Want me to add a badges row, a Contributing section, or drop in a ready-to-use screenshot/GIF placeholder directory with filenames referenced in the README?








Şunu dedin:
bu nedir TBD.


ChatGPT:
“TBD” = To Be Determined yani henüz belirlenmedi.

README’de lisans kısmına TBD yazmamın sebebi, projenin hangi lisansla paylaşılacağına senin karar vermeni bekliyor olmam.
Örneğin:

MIT License → çok serbest, “kullan, değiştir, dağıt” tek şart attribution

Apache 2.0 → MIT gibi ama patent hakları ek koruma

GPL v3 → türev çalışmalar da açık kaynak olmak zorunda

Proprietary/Closed source → kod tamamen kapalı tutulur

Sen lisansını seçince, README’nin “License” bölümüne örneğin şöyle ekleyebiliriz:

md
Kopyala
Düzenle

## License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
İstersen sana projenin hedeflerine göre en uygun lisans seçimini de yapabilirim.








































## License
