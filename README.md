# PostOp AI

PostOp AI is a prototype for checking a healing surgical wound from a photograph. A person enters a few surgery details, takes or uploads a photo, and the app returns a risk band, a highlighted region, a short written explanation, and a timeline of earlier checks.

It does not diagnose infection, prescribe medicine, or replace a surgical team. The bands **LOW**, **MODERATE**, and **HIGH** are screening labels for a care team to look at. They are not a confirmed infection.

## What a person does

1. Open the dashboard and start an assessment.
2. Enter a patient label, wound site, procedure, symptoms, and days after surgery. Those answers are stored with the photo. They are not fed into the image score.
3. Take or upload a wound photo. The API rejects a file that is unreadable, larger than 12 MB, or fails the quality check (size, blur, brightness, and surface detail).
4. The score runs. The screen shows the band, a probability, a confidence value, and a Grad-CAM heatmap of the region that influenced the score.
5. Qwen writes four short sections: what the model saw, why the band looks the way it does, a next step, and warning signs. It is told not to claim an infection is present.
6. Saving keeps the assessment. Later screens compare two saved photos, chart the scores, and open a printable report.

Swipe-to-hide on the assessment list only hides a card in that browser session. It does not delete the row from the database.

## How the pieces fit

```
Browser (Vite + React)
    |  /api and /media
    v
FastAPI
    |-- quality check
    |-- EfficientNet-B0 score + Grad-CAM     (models/wound_risk.pt)
    |-- Qwen2.5-VL-7B explanation            (models/Qwen2.5-VL-7B-Instruct)
    |-- SQLite assessments + photo files     (backend/data)
```

During local development, Vite proxies `/api` and `/media` to `http://127.0.0.1:8000`. The production build does not include that proxy.

## Technical stack, and why each part is here

| Piece | What it is | Why it is in the project |
| --- | --- | --- |
| React 19 + TypeScript | The screens | One app for the dashboard, the assessment wizard, results, history, trend, and report |
| Vite 6 | Dev server and production build | Fast local reload, and a static site that can be hosted on Vercel |
| Tailwind CSS 4 | Styling | The black and blue interface, without a separate CSS framework runtime |
| FastAPI + Uvicorn | HTTP API | Photo upload, scoring, explanations, compare, trend, and the report |
| Pillow + NumPy | Image handling | Decode the photo, resize it, and run the quality checks |
| PyTorch + torchvision | Model runtime | Runs EfficientNet and, on the GPU, Qwen |
| EfficientNet-B0 | Image score | A small vision network trained for this wound-risk task. It returns LOW, MODERATE, or HIGH plus an attention map. If `models/wound_risk.pt` is missing, the API falls back to a color score (redness against nearby skin, plus a yellow signal) so the screens still work |
| Grad-CAM | Heatmap | Shows which part of the photo the network used. People can see the region instead of only a number |
| Qwen2.5-VL-7B-Instruct (4-bit) | Written explanation | Turns the photo and the score into four plain-language sections. It is loaded from `models/Qwen2.5-VL-7B-Instruct` with bitsandbytes so it fits on a local NVIDIA GPU |
| SQLite | Saved assessments | One file, no separate database server. Photos sit beside it in `backend/data` |
| Browser `speechSynthesis` | Read aloud | Speaks the explanation on the result page. A matching voice must be installed for Hindi, Tamil, Telugu, Kannada, or Malayalam |

The interface can be switched to Hindi, Tamil, Telugu, Kannada, or Malayalam. The choice is stored in the browser. A new Qwen explanation is requested in that language. An explanation already saved stays in the language it was generated in until that result is opened again in another language. Risk band names stay in English.

## What is not in Git

These stay on the machine that runs the models. They are listed in `.gitignore`.

- `models/` — EfficientNet checkpoint and the Qwen weights (the Qwen folder is many gigabytes)
- `backend/.venv/` — the Python environment
- `backend/data/` — SQLite database and saved photographs
- `frontend/node_modules/` and `frontend/dist/`
- `SurgWound/` — the local dataset used while training; it is not required to run the app if `wound_risk.pt` is already present

## Run it locally

Use Windows Python, not an MSYS build. MSYS has no binary wheels for Pillow and NumPy.

The GPU build of PyTorch in `backend/requirements.txt` is pinned for CUDA 12.8 (`torch==2.11.0+cu128`). That matches an RTX 50-series card. Install PyTorch from the CUDA wheel index before the rest of the requirements if pip cannot see that build.

```powershell
cd D:\Hackathon
py -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
backend\.venv\Scripts\python -m pip install -r backend\requirements-gpu.txt
cd frontend
npm install
cd ..
.\start.ps1
```

- Site: http://127.0.0.1:5173
- API docs: http://127.0.0.1:8000/docs

`start.ps1` opens two windows: Uvicorn on port 8000, and the Vite dev server. On a phone, use the same Wi-Fi and the Network URL printed by Vite.

Set `POSTOP_DISABLE_MODEL=1` to force the color fallback and skip EfficientNet.

## Hosting

The website and the API are not the same kind of program.

- **Vercel** can host the frontend. In the Vercel project, set the root directory to `frontend`. The build is `npm run build` and the output is `dist`. `frontend/vercel.json` sends every path back to `index.html` so the app does not 404 on refresh.
- **Vercel cannot run this API.** EfficientNet can run on a CPU. Qwen2.5-VL-7B needs an NVIDIA GPU and the local weights folder, so a normal web host cannot load it.
- Anyone opening only the Vercel URL sees the interface. Photo scoring and the written explanation work when the browser can reach a running API. Locally that is the Vite proxy. For a public demo, this PC has to stay on, with a tunnel to port 8000, and the deployed site has to call that public API URL.

Repository: https://github.com/thoofik/postop-ai
