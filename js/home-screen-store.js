"use strict";

((root) => {
  const model = root.PocketLabHomeScreenModel;
  const storage = root.PocketLabStorage;

  function requireDependencies() {
    if (!model) {
      throw new Error("主屏幕布局模块没有加载。");
    }
    if (!storage) {
      throw new Error("本机存储模块没有加载。");
    }
  }

  async function load(appIds) {
    requireDependencies();
    const record = await storage.getAppData(model.STORAGE_KEY);
    return model.normalizeLayout(record && record.data, appIds);
  }

  async function save(layout, appIds) {
    requireDependencies();
    const normalized = model.normalizeLayout(layout, appIds);
    await storage.saveAppData(model.STORAGE_KEY, normalized);
    return normalized;
  }

  root.PocketLabHomeScreenStore = Object.freeze({
    load,
    save,
  });
})(window);
