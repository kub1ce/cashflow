from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, '..', 'cashflow.db')

engine = create_engine(
    f'sqlite:///{os.path.normpath(DB_PATH)}',
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
    """
    Накатывает изменения схемы для существующих БД.
    SQLite не поддерживает DROP COLUMN / ALTER COLUMN —
    добавляем только новые колонки если их нет.
    """
    with engine.connect() as conn:

        try:
            conn.execute(text(
                "ALTER TABLE categories ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 1"
            ))
            conn.commit()
        except Exception:
            pass
