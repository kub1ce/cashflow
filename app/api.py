import os
import json
from datetime import date, timedelta

from sqlalchemy import and_

from app.database import SessionLocal
from app.models import Settings, Account, Category, Plan, Fact


class API:

    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    # ── Навигация ──────────────────────────────────────────────────────────────
    def navigate_to(self, page: str):
        frontend_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), '..', 'frontend'
        )
        path = os.path.normpath(os.path.join(frontend_dir, page))
        self._window.load_url(path)

    # ── Мастер ────────────────────────────────────────────────────────────────
    def save_wizard_data(self, data: dict) -> dict:
        db = SessionLocal()
        try:
            account_data = data.get('account', {})
            account = Account(
                name=account_data.get('name', 'Основной счёт'),
                type=account_data.get('type', 'cash'),
                initial_balance=float(account_data.get('initial_balance', 0)),
            )
            db.add(account)

            settings_data = data.get('settings', {})
            settings = Settings(
                planning_start_date=settings_data.get('planning_start_date'),
                planning_end_date=settings_data.get('planning_end_date'),
                financial_strategy=settings_data.get('financial_strategy', 'manual'),
                visual_config=json.dumps({}),
            )
            db.add(settings)

            categories_data = data.get('categories', [])
            for idx, cat in enumerate(categories_data):
                category = Category(
                    name=cat.get('name'),
                    type=cat.get('type'),
                    color_code=cat.get('color_code', '#94a3b8'),
                    sort_order=idx,
                )
                db.add(category)

            db.commit()
            return {'success': True}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    # ── Настройки ─────────────────────────────────────────────────────────────
    def get_settings(self) -> dict:
        db = SessionLocal()
        try:
            settings = db.query(Settings).first()
            if not settings:
                return {}
            return {
                'id':                  settings.id,
                'planning_start_date': settings.planning_start_date,
                'planning_end_date':   settings.planning_end_date,
                'financial_strategy':  settings.financial_strategy,
                'visual_config':       json.loads(settings.visual_config or '{}'),
            }
        finally:
            db.close()

    # ── Категории ─────────────────────────────────────────────────────────────
    def get_categories(self) -> list:
        db = SessionLocal()
        try:
            cats = db.query(Category).order_by(Category.sort_order).all()
            return [
                {
                    'id':         c.id,
                    'name':       c.name,
                    'type':       c.type,
                    'color_code': c.color_code,
                    'sort_order': c.sort_order,
                }
                for c in cats
            ]
        finally:
            db.close()

    # ── Счета ─────────────────────────────────────────────────────────────────
    def get_accounts(self) -> list:
        db = SessionLocal()
        try:
            accounts = db.query(Account).all()
            return [
                {
                    'id':              a.id,
                    'name':            a.name,
                    'type':            a.type,
                    'initial_balance': a.initial_balance,
                }
                for a in accounts
            ]
        finally:
            db.close()

    # ── Главный метод: все данные для таблицы ─────────────────────────────────
    def get_cashflow_data(self) -> dict:
        db = SessionLocal()
        try:
            settings = db.query(Settings).first()
            if not settings or not settings.planning_start_date:
                return {'error': 'no_settings'}

            weeks = self._generate_weeks(
                settings.planning_start_date,
                settings.planning_end_date,
            )

            cats = db.query(Category).order_by(Category.sort_order).all()
            categories = [
                {
                    'id':         c.id,
                    'name':       c.name,
                    'type':       c.type,
                    'color_code': c.color_code,
                    'sort_order': c.sort_order,
                }
                for c in cats
            ]

            plans_raw = db.query(Plan).all()
            plans = {}
            for p in plans_raw:
                key = f"{p.category_id}:{p.week_start_date}"
                plans[key] = {
                    'id':     p.id,
                    'amount': p.amount,
                }

            facts_raw = db.query(Fact).all()
            facts = {}
            for f in facts_raw:
                key = f"{f.category_id}:{f.week_start_date}"
                if key not in facts:
                    facts[key] = []
                facts[key].append({
                    'id':      f.id,
                    'amount':  f.amount,
                    'date':    f.date,
                    'comment': f.comment,
                })

            account = db.query(Account).first()
            initial_balance = account.initial_balance if account else 0.0

            return {
                'weeks':           weeks,
                'categories':      categories,
                'plans':           plans,
                'facts':           facts,
                'initial_balance': initial_balance,
                'settings': {
                    'financial_strategy':  settings.financial_strategy,
                    'planning_start_date': settings.planning_start_date,
                    'planning_end_date':   settings.planning_end_date,
                },
            }

        finally:
            db.close()

    # ── Сохранение ячейки (план или факт) ─────────────────────────────────────
    def save_cell(self, data: dict) -> dict:
        """
        Сохраняет значение ячейки таблицы.

        Ожидаемый data:
        {
            "category_id":     1,
            "week_start_date": "2025-01-06",
            "week_end_date":   "2025-01-12",
            "amount":          5000.0,
            "mode":            "plan"   # "plan" | "fact"
        }

        Логика:
        - mode == "plan": upsert в таблицу plans
        - mode == "fact": upsert в таблицу facts
        - amount == 0: удаляем запись (очистка ячейки)
        """
        db = SessionLocal()
        try:
            category_id     = int(data['category_id'])
            week_start_date = data['week_start_date']
            week_end_date   = data['week_end_date']
            amount          = float(data.get('amount', 0))
            mode            = data.get('mode', 'plan')

            if mode == 'plan':
                self._upsert_plan(db, category_id, week_start_date, week_end_date, amount)
            else:
                self._upsert_fact(db, category_id, week_start_date, week_end_date, amount)

            db.commit()
            return {'success': True}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def _upsert_plan(self, db, category_id, week_start_date, week_end_date, amount):
        """Создаёт или обновляет плановую запись. При amount==0 удаляет."""
        existing = db.query(Plan).filter(
            and_(
                Plan.category_id     == category_id,
                Plan.week_start_date == week_start_date,
            )
        ).first()

        if amount == 0:
            # Очистка: удаляем если есть
            if existing:
                db.delete(existing)
        else:
            if existing:
                existing.amount       = amount
                existing.week_end_date = week_end_date
            else:
                db.add(Plan(
                    category_id     = category_id,
                    week_start_date = week_start_date,
                    week_end_date   = week_end_date,
                    amount          = amount,
                ))

    def _upsert_fact(self, db, category_id, week_start_date, week_end_date, amount):
        """
        Создаёт или обновляет фактическую запись.
        Логика: одна агрегированная запись факта на категорию+неделю
        (без external_id — это ручной ввод).
        При amount==0 удаляем.
        """
        # Ищем ручную запись (без external_id)
        existing = db.query(Fact).filter(
            and_(
                Fact.category_id     == category_id,
                Fact.week_start_date == week_start_date,
                Fact.external_id     == None,
            )
        ).first()

        # Получаем account_id
        account = db.query(Account).first()
        account_id = account.id if account else 1

        if amount == 0:
            if existing:
                db.delete(existing)
        else:
            today = date.today().isoformat()
            if existing:
                existing.amount       = amount
                existing.week_end_date = week_end_date
                existing.date         = today
            else:
                db.add(Fact(
                    account_id      = account_id,
                    category_id     = category_id,
                    week_start_date = week_start_date,
                    week_end_date   = week_end_date,
                    amount          = amount,
                    date            = today,
                    comment         = None,
                    external_id     = None,
                ))

    # ── Автозаполнение ────────────────────────────────────────────────────────
    def autofill(self, data: dict) -> dict:
        """
        Заполняет указанную сумму как "План" на несколько недель вперёд.

        Ожидаемый data:
        {
            "category_id":  1,
            "start_date":   "2025-01-06",   # любая дата — берём понедельник её недели
            "weeks_count":  12,
            "amount":       50000.0
        }
        """
        db = SessionLocal()
        try:
            category_id = int(data['category_id'])
            start_date  = data['start_date']
            weeks_count = int(data['weeks_count'])
            amount      = float(data['amount'])

            if weeks_count <= 0:
                return {'success': False, 'error': 'Количество недель должно быть > 0'}
            if amount < 0:
                return {'success': False, 'error': 'Сумма не может быть отрицательной'}

            # Приводим start_date к понедельнику
            week_start = self._get_monday(start_date)

            filled = 0
            for i in range(weeks_count):
                current_start = week_start + timedelta(weeks=i)
                current_end   = current_start + timedelta(days=6)

                self._upsert_plan(
                    db,
                    category_id,
                    current_start.isoformat(),
                    current_end.isoformat(),
                    amount,
                )
                filled += 1

            db.commit()
            return {'success': True, 'filled': filled}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    # ── Обновление порядка категорий (drag-and-drop) ───────────────────────────
    def update_category_order(self, ordered_ids: list) -> dict:
        """
        Принимает список id категорий в новом порядке,
        обновляет sort_order для каждой.
        """
        db = SessionLocal()
        try:
            for idx, cat_id in enumerate(ordered_ids):
                cat = db.query(Category).filter(Category.id == int(cat_id)).first()
                if cat:
                    cat.sort_order = idx
            db.commit()
            return {'success': True}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    # ── Вспомогательные методы ────────────────────────────────────────────────
    def _get_monday(self, date_str: str) -> date:
        """Возвращает понедельник недели для переданной даты"""
        d = date.fromisoformat(date_str)
        return d - timedelta(days=d.weekday())

    def _generate_weeks(self, start_str: str, end_str: str) -> list:
        MONTHS_RU = {
            1: 'янв', 2: 'фев', 3: 'мар', 4: 'апр',
            5: 'май', 6: 'июн', 7: 'июл', 8: 'авг',
            9: 'сен', 10: 'окт', 11: 'ноя', 12: 'дек',
        }

        start = date.fromisoformat(start_str)
        end   = date.fromisoformat(end_str)

        if start.weekday() != 0:
            start = start - timedelta(days=start.weekday())

        weeks = []
        current = start

        while current <= end:
            week_end = current + timedelta(days=6)

            label = (
                f"{current.day} {MONTHS_RU[current.month]}"
                f" – "
                f"{week_end.day} {MONTHS_RU[week_end.month]}"
            )

            current_year = date.today().year
            if current.year != current_year:
                label += f" {current.year}"

            weeks.append({
                'week_start': current.isoformat(),
                'week_end':   week_end.isoformat(),
                'label':      label,
            })

            current += timedelta(days=7)

        return weeks

    # ── Заглушки (следующие шаги) ─────────────────────────────────────────────
    

    # ── Кассовый разрыв ───────────────────────────────────────────────────────
    def handle_deficit(self, data: dict) -> dict:
        """
        Обрабатывает кассовый разрыв согласно стратегии.

        Ожидаемый data:
        {
            "week_start":    "2025-03-10",
            "week_end":      "2025-03-16",
            "deficit":       15000.0,
            "strategy":      "saving_first" | "credit_first",
            "return_date":   "2025-04-07"   # только для credit_first
        }

        Стратегия saving_first:
            → добавляем доходную запись в плане на сумму дефицита
              в категорию "Покрытие из копилки" (создаём если нет)

        Стратегия credit_first:
            → добавляем доходную запись в плане на сумму дефицита
              в категорию "Займ" (создаём если нет)
            → добавляем расходную запись в плане на return_date
              в категорию "Возврат займа" (создаём если нет)
        """
        db = SessionLocal()
        try:
            week_start  = data['week_start']
            week_end    = data['week_end']
            deficit     = float(data['deficit'])
            strategy    = data['strategy']
            return_date = data.get('return_date')

            if strategy == 'saving_first':
                # Получаем или создаём системную категорию
                cat = self._get_or_create_system_category(
                    db,
                    name='Покрытие из копилки',
                    cat_type='income',
                    color_code='#0ea5e9',
                )
                self._upsert_plan(db, cat.id, week_start, week_end, deficit)

            elif strategy == 'credit_first':
                if not return_date:
                    return {'success': False, 'error': 'Укажите дату возврата займа'}

                # 1. Займ: доход на текущей неделе
                loan_cat = self._get_or_create_system_category(
                    db,
                    name='Займ',
                    cat_type='income',
                    color_code='#f59e0b',
                )
                self._upsert_plan(db, loan_cat.id, week_start, week_end, deficit)

                # 2. Возврат займа: расход на неделе возврата
                return_monday = self._get_monday(return_date)
                return_sunday = return_monday + timedelta(days=6)

                return_cat = self._get_or_create_system_category(
                    db,
                    name='Возврат займа',
                    cat_type='expense',
                    color_code='#ef4444',
                )

                # Суммируем с уже существующим возвратом (может быть несколько займов)
                existing_return = db.query(Plan).filter(
                    and_(
                        Plan.category_id     == return_cat.id,
                        Plan.week_start_date == return_monday.isoformat(),
                    )
                ).first()

                if existing_return:
                    existing_return.amount += deficit
                else:
                    db.add(Plan(
                        category_id     = return_cat.id,
                        week_start_date = return_monday.isoformat(),
                        week_end_date   = return_sunday.isoformat(),
                        amount          = deficit,
                    ))

            else:
                return {'success': False, 'error': 'Неизвестная стратегия'}

            db.commit()
            return {'success': True}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def _get_or_create_system_category(
        self, db, name: str, cat_type: str, color_code: str
    ):
        """Возвращает системную категорию по имени или создаёт её"""
        cat = db.query(Category).filter(Category.name == name).first()
        if not cat:
            last = db.query(Category).filter(
                Category.type == cat_type
            ).order_by(Category.sort_order.desc()).first()
            next_order = (last.sort_order + 1) if last else 0

            cat = Category(
                name       = name,
                type       = cat_type,
                color_code = color_code,
                sort_order = next_order,
            )
            db.add(cat)
            db.flush()  # чтобы получить id без commit
        return cat

    # ── Сверка баланса ────────────────────────────────────────────────────────
    def reconcile_balance(self, data: dict) -> dict:
        """
        Сверяет фактический баланс с расчётным.

        Ожидаемый data:
        {
            "actual_balance":   125000.0,
            "calculated_balance": 118000.0,
            "week_start":       "2025-03-10",
            "week_end":         "2025-03-16"
        }

        Логика:
        - Если actual > calculated → создаём доход "Корректировка баланса"
        - Если actual < calculated → создаём расход "Корректировка баланса"
        - Разница проводится как факт в текущую неделю
        """
        db = SessionLocal()
        try:
            actual_balance     = float(data['actual_balance'])
            calculated_balance = float(data['calculated_balance'])
            week_start         = data['week_start']
            week_end           = data['week_end']

            diff = actual_balance - calculated_balance

            if abs(diff) < 0.01:
                return {'success': True, 'diff': 0, 'action': 'none'}

            if diff > 0:
                # Факт дохода: у нас больше денег чем считали
                cat = self._get_or_create_system_category(
                    db,
                    name='Корректировка баланса',
                    cat_type='income',
                    color_code='#8b5cf6',
                )
                self._upsert_fact(db, cat.id, week_start, week_end, diff)
                action = 'income'
            else:
                # Факт расхода: у нас меньше денег чем считали
                cat = self._get_or_create_system_category(
                    db,
                    name='Корректировка баланса',
                    cat_type='expense',
                    color_code='#8b5cf6',
                )
                self._upsert_fact(db, cat.id, week_start, week_end, abs(diff))
                action = 'expense'

            db.commit()
            return {
                'success': True,
                'diff':    diff,
                'action':  action,
            }

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    # ── Получить расчётный баланс на дату ─────────────────────────────────────
    def get_calculated_balance(self, week_start: str) -> dict:
        """
        Возвращает расчётный баланс нарастающим итогом до конца
        указанной недели (включительно).
        """
        db = SessionLocal()
        try:
            account = db.query(Account).first()
            balance = account.initial_balance if account else 0.0

            cats       = db.query(Category).all()
            income_ids = {c.id for c in cats if c.type == 'income'}
            expense_ids= {c.id for c in cats if c.type == 'expense'}

            settings = db.query(Settings).first()
            if not settings:
                return {'success': False, 'error': 'Нет настроек'}

            weeks = self._generate_weeks(
                settings.planning_start_date,
                settings.planning_end_date,
            )

            for week in weeks:
                ws = week['week_start']

                # Суммируем все факты и планы за неделю
                for cat_id in income_ids:
                    key_facts = db.query(Fact).filter(
                        and_(
                            Fact.category_id     == cat_id,
                            Fact.week_start_date == ws,
                        )
                    ).all()

                    if key_facts:
                        balance += sum(f.amount for f in key_facts)
                    else:
                        plan = db.query(Plan).filter(
                            and_(
                                Plan.category_id     == cat_id,
                                Plan.week_start_date == ws,
                            )
                        ).first()
                        if plan:
                            balance += plan.amount

                for cat_id in expense_ids:
                    key_facts = db.query(Fact).filter(
                        and_(
                            Fact.category_id     == cat_id,
                            Fact.week_start_date == ws,
                        )
                    ).all()

                    if key_facts:
                        balance -= sum(f.amount for f in key_facts)
                    else:
                        plan = db.query(Plan).filter(
                            and_(
                                Plan.category_id     == cat_id,
                                Plan.week_start_date == ws,
                            )
                        ).first()
                        if plan:
                            balance -= plan.amount

                # Останавливаемся на нужной неделе
                if ws == week_start:
                    break

            return {'success': True, 'balance': round(balance, 2)}

        except Exception as e:
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    # ── Вспомогательные методы ────────────────────────────────────────────────
    def _get_monday(self, date_str: str) -> date:
        d = date.fromisoformat(date_str)
        return d - timedelta(days=d.weekday())

    def _generate_weeks(self, start_str: str, end_str: str) -> list:
        MONTHS_RU = {
            1: 'янв', 2: 'фев', 3: 'мар', 4: 'апр',
            5: 'май', 6: 'июн', 7: 'июл', 8: 'авг',
            9: 'сен', 10: 'окт', 11: 'ноя', 12: 'дек',
        }

        start = date.fromisoformat(start_str)
        end   = date.fromisoformat(end_str)

        if start.weekday() != 0:
            start = start - timedelta(days=start.weekday())

        weeks   = []
        current = start

        while current <= end:
            week_end = current + timedelta(days=6)
            label = (
                f"{current.day} {MONTHS_RU[current.month]}"
                f" – "
                f"{week_end.day} {MONTHS_RU[week_end.month]}"
            )
            current_year = date.today().year
            if current.year != current_year:
                label += f" {current.year}"

            weeks.append({
                'week_start': current.isoformat(),
                'week_end':   week_end.isoformat(),
                'label':      label,
            })
            current += timedelta(days=7)

        return weeks