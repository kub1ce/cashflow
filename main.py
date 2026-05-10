import webview
import threading
import os

from app.database import init_db, SessionLocal
from app.models import Settings
from app.api import API


def get_start_url():
    """Определяем какую страницу показать при старте"""
    db = SessionLocal()
    try:
        settings = db.query(Settings).first()
        # Мастер — если нет настроек или не задан период
        if not settings or not settings.planning_start_date:
            return 'wizard.html'
        return 'index.html'
    finally:
        db.close()


def main():
    # Инициализация БД (создаём таблицы если нет)
    init_db()

    start_page = get_start_url()

    # Путь к frontend папке
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend')
    start_url = os.path.join(frontend_dir, start_page)

    api = API()

    window = webview.create_window(
        title='Cash Flow',
        url=start_url,
        js_api=api,           # JS сможет вызывать методы API через pywebview.api.*
        width=1400,
        height=800,
        min_size=(900, 600),
        frameless=False,      # Пока False, потом можно сделать кастомный titlebar
        easy_drag=False,
    )

    api.set_window(window)

    webview.start(debug=False) # ! DEBUG HERE


if __name__ == '__main__':
    main()