import os
import json
from datetime import date, timedelta

from sqlalchemy import and_

from app.database import SessionLocal
from app.models import Settings, Account, Category, Plan, Fact

import webview

# Системные категории которые нельзя удалять
PROTECTED_CATEGORIES = {
    'Незапланированные расходы',
    'Незапланированные доходы',
    'Возврат займа',
    'Покрытие из копилки',
    'Займ',
}

class API:

    def __init__(self):
        self._window = None
        self._frontend_dir = None

    def set_window(self, window):
        self._window = window

    def set_frontend_dir(self, frontend_dir: str):
        self._frontend_dir = frontend_dir

    # ── Навигация ──────────────────────────────────────────────────────────────
    def navigate_to(self, page: str):
        path = os.path.normpath(os.path.join(self._frontend_dir, page))
        url  = 'file:///' + path.replace('\\', '/')
        # Запускаем в отдельном потоке чтобы не блокировать callback
        import threading
        threading.Timer(0.1, lambda: self._window.load_url(url)).start()
        return {'success': True}

    # ── Мастер первого запуска ─────────────────────────────────────────────────
    def save_wizard_data(self, data: dict) -> dict:
        """
        data = {
            account:    { name, initial_balance },
            settings:   { planning_start_date, financial_strategy },
            categories: [ { name, type, color_code } ]
        }
        """
        db = SessionLocal()
        try:
            # Счёт (без type)
            acc_data = data.get('account', {})
            account  = Account(
                name            = acc_data.get('name', 'Основной счёт'),
                initial_balance = float(acc_data.get('initial_balance', 0)),
            )
            db.add(account)

            # Настройки
            s_data   = data.get('settings', {})
            settings = Settings(
                planning_start_date = s_data.get('planning_start_date'),
                financial_strategy  = s_data.get('financial_strategy', 'manual'),
                visual_config       = json.dumps({
                    'weekColor':            '#3b82f6',
                    'currentWeekColor':     '#fef08a',
                    'negativeBalanceColor': '#f87171',
                    'totalIncomeColor':     '#16a34a',
                    'totalExpenseColor':    '#ef4444',
                }),
            )
            db.add(settings)

            # Категории
            for idx, cat in enumerate(data.get('categories', [])):
                db.add(Category(
                    name       = cat.get('name'),
                    type       = cat.get('type'),
                    color_code = cat.get('color_code', '#94a3b8'),
                    sort_order = idx,
                    is_custom  = False,   # дефолтные — не кастомные
                ))

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
            s = db.query(Settings).first()
            if not s:
                return {}
            vc = json.loads(s.visual_config or '{}')
            return {
                'id':                   s.id,
                'planning_start_date':  s.planning_start_date,
                'financial_strategy':   s.financial_strategy,
                'visual_config':        vc,
            }
        finally:
            db.close()

    def save_settings(self, data: dict) -> dict:
        """
        data = {
            planning_start_date: 'YYYY-MM-DD',
            financial_strategy:  'manual' | 'saving_first' | 'credit_first',
            visual_config: { weekColor, currentWeekColor, ... }
        }
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

    # ── Категории ─────────────────────────────────────────────────────────────
    def get_categories(self) -> list:
        db = SessionLocal()
        try:
            cats = db.query(Category).order_by(Category.sort_order).all()
            return [self._cat_to_dict(c) for c in cats]
        finally:
            db.close()

    def add_category(self, data: dict) -> dict:
        db = SessionLocal()
        try:
            last = db.query(Category).filter(
                Category.type == data.get('type')
            ).order_by(Category.sort_order.desc()).first()
            next_order = (last.sort_order + 1) if last else 0

            cat = Category(
                name       = data.get('name', 'Новая категория'),
                type       = data.get('type', 'expense'),
                color_code = data.get('color_code', '#94a3b8'),
                sort_order = next_order,
                is_custom  = True,
            )
            db.add(cat)
            db.commit()
            db.refresh(cat)
            return {'success': True, 'category': self._cat_to_dict(cat)}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def update_category(self, category_id: int, data: dict) -> dict:
        """Обновляет name и/или color_code категории"""
        db = SessionLocal()
        try:
            cat = db.query(Category).filter(
                Category.id == int(category_id)
            ).first()
            if not cat:
                return {'success': False, 'error': 'Категория не найдена'}

            if 'name' in data:
                cat.name = data['name']
            if 'color_code' in data:
                cat.color_code = data['color_code']

            db.commit()
            return {'success': True}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def delete_category(self, category_id: int) -> dict:
        db = SessionLocal()
        try:
            cat = db.query(Category).filter(
                Category.id == int(category_id)
            ).first()
            if not cat:
                return {'success': False, 'error': 'Категория не найдена'}

            # Защита системных категорий
            if cat.name in PROTECTED_CATEGORIES:
                return {
                    'success': False,
                    'error':   f'Категорию «{cat.name}» нельзя удалить, '
                            f'только переименовать'
                }

            db.query(Plan).filter(Plan.category_id == int(category_id)).delete()
            db.query(Fact).filter(Fact.category_id == int(category_id)).delete()
            db.delete(cat)
            db.commit()
            return {'success': True}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def update_category_order(self, ordered_ids: list) -> dict:
        db = SessionLocal()
        try:
            for idx, cat_id in enumerate(ordered_ids):
                cat = db.query(Category).filter(
                    Category.id == int(cat_id)
                ).first()
                if cat:
                    cat.sort_order = idx
            db.commit()
            return {'success': True}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def _cat_to_dict(self, c) -> dict:
        return {
            'id':         c.id,
            'name':       c.name,
            'type':       c.type,
            'color_code': c.color_code,
            'sort_order': c.sort_order,
            'is_custom':  bool(c.is_custom),
        }

    # ── Счёт ──────────────────────────────────────────────────────────────────
    def get_account(self) -> dict:
        db = SessionLocal()
        try:
            a = db.query(Account).first()
            if not a:
                return {}
            return {'id': a.id, 'name': a.name, 'initial_balance': a.initial_balance}
        finally:
            db.close()

    def update_account(self, data: dict) -> dict:
        """data = { name?, initial_balance? }"""
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

    # ── Главный метод: данные для таблицы ─────────────────────────────────────
    def get_cashflow_data(self) -> dict:
        db = SessionLocal()
        try:
            s = db.query(Settings).first()
            if not s or not s.planning_start_date:
                return {'error': 'no_settings'}

            weeks = self._generate_weeks(s.planning_start_date)

            cats = db.query(Category).order_by(Category.sort_order).all()
            categories = [self._cat_to_dict(c) for c in cats]

            plans_raw = db.query(Plan).all()
            plans = {}
            for p in plans_raw:
                key = f"{p.category_id}:{p.week_start_date}"
                plans[key] = {'id': p.id, 'amount': p.amount}

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

            a = db.query(Account).first()
            vc = json.loads(s.visual_config or '{}')

            return {
                'weeks':           weeks,
                'categories':      categories,
                'plans':           plans,
                'facts':           facts,
                'initial_balance': a.initial_balance if a else 0.0,
                'settings': {
                    'financial_strategy':   s.financial_strategy,
                    'planning_start_date':  s.planning_start_date,
                    'visual_config':        vc,
                },
            }
        finally:
            db.close()

    # ── Сохранение ячейки ─────────────────────────────────────────────────────
    def save_cell(self, data: dict) -> dict:
        """
        data = {
            category_id, week_start_date, week_end_date,
            amount, mode: 'plan'|'fact'
        }
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
        existing = db.query(Plan).filter(
            and_(
                Plan.category_id     == category_id,
                Plan.week_start_date == week_start_date,
            )
        ).first()
        if amount == 0:
            if existing:
                db.delete(existing)
        else:
            if existing:
                existing.amount        = amount
                existing.week_end_date = week_end_date
            else:
                db.add(Plan(
                    category_id     = category_id,
                    week_start_date = week_start_date,
                    week_end_date   = week_end_date,
                    amount          = amount,
                ))

    def _upsert_fact(self, db, category_id, week_start_date, week_end_date, amount):
        existing = db.query(Fact).filter(
            and_(
                Fact.category_id     == category_id,
                Fact.week_start_date == week_start_date,
                Fact.external_id     == None,
            )
        ).first()
        a          = db.query(Account).first()
        account_id = a.id if a else 1

        if amount == 0:
            if existing:
                db.delete(existing)
        else:
            today = date.today().isoformat()
            if existing:
                existing.amount        = amount
                existing.week_end_date = week_end_date
                existing.date          = today
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
        data = {
            category_id:  1,
            start_date:   'YYYY-MM-DD',
            amount:       50000,
            mode:         'weeks' | 'months',
            count:        6,        # кол-во недель ИЛИ месяцев
            day_of_month: 10,       # только для mode='months'
        }
        """
        db = SessionLocal()
        try:
            category_id  = int(data['category_id'])
            start_date   = data['start_date']
            amount       = float(data['amount'])
            mode         = data.get('mode', 'weeks')
            count        = int(data['count'])
            day_of_month = int(data.get('day_of_month', 1))

            if count <= 0:
                return {'success': False, 'error': 'Количество должно быть > 0'}
            if amount < 0:
                return {'success': False, 'error': 'Сумма не может быть отрицательной'}

            # Генерируем список дат для заполнения
            target_dates = []

            if mode == 'weeks':
                # Каждую неделю начиная с понедельника start_date
                week_start = self._get_monday(start_date)
                for i in range(count):
                    target_dates.append(week_start + timedelta(weeks=i))

            elif mode == 'months':
                # Каждый месяц в указанный день
                start = date.fromisoformat(start_date)
                year  = start.year
                month = start.month

                for i in range(count):
                    # Последний день месяца
                    if month == 12:
                        last_day = 31
                    else:
                        last_day = (date(year, month + 1, 1) - timedelta(days=1)).day

                    # Берём указанный день или последний если не существует
                    actual_day = min(day_of_month, last_day)
                    target_dates.append(date(year, month, actual_day))

                    # Следующий месяц
                    month += 1
                    if month > 12:
                        month = 1
                        year  += 1

            # Для каждой даты находим неделю и ставим план
            # Если несколько дат попали в одну неделю — суммируем
            week_amounts: dict = {}
            for target_date in target_dates:
                monday = self._get_monday(target_date.isoformat())
                sunday = monday + timedelta(days=6)
                key    = monday.isoformat()

                if key not in week_amounts:
                    week_amounts[key] = {
                        'week_start': monday.isoformat(),
                        'week_end':   sunday.isoformat(),
                        'amount':     0,
                    }
                week_amounts[key]['amount'] += amount

            # Сохраняем планы
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

    # ── Кассовый разрыв ───────────────────────────────────────────────────────
    def handle_deficit(self, data: dict) -> dict:
        db = SessionLocal()
        try:
            week_start  = data['week_start']
            week_end    = data['week_end']
            deficit     = float(data['deficit'])
            strategy    = data['strategy']
            return_date = data.get('return_date')

            if strategy == 'saving_first':
                cat = self._get_or_create_system_category(
                    db, 'Покрытие из копилки', 'income', '#0ea5e9'
                )
                self._upsert_plan(db, cat.id, week_start, week_end, deficit)

            elif strategy == 'credit_first':
                repayment_mode   = data.get('repayment_mode', 'single')
                return_date      = data.get('return_date')
                parts_count      = int(data.get('parts_count', 1))
                parts_period     = data.get('parts_period', 'weeks')
                parts_start_date = data.get('parts_start_date')

                # Займ: доход на текущей неделе
                loan_cat = self._get_or_create_system_category(
                    db, 'Займ', 'income', '#f59e0b'
                )
                self._upsert_plan(db, loan_cat.id, week_start, week_end, deficit)

                # Категория возврата
                return_cat = self._get_or_create_system_category(
                    db, 'Возврат займа', 'expense', '#ef4444'
                )

                if repayment_mode == 'single':
                    # Единовременный возврат
                    if not return_date:
                        return {'success': False, 'error': 'Укажите дату возврата'}

                    return_monday = self._get_monday(return_date)
                    return_sunday = return_monday + timedelta(days=6)

                    existing = db.query(Plan).filter(
                        and_(
                            Plan.category_id     == return_cat.id,
                            Plan.week_start_date == return_monday.isoformat(),
                        )
                    ).first()
                    if existing:
                        existing.amount += deficit
                    else:
                        db.add(Plan(
                            category_id     = return_cat.id,
                            week_start_date = return_monday.isoformat(),
                            week_end_date   = return_sunday.isoformat(),
                            amount          = deficit,
                        ))

                elif repayment_mode == 'parts':
                    # Возврат по частям
                    if not parts_start_date or parts_count < 2:
                        return {'success': False, 'error': 'Укажите дату и количество выплат'}

                    per_payment = deficit / parts_count
                    start       = date.fromisoformat(parts_start_date)

                    for i in range(parts_count):
                        if parts_period == 'weeks':
                            payment_date  = start + timedelta(weeks=i)
                        else:
                            # Месяцы
                            month = start.month + i
                            year  = start.year + (month - 1) // 12
                            month = ((month - 1) % 12) + 1
                            if month == 12:
                                last_day = 31
                            else:
                                last_day = (date(year, month + 1, 1) - timedelta(days=1)).day
                            actual_day   = min(start.day, last_day)
                            payment_date = date(year, month, actual_day)

                        payment_monday = self._get_monday(payment_date.isoformat())
                        payment_sunday = payment_monday + timedelta(days=6)

                        existing = db.query(Plan).filter(
                            and_(
                                Plan.category_id     == return_cat.id,
                                Plan.week_start_date == payment_monday.isoformat(),
                            )
                        ).first()
                        if existing:
                            existing.amount += per_payment
                        else:
                            db.add(Plan(
                                category_id     = return_cat.id,
                                week_start_date = payment_monday.isoformat(),
                                week_end_date   = payment_sunday.isoformat(),
                                amount          = per_payment,
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

    # ── Сверка баланса ────────────────────────────────────────────────────────
    def reconcile_balance(self, data: dict) -> dict:
        """
        data = {
            actual_balance:      float,
            calculated_balance:  float,
            week_start:          str,
            week_end:            str,
        }
        """
        db = SessionLocal()
        try:
            actual     = float(data['actual_balance'])
            calculated = float(data['calculated_balance'])
            week_start = data['week_start']
            week_end   = data['week_end']
            diff       = actual - calculated

            if abs(diff) < 0.01:
                return {'success': True, 'diff': 0, 'action': 'none'}

            if diff > 0:
                cat = self._get_or_create_system_category(
                    db, 'Незапланированные доходы', 'income', '#10b981'
                )
                # Удаляем старую корректировку за эту неделю если есть
                db.query(Fact).filter(
                    and_(
                        Fact.category_id     == cat.id,
                        Fact.week_start_date == week_start,
                        Fact.external_id     == None,
                    )
                ).delete()
                db.add(Fact(
                    account_id      = db.query(Account).first().id,
                    category_id     = cat.id,
                    week_start_date = week_start,
                    week_end_date   = week_end,
                    amount          = diff,
                    date            = date.today().isoformat(),
                    comment         = 'Сверка баланса',
                    external_id     = None,
                ))
                action = 'income'
            else:
                cat = self._get_or_create_system_category(
                    db, 'Незапланированные расходы', 'expense', '#f43f5e'
                )
                db.query(Fact).filter(
                    and_(
                        Fact.category_id     == cat.id,
                        Fact.week_start_date == week_start,
                        Fact.external_id     == None,
                    )
                ).delete()
                db.add(Fact(
                    account_id      = db.query(Account).first().id,
                    category_id     = cat.id,
                    week_start_date = week_start,
                    week_end_date   = week_end,
                    amount          = abs(diff),
                    date            = date.today().isoformat(),
                    comment         = 'Сверка баланса',
                    external_id     = None,
                ))
                action = 'expense'

            db.commit()
            return {'success': True, 'diff': diff, 'action': action}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def get_calculated_balance(self, week_start: str) -> dict:
        """
        Считает баланс нарастающим итогом
        от начала периода ДО конца указанной недели (включительно).
        """
        db = SessionLocal()
        try:
            a       = db.query(Account).first()
            balance = a.initial_balance if a else 0.0

            s = db.query(Settings).first()
            if not s:
                return {'success': False, 'error': 'Нет настроек'}

            weeks = self._generate_weeks(s.planning_start_date)

            cats        = db.query(Category).all()
            income_ids  = {c.id for c in cats if c.type == 'income'}
            expense_ids = {c.id for c in cats if c.type == 'expense'}

            for week in weeks:
                ws = week['week_start']

                # Суммируем доходы
                for cat_id in income_ids:
                    fs = db.query(Fact).filter(
                        and_(
                            Fact.category_id     == cat_id,
                            Fact.week_start_date == ws,
                        )
                    ).all()
                    if fs:
                        balance += sum(f.amount for f in fs)
                    else:
                        p = db.query(Plan).filter(
                            and_(
                                Plan.category_id     == cat_id,
                                Plan.week_start_date == ws,
                            )
                        ).first()
                        if p:
                            balance += p.amount

                # Суммируем расходы
                for cat_id in expense_ids:
                    fs = db.query(Fact).filter(
                        and_(
                            Fact.category_id     == cat_id,
                            Fact.week_start_date == ws,
                        )
                    ).all()
                    if fs:
                        balance -= sum(f.amount for f in fs)
                    else:
                        p = db.query(Plan).filter(
                            and_(
                                Plan.category_id     == cat_id,
                                Plan.week_start_date == ws,
                            )
                        ).first()
                        if p:
                            balance -= p.amount

                # Останавливаемся на выбранной неделе
                if ws == week_start:
                    break

            return {'success': True, 'balance': round(balance, 2)}
        except Exception as e:
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    # ── Экспорт / Импорт ──────────────────────────────────────────────────────
    def export_data(self) -> dict:
        """Возвращает всё содержимое БД как словарь для сохранения в JSON"""
        db = SessionLocal()
        try:
            s    = db.query(Settings).first()
            a    = db.query(Account).first()
            cats = db.query(Category).order_by(Category.sort_order).all()
            plans= db.query(Plan).all()
            facts= db.query(Fact).all()

            return {
                'success': True,
                'data': {
                    'version':    1,
                    'exported_at': date.today().isoformat(),
                    'settings': {
                        'planning_start_date': s.planning_start_date if s else None,
                        'financial_strategy':  s.financial_strategy  if s else 'manual',
                        'visual_config':       json.loads(s.visual_config or '{}') if s else {},
                    },
                    'account': {
                        'name':            a.name            if a else '',
                        'initial_balance': a.initial_balance if a else 0,
                    },
                    'categories': [
                        {
                            'id':         c.id,
                            'name':       c.name,
                            'type':       c.type,
                            'color_code': c.color_code,
                            'sort_order': c.sort_order,
                            'is_custom':  bool(c.is_custom),
                        }
                        for c in cats
                    ],
                    'plans': [
                        {
                            'category_id':     p.category_id,
                            'week_start_date': p.week_start_date,
                            'week_end_date':   p.week_end_date,
                            'amount':          p.amount,
                        }
                        for p in plans
                    ],
                    'facts': [
                        {
                            'category_id':     f.category_id,
                            'week_start_date': f.week_start_date,
                            'week_end_date':   f.week_end_date,
                            'amount':          f.amount,
                            'date':            f.date,
                            'comment':         f.comment,
                            'external_id':     f.external_id,
                        }
                        for f in facts
                    ],
                }
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def import_data(self, data: dict) -> dict:
        """Полностью заменяет данные БД из импортированного словаря"""
        db = SessionLocal()
        try:
            # Очищаем таблицы
            db.query(Fact).delete()
            db.query(Plan).delete()
            db.query(Category).delete()
            db.query(Account).delete()
            db.query(Settings).delete()

            s = data.get('settings', {})
            db.add(Settings(
                planning_start_date = s.get('planning_start_date'),
                financial_strategy  = s.get('financial_strategy', 'manual'),
                visual_config       = json.dumps(s.get('visual_config', {})),
            ))

            a = data.get('account', {})
            db.add(Account(
                name            = a.get('name', 'Основной счёт'),
                initial_balance = float(a.get('initial_balance', 0)),
            ))

            # Сохраняем категории с оригинальными id
            id_map = {}  # old_id → new_id (для планов и фактов)
            for cat in data.get('categories', []):
                new_cat = Category(
                    name       = cat['name'],
                    type       = cat['type'],
                    color_code = cat.get('color_code', '#94a3b8'),
                    sort_order = cat.get('sort_order', 0),
                    is_custom  = cat.get('is_custom', True),
                )
                db.add(new_cat)
                db.flush()
                id_map[cat['id']] = new_cat.id

            a_obj = db.query(Account).first()

            for p in data.get('plans', []):
                new_cat_id = id_map.get(p['category_id'])
                if new_cat_id:
                    db.add(Plan(
                        category_id     = new_cat_id,
                        week_start_date = p['week_start_date'],
                        week_end_date   = p['week_end_date'],
                        amount          = p['amount'],
                    ))

            for f in data.get('facts', []):
                new_cat_id = id_map.get(f['category_id'])
                if new_cat_id:
                    db.add(Fact(
                        account_id      = a_obj.id,
                        category_id     = new_cat_id,
                        week_start_date = f['week_start_date'],
                        week_end_date   = f['week_end_date'],
                        amount          = f['amount'],
                        date            = f.get('date'),
                        comment         = f.get('comment'),
                        external_id     = f.get('external_id'),
                    ))

            db.commit()
            return {'success': True}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    # ── Диалог сохранения файла (через PyWebView) ──────────────────────────────
    def save_file_dialog(self, content: str, filename: str) -> dict:
        """Открывает диалог сохранения файла"""
        try:
            result = self._window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=filename,
                file_types=('JSON Files (*.json)', 'All Files (*.*)')
            )
            if result and len(result) > 0:
                path = result[0] if isinstance(result, (list, tuple)) else result
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return {'success': True, 'path': path}
            return {'success': False, 'error': 'Отменено'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def open_file_dialog(self) -> dict:
        """Открывает диалог выбора файла и возвращает содержимое"""
        try:
            result = self._window.create_file_dialog(
                webview.OPEN_DIALOG,
                file_types=('JSON Files (*.json)', 'All Files (*.*)')
            )
            if result and len(result) > 0:
                path = result[0] if isinstance(result, (list, tuple)) else result
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return {'success': True, 'content': content}
            return {'success': False, 'error': 'Отменено'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ── Вспомогательные ───────────────────────────────────────────────────────
    def _get_monday(self, date_str: str) -> date:
        d = date.fromisoformat(date_str)
        return d - timedelta(days=d.weekday())

    def _generate_weeks(self, start_str: str) -> list:
        """52 недели вперёд от start_str (приводим к понедельнику)"""
        MONTHS_RU = {
            1:'янв', 2:'фев', 3:'мар', 4:'апр',
            5:'май', 6:'июн', 7:'июл', 8:'авг',
            9:'сен', 10:'окт', 11:'ноя', 12:'дек',
        }
        start   = self._get_monday(start_str)
        weeks   = []
        current = start

        for i in range(52):
            week_end = current + timedelta(days=6)
            label = (
                f"{current.day} {MONTHS_RU[current.month]}"
                f" – "
                f"{week_end.day} {MONTHS_RU[week_end.month]}"
            )
            weeks.append({
                'week_start':  current.isoformat(),
                'week_end':    week_end.isoformat(),
                'label':       label,
                'week_number': i + 1,
            })
            current += timedelta(days=7)

        return weeks

    def _get_or_create_system_category(
        self, db, name: str, cat_type: str, color_code: str
    ):
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
                is_custom  = False,
            )
            db.add(cat)
            db.flush()
        return cat
