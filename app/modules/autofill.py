from datetime import date, timedelta
from sqlalchemy import and_

from app.database import SessionLocal
from app.models import Plan


class AutofillMixin:
    def autofill(self, data: dict) -> dict:
        """
        Автозаполняет планы на несколько периодов вперёд.

        Args:
            data (dict): Словарь с start_date, category_id, amount, count,
                mode ('weeks' или 'months'), day_of_month.

        Returns:
            dict: {'success': bool, 'filled': int | None, 'error': str | None}
        """
        db = SessionLocal()
        try:
            required = ['start_date', 'category_id', 'count', 'amount']
            for field in required:
                if field not in data:
                    return {'success': False, 'error': f'Не указано: {field}'}

            try:
                date.fromisoformat(data['start_date'])
            except (ValueError, TypeError):
                return {
                    'success': False,
                    'error': f'Некорректный формат даты: «{data["start_date"]}». Ожидается YYYY-MM-DD'
                }

            category_id = int(data['category_id'])
            start_date = data['start_date']
            amount = float(data['amount'])
            mode = data.get('mode', 'weeks')
            count = int(data['count'])
            day_of_month = int(data.get('day_of_month', 1))

            if count <= 0:
                return {'success': False, 'error': 'Количество должно быть > 0'}
            if amount < 0:
                return {'success': False, 'error': 'Сумма не может быть отрицательной'}
            if mode not in ('weeks', 'months'):
                return {'success': False, 'error': f'Неизвестный режим: «{mode}»'}

            target_dates = []

            if mode == 'weeks':
                week_start = self._get_monday(start_date)
                for i in range(count):
                    target_dates.append(week_start + timedelta(weeks=i))

            elif mode == 'months':
                start = date.fromisoformat(start_date)
                year = start.year
                month = start.month

                for i in range(count):
                    last_day = self._last_day_of_month(year, month)
                    actual_day = min(day_of_month, last_day)
                    target_dates.append(date(year, month, actual_day))

                    month += 1
                    if month > 12:
                        month = 1
                        year += 1

            week_amounts = {}
            for target_date in target_dates:
                monday = self._get_monday(target_date.isoformat())
                sunday = monday + timedelta(days=6)
                key = monday.isoformat()

                if key not in week_amounts:
                    week_amounts[key] = {
                        'week_start': monday.isoformat(),
                        'week_end': sunday.isoformat(),
                        'amount': 0,
                    }
                week_amounts[key]['amount'] += amount

            filled = 0
            for wk in week_amounts.values():
                self._upsert_plan(
                    db,
                    category_id,
                    wk['week_start'],
                    wk['week_end'],
                    wk['amount'],
                )
                filled += 1

            db.commit()
            return {'success': True, 'filled': filled}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def undo_autofill(self, data: dict) -> dict:
        """
        Отменяет автозаполнение удаляя все созданные планы.

        Args:
            data (dict): Словарь с start_date, category_id, count, mode, day_of_month.

        Returns:
            dict: {'success': bool, 'deleted': int | None, 'error': str | None}
        """
        db = SessionLocal()
        try:
            required = ['start_date', 'category_id', 'count']
            for field in required:
                if field not in data:
                    return {'success': False, 'error': f'Не указано: {field}'}

            try:
                date.fromisoformat(data['start_date'])
            except (ValueError, TypeError):
                return {
                    'success': False,
                    'error': f'Некорректный формат даты: «{data["start_date"]}». Ожидается YYYY-MM-DD'
                }

            category_id = int(data['category_id'])
            start_date = data['start_date']
            mode = data.get('mode', 'weeks')
            count = int(data['count'])
            day_of_month = int(data.get('day_of_month', 1))

            if count <= 0:
                return {'success': False, 'error': 'Количество должно быть > 0'}
            if mode not in ('weeks', 'months'):
                return {'success': False, 'error': f'Неизвестный режим: «{mode}»'}

            target_dates = []

            if mode == 'weeks':
                week_start = self._get_monday(start_date)
                for i in range(count):
                    target_dates.append(week_start + timedelta(weeks=i))

            elif mode == 'months':
                start = date.fromisoformat(start_date)
                year = start.year
                month = start.month

                for i in range(count):
                    last_day = self._last_day_of_month(year, month)
                    actual_day = min(day_of_month, last_day)
                    target_dates.append(date(year, month, actual_day))

                    month += 1
                    if month > 12:
                        month = 1
                        year += 1

            week_starts = set()
            for target_date in target_dates:
                monday = self._get_monday(target_date.isoformat())
                week_starts.add(monday.isoformat())

            deleted_count = 0
            for ws in week_starts:
                plan = db.query(Plan).filter(
                    and_(
                        Plan.category_id == category_id,
                        Plan.week_start_date == ws,
                    )
                ).first()
                if plan:
                    db.delete(plan)
                    deleted_count += 1

            db.commit()
            return {'success': True, 'deleted': deleted_count}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()
