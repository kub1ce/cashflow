from datetime import date
from sqlalchemy import and_

from app.database import SessionLocal
from app.models import Account, Fact


class ReconcileMixin:
    def reconcile_balance(self, data: dict) -> dict:
        """
        Сверяет баланс счёта добавляя корректирующую операцию.

        Args:
            data (dict): Словарь с actual_balance, calculated_balance,
                week_start, week_end.

        Returns:
            dict: {'success': bool, 'diff': float, 'action': str, 'error': str | None}
        """
        required = ['actual_balance', 'calculated_balance', 'week_start', 'week_end']
        for field in required:
            if field not in data:
                return {'success': False, 'error': f'Отсутствует поле: {field}'}

        try:
            date.fromisoformat(data['week_start'])
            date.fromisoformat(data['week_end'])
        except (ValueError, TypeError) as e:
            return {'success': False, 'error': f'Некорректный формат даты: {e}'}

        try:
            actual = float(data['actual_balance'])
            calculated = float(data['calculated_balance'])
        except (ValueError, TypeError):
            return {'success': False, 'error': 'Балансы должны быть числами'}

        db = SessionLocal()
        try:
            week_start = data['week_start']
            week_end = data['week_end']
            diff = actual - calculated

            account = db.query(Account).first()
            if not account:
                return {'success': False, 'error': 'Счёт не создан'}

            if abs(diff) < 0.01:
                return {'success': True, 'diff': 0, 'action': 'none'}

            if diff > 0:
                cat = self._get_or_create_system_category(
                    db, 'Незапланированные доходы', 'income', '#10b981'
                )
                db.query(Fact).filter(
                    and_(
                        Fact.category_id == cat.id,
                        Fact.week_start_date == week_start,
                        Fact.external_id == None,
                    )
                ).delete(synchronize_session=False)
                db.add(Fact(
                    account_id=account.id,
                    category_id=cat.id,
                    week_start_date=week_start,
                    week_end_date=week_end,
                    amount=diff,
                    date=self._today_local(),
                    comment='Сверка баланса',
                    external_id=None,
                ))
                action = 'income'
            else:
                cat = self._get_or_create_system_category(
                    db, 'Незапланированные расходы', 'expense', '#f43f5e'
                )
                db.query(Fact).filter(
                    and_(
                        Fact.category_id == cat.id,
                        Fact.week_start_date == week_start,
                        Fact.external_id == None,
                    )
                ).delete(synchronize_session=False)
                db.add(Fact(
                    account_id=account.id,
                    category_id=cat.id,
                    week_start_date=week_start,
                    week_end_date=week_end,
                    amount=abs(diff),
                    date=self._today_local(),
                    comment='Сверка баланса',
                    external_id=None,
                ))
                action = 'expense'

            db.commit()
            return {'success': True, 'diff': diff, 'action': action}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()
