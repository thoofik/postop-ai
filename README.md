# PostOp AI

Phone flow for a post-operative wound check. Photograph the wound, screen the image, read a risk band, and keep a timeline you can show a care team.

This is a prototype. It is not a medical device and it does not diagnose infection.

## The 12 steps

| Step | What happens | Where it lives |
| --- | --- | --- |
| 1 | Open PostOp AI on the phone | `frontend` home screen |
| 2 | Capture wound photo | camera or photo library |
| 3 | Upload | `POST /api/quality` |
| 4 | Image quality check | `backend/app/pipeline/quality.py` |
| 5 | AI processing | `POST /api/assessments/{id}/run` |
| 6 | HIGH / MODERATE / LOW risk | `backend/app/pipeline/inference.py` |
| 7 | Probability and confidence | same scoring result |
| 8 | Grad-CAM explanation | `backend/app/pipeline/explain.py` |
| 9 | Save assessment | `POST /api/assessments/{id}/save` |
| 10 | Compare previous assessment | `GET /api/compare` |
| 11 | Risk trend chart | `GET /api/trend` |
| 12 | Assessment report | `GET /api/assessments/{id}/report` |

The score is a visual prototype: redness against nearby skin, plus a yellow drainage signal. The explanation map highlights the pixels that raised that score. Drop a trained model into `inference.py` and return the same result, including an attention map, to turn step 8 into clinical Grad-CAM. The phone flow stays the same.

## Run it

Use Windows Python, not the MSYS build. MSYS has no binary wheels for Pillow and NumPy.

```powershell
cd D:\Hackathon
& "$env:LOCALAPPDATA\Python\bin\python.exe" -m venv backend\.venv
backend\.venv\Scripts\python -m pip install -r backend\requirements.txt
cd frontend
npm install
cd ..
.\start.ps1
```

On this computer, open http://127.0.0.1:5173

On your phone, join the same Wi-Fi and open the Network URL printed in the frontend window. Tap **Open camera** to launch the phone camera. If the phone cannot connect, allow Python and Node through the private-network firewall.

API docs: http://127.0.0.1:8000/docs

## Try the timeline first

On the home screen, tap **Load sample timeline**. That builds three sample photographs for Demo patient, from a higher concern band toward a lower one. Open the newest row, then walk risk, explanation, compare, the chart, and the report.

Saved assessments and photographs stay in `backend/data`.
