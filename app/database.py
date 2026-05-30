import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

def get_app_dir():
    """Возвращает папку пользователя для БД приложения"""
    if os.name == 'nt':
        app_dir = os.path.join(os.environ.get('LOCALAPPDATA'), 'CashFlow')
    os.makedirs(app_dir, exist_ok=True)
    return app_dir

def get_db_path():
    """Определяет путь к БД на основе наличия папки проекта"""
    
    current_file = os.path.abspath(__file__)
    project_root = os.path.dirname(os.path.dirname(current_file))
    
    if os.path.exists(os.path.join(project_root, 'app')) or \
       os.path.exists(os.path.join(project_root, 'venv')) or \
       os.path.exists(os.path.join(project_root, '.git')):
        db_dir = os.path.join(project_root, 'data')
        os.makedirs(db_dir, exist_ok=True)
        return os.path.join(db_dir, 'cashflow.db')
    else:
        app_dir = get_app_dir()
        return os.path.join(app_dir, 'cashflow.db')

APP_DIR = get_app_dir()
DB_PATH = get_db_path()


engine = create_engine(
    f'sqlite:///{DB_PATH}',
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine)

class Base(DeclarativeBase):
    pass

def init_db():
    """Создаёт таблицы если их нет"""
    from app.models import Category, Account, Plan, Fact, Settings
    Base.metadata.create_all(engine)

init_db()
