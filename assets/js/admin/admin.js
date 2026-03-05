/**
 * Точка входа админ-панели: вкладки, сохранение, отмена, экспорт/импорт.
 */
(function (global) {
    "use strict";

    var Store = global.AdminStore;
    var UI = global.AdminUI;
    var Schema = global.AdminSchema;
    var panels = {};
    var currentPanelId = "classes";

    function getPanelContainer() {
        return document.getElementById("admin-panel");
    }

    function registerPanel(id, renderFn) {
        panels[id] = renderFn;
    }

    function renderPanel(id) {
        var container = getPanelContainer();
        if (!container) return;
        currentPanelId = id;
        document.querySelectorAll(".admin-tab").forEach(function (tab) {
            tab.classList.toggle("active", tab.getAttribute("data-panel") === id);
        });
        var fn = panels[id];
        if (typeof fn === "function") {
            container.innerHTML = "";
            fn(container);
        } else {
            container.innerHTML = "<p class=\"admin-empty\">Панель не загружена. Проверьте порядок подключения скриптов (admin.js должен быть перед panels/*.js).</p>";
        }
    }

    function initTabs() {
        document.querySelectorAll(".admin-tab").forEach(function (tab) {
            tab.addEventListener("click", function () {
                renderPanel(tab.getAttribute("data-panel"));
            });
        });
    }

    function initSave() {
        var btn = document.getElementById("adminSave");
        if (!btn) return;
        btn.addEventListener("click", function () {
            if (!Store.isDirty()) {
                UI.showWarning("Нет несохранённых изменений");
                return;
            }
            if (!Store.save()) {
                UI.showError("Ошибка сохранения");
                return;
            }
            UI.showSuccess("Изменения сохранены в localStorage");
            renderPanel(currentPanelId);
        });
    }

    function initRevert() {
        var btn = document.getElementById("adminRevert");
        if (!btn) return;
        btn.addEventListener("click", function () {
            if (!Store.isDirty()) {
                UI.showWarning("Нет несохранённых изменений");
                return;
            }
            UI.confirmAction("Отменить все несохранённые изменения?", "Отменить изменения").then(function (ok) {
                if (ok) {
                    Store.revert();
                    UI.showSuccess("Изменения отменены");
                    renderPanel(currentPanelId);
                }
            });
        });
    }

    function initExport() {
        var btn = document.getElementById("adminExport");
        if (!btn) return;
        btn.addEventListener("click", function () {
            Store.exportToFile();
            UI.showSuccess("Файл скачан");
        });
    }

    function initImport() {
        var btn = document.getElementById("adminImport");
        var input = document.getElementById("adminImportFile");
        if (!btn || !input) return;
        btn.addEventListener("click", function () {
            if (Store.isDirty()) {
                UI.confirmAction("Есть несохранённые изменения. Импорт перезапишет данные. Продолжить?", "Импорт").then(function (ok) {
                    if (ok) input.click();
                });
            } else {
                input.click();
            }
        });
        input.addEventListener("change", function () {
            var file = input.files && input.files[0];
            if (!file) return;
            Store.importFromFile(file).then(function (result) {
                if (result.success) {
                    UI.showSuccess("Данные импортированы");
                    renderPanel(currentPanelId);
                } else {
                    UI.showError(result.error || "Ошибка импорта");
                }
            });
            input.value = "";
        });
    }

    function init() {
        if (!Store || !UI) return;
        initTabs();
        initSave();
        initRevert();
        initExport();
        initImport();
        UI.setupUnloadWarning(function () { return Store.isDirty(); });
        renderPanel(currentPanelId);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    global.Admin = {
        registerPanel: registerPanel,
        renderPanel: renderPanel,
        getCurrentPanel: function () { return currentPanelId; }
    };
})(typeof window !== "undefined" ? window : this);
