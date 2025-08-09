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

> Prereqs: **Docker Desktop running** (Windows/macOS) or Docker daemon (Linux).  
> Optional for local dev: **Node 18+**, **Go 1.23+**.


### 1) Run with Docker

####  First-time setup (clean machine)

Use this when you have **no images/containers/volumes yet** (e.g., after a full clean).

1. **Go to the project folder**
```powershell
cd "C:\Users\<USERNAME>\OneDrive\Desktop\python-notebook-compiler"
```

2. **Build the Python Base image**
```powershell
docker compose build pybase
```
> Contains Python 3.11 + scientific libs (numpy, pandas, matplotlib, …).

3. **Build the Python ML image**
```powershell
docker compose build pyml
```
> Builds on top of **Base** (adds xgboost, lightgbm).

4. **Build the remaining services**
```powershell
docker compose build
```
> Builds server, client (and nginx base) images.

5. **Start everything (detached)**
 ```powershell
docker compose up -d
```  

6. **(Optional) Verify containers are up**
 ```powershell
docker ps
```  
> You should see all services in Up state.

**Default endpoints**

- Frontend → http://localhost:5173
- Backend → http://localhost:8080


#### Normal start (images already exist)

1. **Go to the project folder**
```powershell
cd "C:\Users\<USERNAME>\OneDrive\Desktop\python-notebook-compiler"
```

2. **Start services**
```powershell
docker compose up -d
```

If you changed code and need a rebuild for specific services:
```powershell
docker compose build client
docker compose build server
docker compose up -d
```
> docker compose build client: changes on the client side.  
> docker compose build server: changes on the server side.  
> Tip: docker compose up --build -d also works to rebuild what’s needed automatically.  



### 2) Run locally (without Docker)

**Important — build Docker runtimes at least once**  

- If you plan to use the **Base/ML** runtimes, you must first build the Docker images (see **1) Run with Docker → First-time setup**) so those images exist.  
- Local mode does **not** include those Python environments unless you install the dependencies yourself; use the plain **Python** runtime locally otherwise.  


#### First-time local setup

