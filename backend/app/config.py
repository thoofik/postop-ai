import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("POSTOP_DATA", BASE_DIR / "data"))
MEDIA_DIR = DATA_DIR / "media"
DB_PATH = DATA_DIR / "postop.db"


def ensure_dirs() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
