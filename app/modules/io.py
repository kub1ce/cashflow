import json
from webview import FileDialog

from app.database import SessionLocal
from app.models import Settings, Account, Category, Plan, Fact


class IOMixin:
    def export_data(self) -> dict:
        """
        Экспортирует все данные БД в словарь для сохранения.

        Returns:
            dict: {'success': bool, 'data': dict, 'error': str | None}
        """
        db = SessionLocal()
        try:
            s = db.query(Settings).first()
            a = db.query(Account).first()
            cats = db.query(Category).order_by(Category.sort_order).all()
            plans = db.query(Plan).all()
            facts = db.query(Fact).all()

            return {
                'success': True,
                'data': {
                    'version': 1,
                    'exported_at': self._today_local(),
                    'settings': {
                        'financial_strategy': s.financial_strategy if s else 'manual',
                        'visual_config': json.loads(s.visual_config or '{}') if s else {},
                    },
                    'account': {
                        'name': a.name if a else '',
                        'initial_balance': a.initial_balance if a else 0,
                    },
                    'categories': [
                        {
                            'id': c.id,
                            'name': c.name,
                            'type': c.type,
                            'color_code': c.color_code,
                            'sort_order': c.sort_order,
                            'is_custom': bool(c.is_custom),
                        }
                        for c in cats
                    ],
                    'plans': [
                        {
                            'category_id': p.category_id,
                            'week_start_date': p.week_start_date,
                            'week_end_date': p.week_end_date,
                            'amount': p.amount,
                            'comment': p.comment,
                        }
                        for p in plans
                    ],
                    'facts': [
                        {
                            'category_id': f.category_id,
                            'week_start_date': f.week_start_date,
                            'week_end_date': f.week_end_date,
                            'amount': f.amount,
                            'date': f.date,
                            'comment': f.comment,
                            'external_id': f.external_id,
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
        """
        Импортирует данные из словаря заменяя всё в БД кроме даты начала.

        Args:
            data (dict | str): Словарь с данными или JSON строка.

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
        db = SessionLocal()
        try:
            if isinstance(data, str):
                try:
                    data = json.loads(data)
                except json.JSONDecodeError:
                    return {'success': False, 'error': 'Невалидный JSON'}

            current_settings = db.query(Settings).first()
            current_start_date = current_settings.planning_start_date if current_settings else None
            
            db.query(Fact).delete()
            db.query(Plan).delete()
            db.query(Category).delete()
            db.query(Account).delete()
            db.query(Settings).delete()

            s = data.get('settings', {})
            db.add(Settings(
                planning_start_date=current_start_date or s.get('planning_start_date'),
                financial_strategy=s.get('financial_strategy', 'manual'),
                visual_config=json.dumps(s.get('visual_config', {})),
            ))

            a = data.get('account', {})
            db.add(Account(
                name=a.get('name', 'Основной счёт'),
                initial_balance=float(a.get('initial_balance', 0)),
            ))

            id_map = {}
            for cat in data.get('categories', []):
                new_cat = Category(
                    name=cat['name'],
                    type=cat['type'],
                    color_code=cat.get('color_code', '#94a3b8'),
                    sort_order=cat.get('sort_order', 0),
                    is_custom=cat.get('is_custom', True),
                )
                db.add(new_cat)
                db.flush()
                id_map[cat['id']] = new_cat.id

            a_obj = db.query(Account).first()

            for p in data.get('plans', []):
                new_cat_id = id_map.get(p['category_id'])
                if new_cat_id:
                    db.add(Plan(
                        category_id=new_cat_id,
                        week_start_date=p['week_start_date'],
                        week_end_date=p['week_end_date'],
                        amount=p['amount'],
                        comment=p.get('comment'),
                    ))

            for f in data.get('facts', []):
                new_cat_id = id_map.get(f['category_id'])
                if new_cat_id:
                    db.add(Fact(
                        account_id=a_obj.id,
                        category_id=new_cat_id,
                        week_start_date=f['week_start_date'],
                        week_end_date=f['week_end_date'],
                        amount=f['amount'],
                        date=f.get('date'),
                        comment=f.get('comment'),
                        external_id=f.get('external_id'),
                    ))

            db.commit()
            return {'success': True}
            
        except Exception as e:
            db.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            db.close()

    def save_file_dialog(self, content: str, filename: str) -> dict:
        """
        Открывает диалог сохранения файла и сохраняет содержимое.

        Args:
            content (str): Содержимое для сохранения.
            filename (str): Предлагаемое имя файла.

        Returns:
            dict: {'success': bool, 'path': str | None, 'error': str | None}
        """
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
        """
        Открывает диалог выбора файла и возвращает его содержимое.

        Returns:
            dict: {'success': bool, 'content': str | None, 'error': str | None}
        """
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
