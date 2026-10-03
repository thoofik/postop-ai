$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$python = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  $python = Join-Path $root "backend\.venv\bin\python.exe"
}
if (-not (Test-Path $python)) {
  Write-Error "Backend virtualenv is missing. Follow the setup steps in README.md."
}
$frontend = Join-Path $root "frontend"
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
  Write-Error "Frontend dependencies are missing. Run npm install inside frontend."
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; & '$python' -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontend'; npm run dev"
Write-Host "PostOp AI is starting."
Write-Host "On this PC: http://127.0.0.1:5173"
Write-Host "On your phone: use the Network URL from the frontend window."
