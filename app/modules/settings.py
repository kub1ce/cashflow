import json
from datetime import date

from app.database import SessionLocal
from app.models import Settings, Account, Category, Plan, Fact


class SettingsMixin:
    def save_wizard_data(self, data: dict) -> dict:
        """
        Сохраняет данные из мастера первого запуска.

        Args:
            data (dict): Словарь с ключами 'account', 'settings', 'categories'.

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
        db = SessionLocal()
        try:
            acc_data = data.get('account', {})
            account = Account(
                name=acc_data.get('name', 'Основной счёт'),
                initial_balance=float(acc_data.get('initial_balance', 0)),
            )
            db.add(account)

            s_data = data.get('settings', {})
            settings = Settings(
                planning_start_date=s_data.get('planning_start_date'),
                financial_strategy=s_data.get('financial_strategy', 'manual'),
                visual_config=json.dumps({
                    'weekColor': '#3b82f6',
                    'currentWeekColor': '#fef08a',
                    'negativeBalanceColor': '#f87171',
                    'totalIncomeColor': '#16a34a',
                    'totalExpenseColor': '#ef4444',
                }),
            )
            db.add(settings)

            for idx, cat in enumerate(data.get('categories', [])):
                db.add(Category(
                    name=cat.get('name'),
                    type=cat.get('type'),
                    color_code=cat.get('color_code', '#94a3b8'),
                    sort_order=idx,
                    is_custom=False,
                ))

            db.commit()
            return {'success': True}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def get_settings(self) -> dict:
        """
        Получает текущие настройки приложения.

        Returns:
            dict: Словарь с настройками или пустой словарь.
        """
        db = SessionLocal()
        try:
            s = db.query(Settings).first()
            if not s:
                return {}
            vc = json.loads(s.visual_config or '{}')
            return {
                'id': s.id,
                'planning_start_date': s.planning_start_date,
                'financial_strategy': s.financial_strategy,
                'visual_config': vc,
            }
        finally:
            db.close()

    def save_settings(self, data: dict) -> dict:
        """
        Сохраняет настройки приложения.

        Args:
            data (dict): Словарь с полями planning_start_date, financial_strategy,
                visual_config.

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
        db = SessionLocal()
        try:
            s = db.query(Settings).first()
            if not s:
                return {'success': False, 'error': 'Настройки не найдены'}

            if 'planning_start_date' in data:
                s.planning_start_date = data['planning_start_date']
            if 'financial_strategy' in data:
                s.financial_strategy = data['financial_strategy']
            if 'visual_config' in data:
                s.visual_config = json.dumps(data['visual_config'])

            db.commit()
            return {'success': True}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def reset_period(self, data: dict) -> dict:
        """
        Начинает новый период планирования.
        Очищает все Plan и Fact записи, обновляет дату начала.
        Категории, счёт и настройки - не трогает.
        """
        db = SessionLocal()
        try:
            new_start = data.get('new_start_date')
            if not new_start:
                return {'success': False, 'error': 'Не указана дата начала'}
            
            try:
                date.fromisoformat(new_start)
            except (ValueError, TypeError):
                return {'success': False, 'error': 'Некорректный формат даты'}

            s = db.query(Settings).first()
            if not s:
                return {'success': False, 'error': 'Настройки не найдены'}

            db.query(Plan).delete()
            db.query(Fact).delete()
            s.planning_start_date = new_start

            db.commit()
            return {'success': True}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()
