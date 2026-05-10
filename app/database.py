from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os
import sys


def get_app_dir() -> str:
    """
    Возвращает папку для хранения данных приложения.
    
    - При запуске через .exe (PyInstaller):
      C:\\Users\\Username\\AppData\\Local\\CashFlow\\
    
    - При запуске через python main.py (разработка):
      папка проекта (рядом с main.py)
    """
    if getattr(sys, 'frozen', False):
        # Запущено как .exe
        app_data = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
        app_dir  = os.path.join(app_data, 'CashFlow')
    else:
        # Запущено как скрипт (разработка)
        app_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    os.makedirs(app_dir, exist_ok=True)
    return app_dir


APP_DIR = get_app_dir()
DB_PATH = os.path.join(APP_DIR, 'cashflow.db')

engine = create_engine(
    f'sqlite:///{DB_PATH}',
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def init_db():
    """Создаёт все таблицы если их нет + накатывает миграции"""
    from app.models import Category, Account, Plan, Fact, Transfer, Settings
    Base.metadata.create_all(engine)
    _run_migrations()


def _run_migrations():
    """Накатывает изменения схемы для существующих БД"""
    with engine.connect() as conn:
        # Category.is_custom
        try:
            conn.execute(text(
                "ALTER TABLE categories ADD COLUMN "
                "is_custom INTEGER NOT NULL DEFAULT 1"
            ))
            conn.commit()
        except Exception:
            pass  # колонка уже есть