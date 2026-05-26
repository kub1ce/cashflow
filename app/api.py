import os
import ctypes
import ctypes.wintypes
import json
from datetime import date, timedelta

from sqlalchemy import and_

from app.database import SessionLocal
from app.models import Settings, Account, Category, Plan, Fact

from webview import FileDialog

# Системные категории которые нельзя удалять
PROTECTED_CATEGORIES = {
    'Незапланированные расходы',
    'Незапланированные доходы',
    'Возврат займа',
    'Покрытие из копилки',
    'Займ',
    'В копилку',
}

WINDOW_TITLE = 'Cash Flow'

class API:

    def __init__(self):
        self._window = None
        self._frontend_dir = None
        self._hwnd = None

    def set_window(self, window):
        self._window = window

    def set_frontend_dir(self, frontend_dir: str):
        self._frontend_dir = frontend_dir

    # ── Навигация ──────────────────────────────────────────────────────────────
    def navigate_to(self, page: str):
        if not self._frontend_dir:
            return {'success': False, 'error': 'Frontend directory не установлен'}
        frontend_dir = os.path.normpath(self._frontend_dir)
        path         = os.path.normpath(os.path.join(frontend_dir, page))
        
        #  Проверяем что итоговый путь находится внутри frontend_dir
        # os.path.commonpath сравнивает без учёта слэшей и регистра на Windows
        try:
            common = os.path.commonpath([frontend_dir, path])
        except ValueError:
            # На Windows commonpath кидает ValueError если пути на разных дисках
            return {'success': False, 'error': 'Недопустимый путь'}

        if common != frontend_dir:
            return {
                'success': False,
                'error':   f'Недопустимый путь: выход за пределы директории приложения'
            }

        #  Проверяем что файл реально существует
        if not os.path.isfile(path):
            return {'success': False, 'error': f'Страница не найдена: {page}'}

        url = 'file:///' + path.replace('\\', '/')
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
                if cat.name in PROTECTED_CATEGORIES:
                    return {
                        'success': False,
                        'error': f'Категорию «{cat.name}» нельзя переименовать'
                    }
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

            # Проверяем счёт сразу — это аномалия, не норма
            a = db.query(Account).first()
            if not a:
                return {'error': 'no_account'}

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

            vc = json.loads(s.visual_config or '{}')

            return {
                'weeks':           weeks,
                'categories':      categories,
                'plans':           plans,
                'facts':           facts,
                'initial_balance': a.initial_balance,  # a точно не None
                'settings': {
                    'financial_strategy':  s.financial_strategy,
                    'planning_start_date': s.planning_start_date,
                    'visual_config':       vc,
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
        a = db.query(Account).first()
        if not a:
            raise RuntimeError('Счёт не создан')
        account_id = a.id

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
        db = SessionLocal()
        try:
            #  Валидация обязательных полей перед использованием
            if 'start_date' not in data:
                return {'success': False, 'error': 'Не указана дата начала (start_date)'}
            if 'category_id' not in data:
                return {'success': False, 'error': 'Не указана категория (category_id)'}
            if 'count' not in data:
                return {'success': False, 'error': 'Не указано количество периодов (count)'}
            if 'amount' not in data:
                return {'success': False, 'error': 'Не указана сумма (amount)'}

            #  Отдельная валидация даты с понятным сообщением об ошибке
            try:
                date.fromisoformat(data['start_date'])
            except (ValueError, TypeError):
                return {
                    'success': False,
                    'error':   f'Некорректный формат даты: «{data["start_date"]}». '
                            f'Ожидается YYYY-MM-DD'
                }

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
            if mode not in ('weeks', 'months'):
                return {'success': False, 'error': f'Неизвестный режим: «{mode}»'}

            target_dates = []

            if mode == 'weeks':
                week_start = self._get_monday(start_date)  #  дата уже проверена выше
                for i in range(count):
                    target_dates.append(week_start + timedelta(weeks=i))

            elif mode == 'months':
                start = date.fromisoformat(start_date)     #  безопасно
                year  = start.year
                month = start.month

                for i in range(count):
                    if month == 12:
                        last_day = 31
                    else:
                        last_day = (date(year, month + 1, 1) - timedelta(days=1)).day

                    actual_day = min(day_of_month, last_day)
                    target_dates.append(date(year, month, actual_day))

                    month += 1
                    if month > 12:
                        month = 1
                        year  += 1

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
                income_cat = self._get_or_create_system_category(
                    db, 'Покрытие из копилки', 'income', '#0ea5e9'
                )
                expense_cat = self._get_or_create_system_category(
                    db, 'В копилку', 'expense', '#8b5cf6'
                )

                # Две парные операции как ФАКТЫ
                self._upsert_fact(db, income_cat.id,  week_start, week_end, deficit)
                self._upsert_fact(db, expense_cat.id, week_start, week_end, deficit)

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
                    if not parts_start_date or parts_count < 2:
                        return {'success': False, 'error': 'Укажите дату и количество выплат'}

                    per_payment = deficit / parts_count
                    start       = date.fromisoformat(parts_start_date)

                    for i in range(parts_count):
                        if parts_period == 'weeks':
                            payment_date  = start + timedelta(weeks=i)
                        else:
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
        
    def save_paired_saving(self, data: dict) -> dict:
        """
        Автоматически создаёт парную операцию.
        Если вводим факт в «Покрытие из копилки» → создаётся факт в «В копилку»
        Если вводим факт в «В копилку» → создаётся факт в «Покрытие из копилки»
        """
        db = SessionLocal()
        try:
            category_id     = int(data['category_id'])
            week_start_date = data['week_start_date']
            week_end_date   = data['week_end_date']
            amount          = float(data['amount'])

            if date.fromisoformat(week_end_date) < date.today():
                return {'success': False, 'error': 'Нельзя добавлять факты в прошедшие недели'}

            cat = db.query(Category).filter(
                Category.id == category_id
            ).first()
            if not cat:
                return {'success': False, 'error': 'Категория не найдена'}

            # Определяем парную категорию
            if cat.name == 'Покрытие из копилки':
                paired_cat = self._get_or_create_system_category(
                    db, 'В копилку', 'expense', '#8b5cf6'
                )
            elif cat.name == 'В копилку':
                paired_cat = self._get_or_create_system_category(
                    db, 'Покрытие из копилки', 'income', '#0ea5e9'
                )
            else:
                return {'success': False, 'error': 'Не копилочная категория'}

            # Сохраняем обе операции одновременно
            self._upsert_fact(db, category_id, week_start_date, week_end_date, amount)
            self._upsert_fact(db, paired_cat.id, week_start_date, week_end_date, amount)

            db.commit()
            return {'success': True}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

        
    
    # ── Отмена автозаполнения ─────────────────────────────────────────────────
    def undo_autofill(self, data: dict) -> dict:
        db = SessionLocal()
        try:
            # Проверяем обязательные поля
            if 'start_date' not in data:
                return {'success': False, 'error': 'Не указана дата начала (start_date)'}
            if 'category_id' not in data:
                return {'success': False, 'error': 'Не указана категория (category_id)'}
            if 'count' not in data:
                return {'success': False, 'error': 'Не указано количество периодов (count)'}

            # Отдельная валидация формата даты
            try:
                date.fromisoformat(data['start_date'])
            except (ValueError, TypeError):
                return {
                    'success': False,
                    'error':   f'Некорректный формат даты: «{data["start_date"]}». '
                            f'Ожидается YYYY-MM-DD'
                }

            category_id  = int(data['category_id'])
            start_date   = data['start_date']
            mode         = data.get('mode', 'weeks')
            count        = int(data['count'])
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
                year  = start.year
                month = start.month

                for i in range(count):
                    if month == 12:
                        last_day = 31
                    else:
                        last_day = (date(year, month + 1, 1) - timedelta(days=1)).day

                    actual_day = min(day_of_month, last_day)
                    target_dates.append(date(year, month, actual_day))

                    month += 1
                    if month > 12:
                        month = 1
                        year  += 1

            # Находим уникальные недели и удаляем планы
            week_starts = set()
            for target_date in target_dates:
                monday = self._get_monday(target_date.isoformat())
                week_starts.add(monday.isoformat())

            deleted_count = 0
            for ws in week_starts:
                plan = db.query(Plan).filter(
                    and_(
                        Plan.category_id     == category_id,
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

    # ── Отмена возврата займа ─────────────────────────────────────────────────
    def undo_loan_repayment(self, data: dict) -> dict:
        """
        Удаляет план займа на указанной неделе и ОДИН ближайший
        план возврата займа (первый после week_start).
        
        Почему только один: без loan_group_id мы не знаем какие именно
        планы возврата относятся к этому конкретному займу.
        Удалять все — значит затронуть чужие займы.
        """
        db = SessionLocal()
        try:
            week_start = data['week_start']

            loan_cat = db.query(Category).filter(
                Category.name == 'Займ'
            ).first()

            return_cat = db.query(Category).filter(
                Category.name == 'Возврат займа'
            ).first()

            deleted_count = 0

            # Удаляем план займа строго на указанной неделе
            if loan_cat:
                loan_plan = db.query(Plan).filter(
                    and_(
                        Plan.category_id     == loan_cat.id,
                        Plan.week_start_date == week_start,
                    )
                ).first()  # .first() вместо .all() — займ на неделе один
                
                if loan_plan:
                    db.delete(loan_plan)
                    deleted_count += 1

            # Удаляем ОДИН ближайший план возврата после week_start
            # Сортируем по дате и берём первый — это возврат данного займа
            if return_cat:
                nearest_return = db.query(Plan).filter(
                    and_(
                        Plan.category_id     == return_cat.id,
                        Plan.week_start_date >= week_start,  # после недели займа
                    )
                ).order_by(Plan.week_start_date.asc()).first()  # только ближайший
                
                if nearest_return:
                    db.delete(nearest_return)
                    deleted_count += 1

            db.commit()
            return {'success': True, 'deleted': deleted_count}

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

            account = db.query(Account).first()
            if not account:
                return {'success': False, 'error': 'Счёт не создан'}

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
                ).delete(synchronize_session=False)
                db.add(Fact(
                    account_id      = account.id,
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
                ).delete(synchronize_session=False)
                db.add(Fact(
                    account_id      = account.id,
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
        db = SessionLocal()
        try:
            # Проверка счёта
            a = db.query(Account).first()
            if not a:
                return {'success': False, 'error': 'Счёт не создан'}
            balance = a.initial_balance

            # Проверка настроек и даты
            s = db.query(Settings).first()
            if not s or not s.planning_start_date:
                return {'success': False, 'error': 'Нет даты начала планирования'}

            weeks = self._generate_weeks(s.planning_start_date)
            if not weeks:
                return {'success': False, 'error': 'Период не сгенерирован'}

            # Ищем нужную неделю
            target_weeks = []
            found = False

            for week in weeks:
                target_weeks.append(week)
                if week['week_start'] == week_start:
                    found = True
                    break

            if not found:
                return {'success': False, 'error': 'Неделя не найдена'}

            last_week_start = target_weeks[-1]['week_start']

            # Загружаем данные
            all_facts = db.query(Fact).filter(
                Fact.week_start_date <= last_week_start
            ).all()

            all_plans = db.query(Plan).filter(
                Plan.week_start_date <= last_week_start
            ).all()

            # Индексы
            facts_index = {}
            for f in all_facts:
                key = (f.category_id, f.week_start_date)
                facts_index[key] = facts_index.get(key, 0) + f.amount

            plans_index = {}
            for p in all_plans:
                key = (p.category_id, p.week_start_date)
                plans_index[key] = p.amount

            # Категории
            cats = db.query(Category).all()
            income_ids  = {c.id for c in cats if c.type == 'income'}
            expense_ids = {c.id for c in cats if c.type == 'expense'}

            # Расчёт
            for week in target_weeks:
                ws = week['week_start']

                for cat_id in income_ids:
                    key = (cat_id, ws)
                    if key in facts_index:
                        balance += facts_index[key]
                    elif key in plans_index:
                        balance += plans_index[key]

                for cat_id in expense_ids:
                    key = (cat_id, ws)
                    if key in facts_index:
                        balance -= facts_index[key]
                    elif key in plans_index:
                        balance -= plans_index[key]

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
        """Полностью заменяет данные БД из импортированного словаря (кроме planning_start_date)"""
        db = SessionLocal()
        try:
            # Сохраняем текущую дату начала периода
            current_settings = db.query(Settings).first()
            current_start_date = current_settings.planning_start_date if current_settings else None
            
            # Очищаем таблицы
            db.query(Fact).delete()
            db.query(Plan).delete()
            db.query(Category).delete()
            db.query(Account).delete()
            db.query(Settings).delete()

            s = data.get('settings', {})
            db.add(Settings(
                # СОХРАНЯЕМ СТАРУЮ ДАТУ (или берём из импорта если её нет)
                planning_start_date = current_start_date or s.get('planning_start_date'),
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
                FileDialog.SAVE,
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
                FileDialog.OPEN,
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
        if not start_str:
            return []
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
    
    def enable_window_resize(self) -> dict:
        """Включает возможность ресайза для frameless окна"""
        try:
            hwnd = self._get_hwnd()
            if hwnd is None:
                return {'success': False, 'error': 'Window not found'}

            # Получаем текущий стиль окна
            WS_THICKFRAME = 0x00040000
            
            style = ctypes.windll.user32.GetWindowLongW(hwnd, -16)  # GWL_STYLE
            
            # Добавляем WS_THICKFRAME (позволяет ресайзить за края)
            new_style = style | WS_THICKFRAME
            ctypes.windll.user32.SetWindowLongW(hwnd, -16, new_style)
            
            # Обновляем окно
            ctypes.windll.user32.SetWindowPos(
                hwnd, None, 0, 0, 0, 0,
                0x0020 | 0x0002 | 0x0001 | 0x0004  # SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER
            )
            
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _get_hwnd(self):
        """
        Возвращает HWND окна. 
        Сначала пробует через pywebview (надёжно),
        при неудаче — ищет по заголовку (fallback).
        Кидает RuntimeError если окно не найдено.
        """
        if self._hwnd:
            return self._hwnd

        # Способ 1: получаем хэндл напрямую через pywebview
        # window.native — это dict {'hwnd': int} на Windows
        try:
            if self._window and hasattr(self._window, 'native'):
                native = self._window.native
                if isinstance(native, dict) and 'hwnd' in native:
                    self._hwnd = native['hwnd']
                    return self._hwnd
        except Exception:
            pass

        #  Способ 2: fallback — поиск по заголовку
        hwnd = ctypes.windll.user32.FindWindowW(None, WINDOW_TITLE)
        if not hwnd:
            raise RuntimeError(
                f'Окно «{WINDOW_TITLE}» не найдено. '
                f'Убедитесь что заголовок окна совпадает с константой WINDOW_TITLE.'
            )

        self._hwnd = hwnd
        return self._hwnd


    def startup_maximize(self) -> dict:
        """Вызывается при старте — разворачивает окно как maximize (уважает taskbar)"""
        try:
            hwnd = self._get_hwnd()
            ctypes.windll.user32.ShowWindow(hwnd, 3)  # SW_MAXIMIZE
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def minimize_window(self) -> dict:
        try:
            hwnd = self._get_hwnd()
            ctypes.windll.user32.ShowWindow(hwnd, 6)  # SW_MINIMIZE
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def toggle_maximize(self) -> dict:
        try:
            hwnd = self._get_hwnd()
            is_maximized = ctypes.windll.user32.IsZoomed(hwnd)
            if is_maximized:
                ctypes.windll.user32.ShowWindow(hwnd, 9)   # SW_RESTORE
            else:
                ctypes.windll.user32.ShowWindow(hwnd, 3)   # SW_MAXIMIZE
            return {'success': True, 'maximized': not bool(is_maximized)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def close_window(self) -> dict:
        try:
            self._window.destroy()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def move_window(self, x: int, y: int) -> dict:
        """Перемещает окно в указанные координаты"""
        try:
            hwnd = self._get_hwnd()
            # Получаем текущий размер окна
            rect = ctypes.wintypes.RECT()
            ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
            w = rect.right  - rect.left
            h = rect.bottom - rect.top
            # Перемещаем без изменения размера
            ctypes.windll.user32.MoveWindow(hwnd, x, y, w, h, True)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_window_pos(self) -> dict:
        """Возвращает текущую позицию окна"""
        try:
            hwnd = self._get_hwnd()
            rect = ctypes.wintypes.RECT()
            ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
            return {
                'success': True,
                'x': rect.left,
                'y': rect.top,
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_account_name(self) -> dict:
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

