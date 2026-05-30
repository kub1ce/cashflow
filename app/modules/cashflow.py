import json

from app.database import SessionLocal
from app.models import Settings, Account, Category, Plan, Fact


class CashflowMixin:
    def get_cashflow_data(self) -> dict:
        """
        Получает полные данные для отображения таблицы кассового потока.

        Returns:
            dict: Словарь с weeks, categories, plans, facts, comments и settings.
                Возвращает {'error': str} если данные неполные.
        """
        db = SessionLocal()
        try:
            s = db.query(Settings).first()
            if not s or not s.planning_start_date:
                return {'error': 'no_settings'}

            a = db.query(Account).first()
            if not a:
                return {'error': 'no_account'}

            weeks = self._generate_weeks(s.planning_start_date)
            cats = db.query(Category).order_by(Category.sort_order).all()
            categories = [self._cat_to_dict(c) for c in cats]

            plans_raw = db.query(Plan).all()
            facts_raw = db.query(Fact).all()

            plans = {}
            facts = {}
            comments = {}

            for p in plans_raw:
                key = f"{p.category_id}:{p.week_start_date}"
                plans[key] = {'id': p.id, 'amount': p.amount}
                if p.comment:
                    comments[key] = p.comment

            for f in facts_raw:
                key = f"{f.category_id}:{f.week_start_date}"
                if key not in facts:
                    facts[key] = []
                facts[key].append({
                    'id': f.id,
                    'amount': f.amount,
                    'date': f.date,
                    'comment': f.comment,
                })
                if f.comment:
                    comments[key] = f.comment

            vc = json.loads(s.visual_config or '{}')

            return {
                'weeks': weeks,
                'categories': categories,
                'plans': plans,
                'facts': facts,
                'comments': comments,
                'initial_balance': a.initial_balance,
                'settings': {
                    'financial_strategy': s.financial_strategy,
                    'planning_start_date': s.planning_start_date,
                    'visual_config': vc,
                },
            }
        finally:
            db.close()

    def get_calculated_balance(self, week_start: str) -> dict:
        """
        Вычисляет баланс счёта на конец указанной недели.

        Args:
            week_start (str): ISO дата начала недели.

        Returns:
            dict: {'success': bool, 'balance': float, 'error': str | None}
        """
        db = SessionLocal()
        try:
            a = db.query(Account).first()
            if not a:
                return {'success': False, 'error': 'Счёт не создан'}
            balance = a.initial_balance

            s = db.query(Settings).first()
            if not s or not s.planning_start_date:
                return {'success': False, 'error': 'Нет даты начала планирования'}

            weeks = self._generate_weeks(s.planning_start_date)
            if not weeks:
                return {'success': False, 'error': 'Период не сгенерирован'}

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

            all_facts = db.query(Fact).filter(
                Fact.week_start_date <= last_week_start
            ).all()

            all_plans = db.query(Plan).filter(
                Plan.week_start_date <= last_week_start
            ).all()

            facts_index = {}
            for f in all_facts:
                key = (f.category_id, f.week_start_date)
                facts_index[key] = facts_index.get(key, 0) + f.amount

            plans_index = {}
            for p in all_plans:
                key = (p.category_id, p.week_start_date)
                plans_index[key] = p.amount

            cats = db.query(Category).all()
            income_ids = {c.id for c in cats if c.type == 'income'}
            expense_ids = {c.id for c in cats if c.type == 'expense'}

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
