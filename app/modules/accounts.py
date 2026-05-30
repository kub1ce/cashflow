from app.database import SessionLocal
from app.models import Account


class AccountsMixin:
    def get_account(self) -> dict:
        """
        Получает данные счёта.

        Returns:
            dict: Словарь с id, name, initial_balance или пустой словарь.
        """
        db = SessionLocal()
        try:
            a = db.query(Account).first()
            if not a:
                return {}
            return {
                'id': a.id,
                'name': a.name,
                'initial_balance': a.initial_balance
            }
        finally:
            db.close()

    def update_account(self, data: dict) -> dict:
        """
        Обновляет данные счёта.

        Args:
            data (dict): Словарь с полями name, initial_balance.

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
        db = SessionLocal()
        try:
            a = db.query(Account).first()
            if not a:
                return {'success': False, 'error': 'Счёт не найден'}
            if 'name' in data:
                a.name = data['name']
            if 'initial_balance' in data:
                a.initial_balance = float(data['initial_balance'])
            db.commit()
            return {'success': True}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def get_account_name(self) -> dict:
        """
        Получает название счёта.

        Returns:
            dict: {'success': bool, 'name': str, 'error': str | None}
        """
        db = SessionLocal()
        try:
            a = db.query(Account).first()
            if not a:
                return {'success': False, 'error': 'Счёт не создан'}
            return {'success': True, 'name': a.name if a else ''}
        except Exception as e:
            return {'success': False, 'error': str(e)}
        finally:
            db.close()
