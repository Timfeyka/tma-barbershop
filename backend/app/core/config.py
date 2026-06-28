import os
from dotenv import load_dotenv

# Ищем .env в нескольких местах: CWD, директория файла, корень проекта
_env_loaded = False
_possible_env_paths = [
    os.path.join(os.getcwd(), ".env"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".env"),  # backend/
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".env"),  # project root
]
for _p in _possible_env_paths:
    _p = os.path.abspath(_p)
    if os.path.exists(_p):
        load_dotenv(_p)
        _env_loaded = True
        print(f"✅ .env загружен из: {_p}")
        break

if not _env_loaded:
    # Пробуем без пути — может сработать если CWD правильный
    load_dotenv()
    print("ℹ️  .env загружен из CWD (если найден)")

BOT_TOKEN = os.getenv("BOT_TOKEN", "")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/barber_db")
