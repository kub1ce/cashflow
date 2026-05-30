from app.modules.helpers import HelpersMixin
from app.modules.window import WindowMixin
from app.modules.settings import SettingsMixin
from app.modules.categories import CategoriesMixin
from app.modules.accounts import AccountsMixin
from app.modules.cashflow import CashflowMixin
from app.modules.transactions import TransactionsMixin
from app.modules.autofill import AutofillMixin
from app.modules.deficit import DeficitMixin
from app.modules.reconcile import ReconcileMixin
from app.modules.io import IOMixin


class API(
    HelpersMixin,
    WindowMixin,
    SettingsMixin,
    CategoriesMixin,
    AccountsMixin,
    CashflowMixin,
    TransactionsMixin,
    AutofillMixin,
    DeficitMixin,
    ReconcileMixin,
    IOMixin,
):
    """Основной API класс для управления финансовыми данными и операциями с окном."""

    def __init__(self):
        self._window = None
        self._frontend_dir = None
        self._hwnd = None

    def set_window(self, window):
        """Устанавливает объект окна для дальнейшей работы."""
        self._window = window

    def set_frontend_dir(self, frontend_dir: str):
        """Устанавливает директорию фронтенда."""
        self._frontend_dir = frontend_dir
