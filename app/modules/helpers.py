from datetime import date, timedelta, datetime, timezone
import calendar
from sqlalchemy import and_

from app.models import Category, Plan, Fact, Account


class HelpersMixin:
    def _cat_to_dict(self, c) -> dict:
        """Преобразует объект категории в словарь."""
        return {
            'id': c.id,
            'name': c.name,
            'type': c.type,
            'color_code': c.color_code,
            'sort_order': c.sort_order,
            'is_custom': bool(c.is_custom),
        }

    def _upsert_plan(self, db, category_id: int, week_start_date: str,
                     week_end_date: str, amount: float) -> None:
        """Вставляет или обновляет план, удаляет если amount=0."""
        existing = db.query(Plan).filter(
            and_(
                Plan.category_id == category_id,
                Plan.week_start_date == week_start_date,
            )
        ).first()
        
        if amount == 0:
            if existing:
                db.delete(existing)
        else:
            if existing:
                existing.amount = amount
                existing.week_end_date = week_end_date
            else:
                db.add(Plan(
                    category_id=category_id,
                    week_start_date=week_start_date,
                    week_end_date=week_end_date,
                    amount=amount,
                ))

    def _upsert_fact(self, db, category_id: int, week_start_date: str,
                     week_end_date: str, amount: float, fact_date: str = None) -> None:
        """Вставляет или обновляет факт, удаляет если amount=0."""
        record_date = fact_date or self._today_local()

        existing = db.query(Fact).filter(
            and_(
                Fact.category_id == category_id,
                Fact.week_start_date == week_start_date,
                Fact.external_id == None,
            )
        ).first()

        a = db.query(Account).first()
        if not a:
            raise RuntimeError('Счёт не создан')

        if amount == 0:
            if existing:
                db.delete(existing)
        else:
            if existing:
                existing.amount = amount
                existing.week_end_date = week_end_date
                existing.date = record_date
            else:
                db.add(Fact(
                    account_id=a.id,
                    category_id=category_id,
                    week_start_date=week_start_date,
                    week_end_date=week_end_date,
                    amount=amount,
                    date=record_date,
                    comment=None,
                    external_id=None,
                ))

    def _last_day_of_month(self, year: int, month: int) -> int:
        """Возвращает количество дней в месяце."""
        return calendar.monthrange(year, month)[1]

    def _get_monday(self, date_str: str) -> date:
        """Возвращает дату понедельника для заданной даты."""
        d = date.fromisoformat(date_str)
        return d - timedelta(days=d.weekday())

    def _generate_weeks(self, start_str: str) -> list:
        """
        Генерирует 52 недели начиная с даты.

        Args:
            start_str (str): ISO дата начала периода.

        Returns:
            list: Список словарей с данными недель.
        """
        if not start_str:
            return []
        MONTHS_RU = {
            1: 'янв', 2: 'фев', 3: 'мар', 4: 'апр',
            5: 'май', 6: 'июн', 7: 'июл', 8: 'авг',
            9: 'сен', 10: 'окт', 11: 'ноя', 12: 'дек',
        }
        start = self._get_monday(start_str)
        weeks = []
        current = start

        for i in range(52):
            week_end = current + timedelta(days=6)
            label = (
                f"{current.day} {MONTHS_RU[current.month]}"
                f" – "
                f"{week_end.day} {MONTHS_RU[week_end.month]}"
            )
            weeks.append({
                'week_start': current.isoformat(),
                'week_end': week_end.isoformat(),
                'label': label,
                'week_number': i + 1,
            })
            current += timedelta(days=7)

        return weeks

    def _get_or_create_system_category(self, db, name: str, cat_type: str,
                                       color_code: str):
        """
        Получает или создаёт системную категорию.

        Args:
            db: SQLAlchemy session.
            name (str): Название категории.
            cat_type (str): Тип ('income' или 'expense').
            color_code (str): HEX код цвета.

        Returns:
            Category: Объект категории из БД.
        """
        cat = db.query(Category).filter(Category.name == name).first()
        if not cat:
            last = db.query(Category).filter(
                Category.type == cat_type
            ).order_by(Category.sort_order.desc()).first()
            next_order = (last.sort_order + 1) if last else 0
            cat = Category(
                name=name,
                type=cat_type,
                color_code=color_code,
                sort_order=next_order,
                is_custom=False,
            )
            db.add(cat)
            db.flush()
        return cat

    def _today_local(self) -> str:
        """Возвращает сегодняшнюю дату в локальном часовом поясе."""
        try:
            local_tz = datetime.now(timezone.utc).astimezone().tzinfo
            today = datetime.now(tz=local_tz).date()
        except Exception:
            today = date.today()
        return today.isoformat()
