import webview
import os
import sys

from app.database import init_db, SessionLocal
from app.models import Settings
from app.api import API
from urllib.parse import urljoin
from urllib.request import pathname2url


def get_frontend_dir() -> str:
    """
    При запуске через .exe — фронтенд упакован внутри,
    PyInstaller кладёт их в sys._MEIPASS.
    При разработке — папка frontend рядом с main.py.
    """
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'frontend')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend')


def get_start_page(frontend_dir: str) -> tuple:
    db = SessionLocal()
    try:
        settings = db.query(Settings).first()

        # Если нет настроек или не выбран старт периода → wizard
        if not settings or not settings.planning_start_date:
            wizard_path = os.path.join(frontend_dir, 'wizard.html')
            if os.path.exists(wizard_path):
                return 'wizard.html', 'light'
            return 'index.html', 'light'
        
        # Читаем тему прямо из БД перед запуском окна
        theme = 'light'
        if settings.visual_config:
            vc = settings.visual_config
            # SQLAlchemy может вернуть dict или JSON-строку
            if isinstance(vc, str):
                import json
                try: vc = json.loads(vc)
                except: vc = {}
            if isinstance(vc, dict):
                theme = vc.get('theme', 'light')
                
        return 'index.html', theme
    finally:
        db.close()


def main():
    # Инициализация БД
    init_db()

    frontend_dir = get_frontend_dir()
    start_page, theme = get_start_page(frontend_dir)

    start_path = os.path.join(frontend_dir, start_page)
    start_url = urljoin('file:', pathname2url(start_path)) + f'#theme={theme}'

    api = API()

    window = webview.create_window(
        title     = 'Cash Flow',
        url       = start_url,
        js_api    = api,
        width     = 1400,
        height    = 800,
        min_size  = (900, 600),
        frameless = True,
        easy_drag = False,
        fullscreen= True,
        resizable = True,
    )

    api.set_window(window)
    api.set_frontend_dir(frontend_dir)
    webview.start(debug=False)  # ! DEBUG HERE


if __name__ == '__main__':
    main()