import webview
import os
import sys
import threading

from app.database import init_db, SessionLocal, APP_DIR
from app.models import Settings
from app.api import API


def get_frontend_dir() -> str:
    """
    При запуске через .exe — фронтенд упакован внутри,
    PyInstaller кладёт их в sys._MEIPASS.
    При разработке — папка frontend рядом с main.py.
    """
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'frontend')
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend')


def get_start_page() -> str:
    db = SessionLocal()
    try:
        settings = db.query(Settings).first()
        if not settings or not settings.planning_start_date:
            return 'wizard.html'
        return 'index.html'
    finally:
        db.close()


def main():
    # Инициализация БД
    init_db()

    frontend_dir = get_frontend_dir()
    start_page   = get_start_page()

    start_path = os.path.join(frontend_dir, start_page)
    start_url  = 'file:///' + start_path.replace('\\', '/')

    api = API()

    window = webview.create_window(
        title     = 'Cash Flow',
        url       = start_url,
        js_api    = api,
        width     = 1400,
        height    = 800,
        min_size  = (900, 600),
        maximized = True,
        frameless = True,
    )

    api.set_window(window)
    api.set_frontend_dir(frontend_dir)

    webview.start(debug=False)  # ! DEBUG HERE


if __name__ == '__main__':
    main()