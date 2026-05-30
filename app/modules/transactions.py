from datetime import date
from sqlalchemy import and_

from app.database import SessionLocal
from app.models import Category, Fact, Plan, Account


class TransactionsMixin:
    def save_cell(self, data: dict) -> dict:
        """
        Сохраняет плановое значение или факт в ячейку таблицы.

        Args:
            data (dict): Словарь с category_id, week_start_date, week_end_date,
                amount, mode ('plan' или 'fact').

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
        required = ['category_id', 'week_start_date', 'week_end_date']
        for field in required:
            if field not in data:
                return {'success': False, 'error': f'Отсутствует поле: {field}'}
        
        try:
            date.fromisoformat(data['week_start_date'])
            date.fromisoformat(data['week_end_date'])
        except (ValueError, TypeError) as e:
            return {'success': False, 'error': f'Некорректный формат даты: {e}'}
        
        db = SessionLocal()
        try:
            category_id = int(data['category_id'])
            week_start_date = data['week_start_date']
            week_end_date = data['week_end_date']
            amount = float(data.get('amount', 0))
            mode = data.get('mode', 'plan')

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

    def save_paired_saving(self, data: dict) -> dict:
        """
        Сохраняет парную операцию копилки (доход и расход одновременно).

        Args:
            data (dict): Словарь с category_id, week_start_date, week_end_date, amount.

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
        required = ['category_id', 'week_start_date', 'week_end_date', 'amount']
        for field in required:
            if field not in data:
                return {'success': False, 'error': f'Отсутствует поле: {field}'}

        try:
            date.fromisoformat(data['week_start_date'])
            date.fromisoformat(data['week_end_date'])
        except (ValueError, TypeError) as e:
            return {'success': False, 'error': f'Некорректный формат даты: {e}'}

        amount = float(data['amount'])
        if amount <= 0:
            return {'success': False, 'error': 'Сумма должна быть > 0'}

        db = SessionLocal()
        try:
            category_id = int(data['category_id'])
            week_start_date = data['week_start_date']
            week_end_date = data['week_end_date']

            if date.fromisoformat(week_end_date) < date.fromisoformat(self._today_local()):
                return {'success': False, 'error': 'Нельзя добавлять факты в прошедшие недели'}

            cat = db.query(Category).filter(
                Category.id == category_id
            ).first()
            if not cat:
                return {'success': False, 'error': 'Категория не найдена'}

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

            self._upsert_fact(db, category_id, week_start_date, week_end_date, amount)
            self._upsert_fact(db, paired_cat.id, week_start_date, week_end_date, amount)

            db.commit()
            return {'success': True}

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def save_cell_comment(self, data: dict) -> dict:
        """
        Сохраняет комментарий к ячейке плана или факта.

        Args:
            data (dict): Словарь с category_id, week_start_date, comment.

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
        required = ['category_id', 'week_start_date']
        for field in required:
            if field not in data:
                return {'success': False, 'error': f'Отсутствует поле: {field}'}

        try:
            date.fromisoformat(data['week_start_date'])
        except (ValueError, TypeError) as e:
            return {'success': False, 'error': f'Некорректный формат даты: {e}'}

        try:
            int(data['category_id'])
        except (ValueError, TypeError):
            return {'success': False, 'error': 'category_id должно быть целым числом'}

        db = SessionLocal()
        try:
            category_id = int(data['category_id'])
            week_start_date = data['week_start_date']
            comment = data.get('comment')
            
            obj = db.query(Fact).filter(
                and_(
                    Fact.category_id == category_id,
                    Fact.week_start_date == week_start_date,
                    Fact.external_id == None,
                )
            ).first()

            if not obj:
                obj = db.query(Plan).filter(
                    and_(
                        Plan.category_id == category_id,
                        Plan.week_start_date == week_start_date,
                    )
                ).first()

            if obj:
                obj.comment = comment
                db.commit()
                return {'success': True}
            else:
                return {
                    'success': False, 
                    'error': 'Нет записи для комментария. Сначала введите сумму.'
                }

        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def add_fact_transaction(self, data: dict) -> dict:
        """
        Добавляет отдельную факт-транзакцию.

        Args:
            data (dict): Словарь с category_id, amount, week_start, week_end, date.

        Returns:
            dict: {'success': bool, 'fact_ids': list, 'amount': float, 'error': str | None}
        """
        db = SessionLocal()
        try:
            a = db.query(Account).first()
            if not a:
                return {'success': False, 'error': 'Счёт не создан'}
                
            cat = db.query(Category).filter(
                Category.id == int(data['category_id'])
            ).first()
            if not cat:
                return {'success': False, 'error': 'Категория не найдена'}

            amount = float(data['amount'])
            if amount <= 0:
                return {'success': False, 'error': 'Сумма должна быть > 0'}

            cats_to_add = [cat]
            if cat.name == 'Покрытие из копилки':
                paired = self._get_or_create_system_category(
                    db, 'В копилку', 'expense', '#8b5cf6'
                )
                cats_to_add.append(paired)
            elif cat.name == 'В копилку':
                paired = self._get_or_create_system_category(
                    db, 'Покрытие из копилки', 'income', '#0ea5e9'
                )
                cats_to_add.append(paired)

            added_ids = []
            for c in cats_to_add:
                f = Fact(
                    account_id=a.id,
                    category_id=c.id,
                    week_start_date=data['week_start'],
                    week_end_date=data['week_end'],
                    amount=amount,
                    date=data['date'],
                    comment=None,
                    external_id=None
                )
                db.add(f)
                db.flush()
                added_ids.append(f.id)

            db.commit()
            return {'success': True, 'fact_ids': added_ids, 'amount': amount}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def update_fact_transaction(self, data: dict) -> dict:
        """
        Обновляет сумму факт-транзакции.

        Args:
            data (dict): Словарь с fact_id, amount.

        Returns:
            dict: {'success': bool, 'old_amount': float, 'error': str | None}
        """
        db = SessionLocal()
        try:
            f = db.query(Fact).filter(Fact.id == int(data['fact_id'])).first()
            if not f:
                return {'success': False, 'error': 'Транзакция не найдена'}

            old_amount = f.amount
            new_amount = float(data['amount'])
            
            cat = db.query(Category).filter(Category.id == f.category_id).first()
            if cat and cat.name in ('В копилку', 'Покрытие из копилки'):
                paired_name = 'Покрытие из копилки' if cat.name == 'В копилку' else 'В копилку'
                paired_cat = db.query(Category).filter(Category.name == paired_name).first()
                if paired_cat:
                    paired_fact = db.query(Fact).filter(
                        and_(
                            Fact.category_id == paired_cat.id,
                            Fact.date == f.date,
                            Fact.amount == old_amount,
                            Fact.week_start_date == f.week_start_date
                        )
                    ).first()
                    if paired_fact:
                        paired_fact.amount = new_amount

            f.amount = new_amount
            db.commit()
            return {'success': True, 'old_amount': old_amount}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def delete_fact_transaction(self, data: dict) -> dict:
        """
        Удаляет факт-транзакцию.

        Args:
            data (dict): Словарь с fact_id.

        Returns:
            dict: {'success': bool, 'deleted_data': dict, 'error': str | None}
        """
        db = SessionLocal()
        try:
            f = db.query(Fact).filter(Fact.id == int(data['fact_id'])).first()
            if not f:
                return {'success': False, 'error': 'Транзакция не найдена'}

            deleted_data = {
                'category_id': f.category_id,
                'week_start': f.week_start_date,
                'week_end': f.week_end_date,
                'amount': f.amount,
                'date': f.date
            }

            cat = db.query(Category).filter(Category.id == f.category_id).first()
            if cat and cat.name in ('В копилку', 'Покрытие из копилки'):
                paired_name = 'Покрытие из копилки' if cat.name == 'В копилку' else 'В копилку'
                paired_cat = db.query(Category).filter(Category.name == paired_name).first()
                if paired_cat:
                    paired_fact = db.query(Fact).filter(
                        and_(
                            Fact.category_id == paired_cat.id,
                            Fact.date == f.date,
                            Fact.amount == f.amount,
                            Fact.week_start_date == f.week_start_date
                        )
                    ).first()
                    if paired_fact:
                        db.delete(paired_fact)

            db.delete(f)
            db.commit()
            return {'success': True, 'deleted_data': deleted_data}
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()