1. **Server (Go/Gin**
```powershell
cd server
go mod tidy
go run main.go
```

2. **Client (Vite/React) — open a new terminal:**
```powershell
cd client
npm install
npm run dev
```

> Make sure client/.env contains:
```powershell
VITE_BACKEND_URL=http://localhost:8080
VITE_TOTAL_UPLOAD_LIMIT=52428800
VITE_SINGLE_FILE_LIMIT=5242880
```

####  Normal local start

1. **Server**
```powershell
cd server
go run main.go
```

2. Client
```powershell
cd client
npm run dev
```


### Notes & gotchas

- **Docker Desktop must be running** before any `docker compose` commands.

- If `docker compose build pyml` fails, you likely haven’t built **pybase** first. Run:

```powershell
docker compose build pybase
docker compose build pyml
```

- If you deleted images, you must rebuild **Base** and **ML** again.

- If you delete **volumes**, any data stored there will be lost. (This project doesn’t ship a DB by default, but the warning applies if you add one.)

- **Windows/macOS vs Linux**:
Commands are the same; on Linux ensure your user has access to `/var/run/docker.sock` (add user to the `docker` group and re-login).

- **Ports**: 5173 (frontend), 8080 (backend). Adjust if they clash with other services on your machine.

---

## How it works (execution flow)

1. **Request**: The UI posts `code`, selected `runtime`, resource presets (`mem`, `cpu`), and optional `files` (Data URLs) to `POST /execute`.

2. **Limits**: The server calculates sizes without decoding (from base64 body length) and enforces:

      - `SINGLE_FILE_LIMIT` (per file)

      - `TOTAL_UPLOAD_LIMIT` (sum of all files in the request)
  
3. **Workspace**: A temp directory is created. Uploaded files are decoded and written; user code is saved as `code_user.py`.

4. **Runner**:

      - For `Base/ML`, `runner.py` sets `MPLBACKEND=Agg`, patches `plt.show()` to save figures into `_plots/`, and also saves remaining figures at the end.

      - For `Python`, a minimal `runpy.run_path(...)` launcher is used.

5. **Docker**: The server starts a throwaway container:

      - `--network none` (no internet access)

      - `--memory <mem>` and `--cpus <cpu>`

      - `--pids-limit 50`

      - `-v <temp>:/code` and `-w /code`

6. **Response**: Combined stdout/stderr and execution duration are returned. If plots exist, they are read from `_plots/*.png`, base64-encoded, and returned as `data:image/png;base64,....`
The UI displays text output + a gallery of plots.

**State across cells**: When running a single cell, the UI rebuilds a “cumulative code” prefix from **previous successfully executed code cells** (definitions, imports, assignments, blocks), so later cells see the state defined earlier, similar to a notebook session.

**Traceback cleanup**: Common launcher/runpy/importlib frames are filtered before rendering, so users see the meaningful part of the error.

---

## Front-end overview

- **Notebook.jsx**

    - Manages block list, drag & drop, titles, *Run All*, runtime & resource drop-downs, upload toggles.

    - Maintains per-cell run state (`isRunning`, `isPending`, `isExecuted`) and supports cancellation via `AbortController`.

    - File quotas: UI mirrors server defaults and shows a global progress bar.

- **CodeEditor**

    - Textarea + overlaid highlighter. Global line numbering via `startLine` offset.

    - Shortcuts: `Tab` inserts two spaces; **Ctrl/Cmd+Enter** runs the cell.

- **CommentBlock**

    - Undo/redo (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z), Tab indent, **Ctrl/Cmd+Enter** to “commit”.

    - Markdown toolbar: heading, bold/italic, code block, ordered/unordered lists, smart links with `https://` normalization.

- **FilesPanel**

    - Drag & drop area + multi-select input. Per-file status: `reading` → `done`/`error`. Toasts on completion/failure.

- **DownloadMenu**

    - `.ipynb`: code cells become Jupyter **code** cells, comments become **markdown** cells, current text output is attached as a `stream` output.

    - `.py`: comment blocks are converted to `# ...` lines; blocks are separated by blank lines.

    - `.pdf`: groundwork in place using `jspdf` (button disabled for now).


---

## Back-end overview

- `POST /execute` (Gin)

    - Validates upload limits from base64 body length (no full decode required for checking).
    
    - Creates temp directory; writes uploaded files and `code_user.py`.
    
    - Generates `runner.py` depending on the selected runtime.
    
    - Builds and runs a Docker command with strict caps and `--network none`.
    
    - Returns:

      ```powershell
      {
        "output": "<stdout/stderr + duration>",
        "error": "<optional>",
        "images": ["data:image/png;base64,..."]
      }
      ```

- **Runtime selection & caps**

    - Runtime → Docker image: `"python" → python:3.11-slim`, `"base" → py-sandbox:base`, `"ml" → py-sandbox:ml`
    
    - Memory presets: `256m`, `512m`, `1g` (validated and capped server-side)
    
    - CPU presets: `0.25`, `0.5`, `1.0` (validated and capped server-side)

---

## Runtime images

- `python:3.11-slim`

    Minimal runtime; **no matplotlib** (use Base/ML for plotting).

- `py-sandbox:base`

    Scientific stack: `numpy pandas scipy scikit-learn matplotlib seaborn pillow requests beautifulsoup4 lxml pyarrow openpyxl`.

- `py-sandbox:ml`

    Base + `xgboost lightgbm`.


Images are built automatically by `docker-compose.yml` (builder services `pybase` and `pyml`).


---

## API

`POST /execute`

**Request body**
 ```powershell
{
  "code": "print('hello')",
  "files": [{ "name": "data.csv", "data": "data:text/csv;base64,AAAA..." }],
  "runtime": "python | base | ml",
  "mem": "256m | 512m | 1g",
  "cpu": "0.25 | 0.5 | 1.0"
}
```

**Response**
```powershell
{
  "output": "Cell ran successfully.\nDuration: 0.42 seconds",
  "error": "",
  "images": ["data:image/png;base64,..."]
}

```

## Keyboard shortcuts

- **Code cell**: `Ctrl/Cmd + Enter` → run • `Tab` → insert two spaces

- **Comment (Markdown) cell**: `Ctrl/Cmd + Enter` → commit/preview • `Ctrl+Z / Ctrl+Y` undo/redo • `Tab` indent

---

## Export / download

- **Jupyter Notebook (`.ipynb`)**: code → code cell, comments → markdown cell, current text output → `stream` output.

- **Python Script (`.py`)**: comments are converted to `#` lines; blank lines between blocks.

- **PDF**: button present but disabled (can be enabled later).

---

## Environment variables


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













