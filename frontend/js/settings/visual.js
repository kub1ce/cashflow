const _pendingVcUpdate = {};
let _vcUpdateTimer = null;

async function updateVisualColor(key, value) {
  /**
   * Обновляет цвета оформления с использованием debounce,
   * чтобы избежать спама запросами при перетаскивании ползунка цвета.
   */
  _pendingVcUpdate[key] = value;

  if (!App.data) return;
  if (!App.data.settings.visual_config) App.data.settings.visual_config = {};
  App.data.settings.visual_config[key] = value;

  renderTable(App.data);

  clearTimeout(_vcUpdateTimer);
  _vcUpdateTimer = setTimeout(async () => {
    const current = App.data?.settings?.visual_config || {};
    const updated = { ...current, ..._pendingVcUpdate };

    try {
      await pywebview.api.save_settings({ visual_config: updated });
    } catch (e) {
      showToast('Ошибка сохранения цвета', 'error');
    }
  }, 800);
}