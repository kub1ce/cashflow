from datetime import date, timedelta
from sqlalchemy import and_

from app.database import SessionLocal
from app.models import Category, Plan, Fact


class DeficitMixin:
    def handle_deficit(self, data: dict) -> dict:
        """
        Обрабатывает кассовый разрыв используя выбранную стратегию.

        Args:
            data (dict): Словарь с week_start, week_end, deficit, strategy,
                опционально return_date, repayment_mode, parts_count, etc.

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
        required = ['week_start', 'week_end', 'deficit', 'strategy']
        for field in required:
            if field not in data:
                return {'success': False, 'error': f'Отсутствует поле: {field}'}

        try:
            date.fromisoformat(data['week_start'])
            date.fromisoformat(data['week_end'])
        except (ValueError, TypeError) as e:
            return {'success': False, 'error': f'Некорректный формат даты: {e}'}

        deficit = float(data['deficit'])
        if deficit <= 0:
            return {'success': False, 'error': 'Дефицит должен быть > 0'}

        strategy = data['strategy']
        if strategy not in ('saving_first', 'credit_first'):
            return {'success': False, 'error': f'Неизвестная стратегия: {strategy}'}

        db = SessionLocal()
        try:
            week_start = data['week_start']
            week_end = data['week_end']

            if strategy == 'saving_first':
                income_cat = self._get_or_create_system_category(
                    db, 'Покрытие из копилки', 'income', '#0ea5e9'
                )
                expense_cat = self._get_or_create_system_category(
                    db, 'В копилку', 'expense', '#8b5cf6'
                )

                self._upsert_fact(db, income_cat.id, week_start, week_end, deficit,
                                 fact_date=week_start)
                self._upsert_fact(db, expense_cat.id, week_start, week_end, deficit,
                                 fact_date=week_start)

            else:
                repayment_mode = data.get('repayment_mode', 'single')
                parts_count = int(data.get('parts_count', 1))
                parts_period = data.get('parts_period', 'weeks')
                parts_start_date = data.get('parts_start_date')

                loan_cat = self._get_or_create_system_category(
                    db, 'Займ', 'income', '#f59e0b'
                )
                
                existing_loan = db.query(Plan).filter(
                    and_(
                        Plan.category_id == loan_cat.id,
                        Plan.week_start_date == week_start,
                    )
                ).first()
                
                if existing_loan:
                    existing_loan.amount += data['deficit']
                    loan_plan = existing_loan
                else:
                    loan_plan = Plan(
                        category_id=loan_cat.id,
                        week_start_date=week_start,
                        week_end_date=week_end,
                        amount=data['deficit'],
                    )
                    db.add(loan_plan)
                    db.flush()
                
                loan_id = loan_plan.id

                return_cat = self._get_or_create_system_category(
                    db, 'Возврат займа', 'expense', '#ef4444'
                )

                if repayment_mode == 'single':
                    if not data.get('return_date'):
                        return {'success': False, 'error': 'Укажите дату возврата'}

                    return_date = data['return_date']
                    return_monday = self._get_monday(return_date)
                    return_sunday = return_monday + timedelta(days=6)

                    existing = db.query(Plan).filter(
                        and_(
                            Plan.category_id == return_cat.id,
                            Plan.week_start_date == return_monday.isoformat(),
                        )
                    ).first()
                    if existing:
                        existing.amount += data['deficit']
                        if not existing.loan_id:
                            existing.loan_id = loan_id
                    else:
                        db.add(Plan(
                            category_id=return_cat.id,
                            week_start_date=return_monday.isoformat(),
                            week_end_date=return_sunday.isoformat(),
                            amount=data['deficit'],
                            loan_id=loan_id,
                        ))

                elif repayment_mode == 'parts':
                    if not parts_start_date or parts_count < 2:
                        return {'success': False, 'error': 'Укажите дату и количество выплат'}

                    per_payment = data['deficit'] / parts_count
                    start = date.fromisoformat(parts_start_date)

                    for i in range(parts_count):
                        if parts_period == 'weeks':
                            payment_date = start + timedelta(weeks=i)
                        else:
                            month = start.month + i
                            year = start.year + (month - 1) // 12
                            month = ((month - 1) % 12) + 1
                            last_day = self._last_day_of_month(year, month)
                            actual_day = min(start.day, last_day)
                            payment_date = date(year, month, actual_day)

                        payment_monday = self._get_monday(payment_date.isoformat())
                        payment_sunday = payment_monday + timedelta(days=6)

                        existing = db.query(Plan).filter(
                            and_(
                                Plan.category_id == return_cat.id,
                                Plan.week_start_date == payment_monday.isoformat(),
                            )
                        ).first()
                        if existing:
                            existing.amount += per_payment
                            if not existing.loan_id:
                                existing.loan_id = loan_id
                        else:
                            db.add(Plan(
                                category_id=return_cat.id,
                                week_start_date=payment_monday.isoformat(),
                                week_end_date=payment_sunday.isoformat(),
                                amount=per_payment,
                                loan_id=loan_id,
                            ))

            db.commit()
            return {'success': True}
        
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def undo_loan_repayment(self, data: dict) -> dict:
        """
        Удаляет займ на указанной неделе и все связанные с ним возвраты.

        Args:
            data (dict): Словарь с week_start.

        Returns:
            dict: {'success': bool, 'deleted': int | None, 'error': str | None}
        """
        db = SessionLocal()
        try:
            if 'week_start' not in data:
                return {'success': False, 'error': 'Не указана неделя (week_start)'}

            week_start = data['week_start']

            try:
                date.fromisoformat(week_start)
            except (ValueError, TypeError):
                return {'success': False, 'error': f'Некорректный формат даты: {week_start}'}

            loan_cat = db.query(Category).filter(
                Category.name == 'Займ'
            ).first()

            return_cat = db.query(Category).filter(
                Category.name == 'Возврат займа'
            ).first()

            deleted_count = 0
            loan_id = None

            if loan_cat:
                loan_plans = db.query(Plan).filter(
                    and_(
                        Plan.category_id == loan_cat.id,
                        Plan.week_start_date == week_start,
                    )
                ).all()
                
                for plan in loan_plans:
                    loan_id = plan.id
                    db.delete(plan)
                    deleted_count += 1

                loan_facts = db.query(Fact).filter(
                    and_(
                        Fact.category_id == loan_cat.id,
                        Fact.week_start_date == week_start,
                    )
                ).all()
                
                for fact in loan_facts:
                    db.delete(fact)
                    deleted_count += 1

            if return_cat and loan_id:
                return_plans = db.query(Plan).filter(
                    and_(
                        Plan.category_id == return_cat.id,
                        Plan.loan_id == loan_id,
                    )
                ).all()
                
                for plan in return_plans:
                    db.delete(plan)
                    deleted_count += 1

                return_facts = db.query(Fact).filter(
                    and_(
                        Fact.category_id == return_cat.id,
                        Fact.loan_id == loan_id,
                    )
                ).all()
                
                for fact in return_facts:
                    db.delete(fact)
                    deleted_count += 1

            db.commit()
            return {'success': True, 'deleted': deleted_count}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()
