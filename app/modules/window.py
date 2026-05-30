import os
import threading
import ctypes
import ctypes.wintypes

from app.modules.constants import WINDOW_TITLE


class WindowMixin:
    def navigate_to(self, page: str) -> dict:
        """Загружает страницу в окно."""
        if not self._frontend_dir:
            return {'success': False, 'error': 'Frontend directory не установлен'}
        
        frontend_dir = os.path.normpath(self._frontend_dir)
        path = os.path.normpath(os.path.join(frontend_dir, page))
        
        try:
            common = os.path.commonpath([frontend_dir, path])
        except ValueError:
            return {'success': False, 'error': 'Недопустимый путь'}

        if common != frontend_dir:
            return {'success': False, 'error': 'Недопустимый путь'}

        if not os.path.isfile(path):
            return {'success': False, 'error': f'Страница не найдена: {page}'}

        url = 'file:///' + path.replace('\\', '/')
        threading.Timer(0.1, lambda: self._window.load_url(url)).start()
        return {'success': True}

    def enable_window_resize(self) -> dict:
        """Включает возможность изменения размера frameless окна и чинит рендер."""
        try:
            hwnd = self._get_hwnd()
            if hwnd is None:
                return {'success': False, 'error': 'Window not found'}

            WS_THICKFRAME = 0x00040000
            WS_CAPTION = 0x00C00000
            
            style = ctypes.windll.user32.GetWindowLongW(hwnd, -16)
            new_style = (style | WS_THICKFRAME) & ~WS_CAPTION
            ctypes.windll.user32.SetWindowLongW(hwnd, -16, new_style)
            
            try:
                dwmapi = ctypes.windll.dwmapi
                dwmapi.DwmSetWindowAttribute.argtypes = [
                    ctypes.wintypes.HWND,
                    ctypes.wintypes.DWORD,
                    ctypes.c_void_p,
                    ctypes.wintypes.DWORD
                ]
                dwmapi.DwmSetWindowAttribute.restype = ctypes.c_long
                
                dark_mode = ctypes.c_int(1)
                dwmapi.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(dark_mode), ctypes.sizeof(dark_mode))
                dwmapi.DwmSetWindowAttribute(hwnd, 19, ctypes.byref(dark_mode), ctypes.sizeof(dark_mode))
                
                bg_color = ctypes.c_int(0x002A170F)
                dwmapi.DwmSetWindowAttribute(hwnd, 34, ctypes.byref(bg_color), ctypes.sizeof(bg_color))
                dwmapi.DwmSetWindowAttribute(hwnd, 35, ctypes.byref(bg_color), ctypes.sizeof(bg_color))
            except Exception:
                pass

            ctypes.windll.user32.SetWindowPos(
                hwnd, None, 0, 0, 0, 0,
                0x0020 | 0x0002 | 0x0001 | 0x0004
            )
            
            if self._window:
                rect = ctypes.wintypes.RECT()
                ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
                w = rect.right - rect.left
                h = rect.bottom - rect.top
                
                def force_redraw():
                    if not ctypes.windll.user32.IsZoomed(hwnd):
                        self._window.resize(w, h + 1)
                        self._window.resize(w, h)
                        
                threading.Timer(0.2, force_redraw).start()
            
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _get_hwnd(self) -> int:
        """Получает HWND окна приложения."""
        if self._hwnd:
            return self._hwnd

        try:
            if self._window and hasattr(self._window, 'native'):
                native = self._window.native
                if isinstance(native, dict) and 'hwnd' in native:
                    self._hwnd = native['hwnd']
                    return self._hwnd
                if hasattr(native, 'Handle'):
                    self._hwnd = int(native.Handle)
                    return self._hwnd
        except Exception:
            pass

        hwnd = ctypes.windll.user32.FindWindowW(None, WINDOW_TITLE)
        if not hwnd:
            hwnd = ctypes.windll.user32.FindWindowW(None, 'Cash Flow')
        if not hwnd:
            hwnd = ctypes.windll.user32.FindWindowW(None, 'CashFlow')

        if not hwnd:
            raise RuntimeError('Окно приложения не найдено')

        self._hwnd = hwnd
        return self._hwnd

    def startup_maximize(self) -> dict:
        """Разворачивает окно при старте приложения."""
        try:
            if self._window:
                self._window.maximize()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def minimize_window(self) -> dict:
        """Сворачивает окно в панель задач."""
        try:
            if self._window:
                self._window.minimize()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def toggle_maximize(self) -> dict:
        """Переключает окно между развёрнутым и обычным размером."""
        try:
            hwnd = self._get_hwnd()
            is_maximized = ctypes.windll.user32.IsZoomed(hwnd)
            
            if self._window:
                if is_maximized:
                    self._window.restore()
                else:
                    self._window.maximize()
                    
            return {'success': True, 'maximized': not bool(is_maximized)}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def close_window(self) -> dict:
        """Закрывает окно приложения максимально чисто, без ошибок в консоли."""
        try:
            hwnd = self._get_hwnd()
            if hwnd:
                def send_close_signal():
                    WM_CLOSE = 0x0010
                    ctypes.windll.user32.PostMessageW(hwnd, WM_CLOSE, 0, 0)
                
                threading.Timer(0.1, send_close_signal).start()
            else:
                if self._window:
                    self._window.destroy()
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def move_window(self, x: int, y: int) -> dict:
        """Перемещает окно в указанные координаты."""
        try:
            hwnd = self._get_hwnd()
            rect = ctypes.wintypes.RECT()
            ctypes.windll.user32.GetWindowRect(hwnd, ctypes.byref(rect))
            w = rect.right - rect.left
            h = rect.bottom - rect.top
            ctypes.windll.user32.MoveWindow(hwnd, x, y, w, h, True)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_window_pos(self) -> dict:
        """Получает текущую позицию окна на экране."""
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
