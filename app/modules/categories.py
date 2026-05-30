from app.database import SessionLocal
from app.models import Category, Plan, Fact
from app.modules.constants import PROTECTED_CATEGORIES


class CategoriesMixin:
    def get_categories(self) -> list:
        """
        Получает все категории, отсортированные по порядку.

        Returns:
            list: Список словарей с данными категорий.
        """
        db = SessionLocal()
        try:
            cats = db.query(Category).order_by(Category.sort_order).all()
            return [self._cat_to_dict(c) for c in cats]
        finally:
            db.close()

    def add_category(self, data: dict) -> dict:
        """
        Добавляет новую категорию.

        Args:
            data (dict): Словарь с полями name, type, color_code.

        Returns:
            dict: {'success': bool, 'category': dict | None, 'error': str | None}
        """
        db = SessionLocal()
        try:
            last = db.query(Category).filter(
                Category.type == data.get('type')
            ).order_by(Category.sort_order.desc()).first()
            next_order = (last.sort_order + 1) if last else 0

            cat = Category(
                name=data.get('name', 'Новая категория'),
                type=data.get('type', 'expense'),
                color_code=data.get('color_code', '#94a3b8'),
                sort_order=next_order,
                is_custom=True,
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
        """
        Обновляет название и цвет категории.

        Args:
            category_id (int): ID категории.
            data (dict): Словарь с полями name, color_code.

        Returns:
            dict: {'success': bool, 'error': str | None}

        Raises:
            ValueError: Если попытаться изменить защищённую категорию.
        """
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
        """
        Удаляет категорию и все связанные с ней планы и факты.

        Args:
            category_id (int): ID категории.

        Returns:
            dict: {'success': bool, 'error': str | None}

        Raises:
            ValueError: Если попытаться удалить защищённую категорию.
        """
        db = SessionLocal()
        try:
            cat = db.query(Category).filter(
                Category.id == int(category_id)
            ).first()
            if not cat:
                return {'success': False, 'error': 'Категория не найдена'}

            if cat.name in PROTECTED_CATEGORIES:
                return {
                    'success': False,
                    'error': f'Категорию «{cat.name}» нельзя удалить, только переименовать'
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
        """
        Обновляет порядок категорий.

        Args:
            ordered_ids (list): Список ID категорий в новом порядке.

        Returns:
            dict: {'success': bool, 'error': str | None}
        """
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
