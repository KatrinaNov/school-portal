/**
 * Хранилище данных Admin: localStorage + in-memory, экспорт/импорт файла.
 */
(function (global) {
    "use strict";

    var Schema = global.AdminSchema;
    var Sanitize = global.AdminSanitize;
    if (!Schema || !Sanitize) throw new Error("Admin: schema and sanitize required");

    var key = Schema.getStorageKey();
    var inMemory = null; // { config, paragraphs, quizzes } или null
    var dirty = false;

    function loadFromStorage() {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!Schema.validateFullData(data).valid) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    /**
     * Перезагрузить inMemory из localStorage (после сохранения — синхронизация).
     */
    function reloadFromStorage() {
        var fromStorage = loadFromStorage();
        if (fromStorage) inMemory = cloneDeep(fromStorage);
    }

    /**
     * Получить текущие данные (из памяти или localStorage). Если пусто — пустая структура.
     */
    function getData() {
        if (inMemory) return cloneDeep(inMemory);
        var fromStorage = loadFromStorage();
        if (fromStorage) {
            inMemory = fromStorage;
            return cloneDeep(fromStorage);
        }
        inMemory = Schema.createEmpty();
        return cloneDeep(inMemory);
    }

    function cloneDeep(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Установить данные в память (без сохранения). Для импорта после валидации.
     */
    function setData(data) {
        if (!data || !Schema.validateFullData(data).valid) return false;
        inMemory = cloneDeep(data);
        dirty = true;
        return true;
    }

    /**
     * Заменить текущие данные (после редактирования в UI). Валидация не полная — только структура.
     */
    function replaceData(data) {
        if (!data || !Schema.isObject(data.config) || !Schema.isObject(data.paragraphs) || !Schema.isObject(data.quizzes)) {
            return false;
        }
        inMemory = cloneDeep(data);
        dirty = true;
        return true;
    }

    /**
     * Сохранить текущее состояние в localStorage.
     */
    function save() {
        var toSave = inMemory || getData();
        try {
            localStorage.setItem(key, JSON.stringify(toSave));
            dirty = false;
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Отменить изменения: перезагрузить из localStorage или сбросить на пустое.
     */
    function revert() {
        var fromStorage = loadFromStorage();
        inMemory = fromStorage ? cloneDeep(fromStorage) : Schema.createEmpty();
        dirty = false;
    }

    function isDirty() {
        return dirty;
    }

    function setDirty(value) {
        dirty = value === true;
    }

    /**
     * Экспорт в JSON и скачивание файла.
     */
    function exportToFile() {
        var data = inMemory || getData();
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "school-portal-data.json";
        a.click();
        URL.revokeObjectURL(a.href);
    }

    /**
     * Импорт из файла. Возвращает Promise<{ success, error? }>.
     */
    function importFromFile(file) {
        return new Promise(function (resolve) {
            if (!file || !(file instanceof File)) {
                resolve({ success: false, error: "Файл не выбран" });
                return;
            }
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var data = JSON.parse(reader.result);
                    var validation = Schema.validateFullData(data);
                    if (!validation.valid) {
                        resolve({ success: false, error: validation.error });
                        return;
                    }
                    if (!setData(data)) {
                        resolve({ success: false, error: "Ошибка применения данных" });
                        return;
                    }
                    if (!save()) {
                        resolve({ success: false, error: "Ошибка сохранения в localStorage" });
                        return;
                    }
                    reloadFromStorage();
                    resolve({ success: true });
                } catch (e) {
                    resolve({ success: false, error: "Неверный JSON: " + (e.message || "ошибка") });
                }
            };
            reader.onerror = function () {
                resolve({ success: false, error: "Ошибка чтения файла" });
            };
            reader.readAsText(file, "UTF-8");
        });
    }

    /**
     * Получить все path предметов из config.
     */
    function getAllSubjectPaths() {
        var data = getData();
        var paths = [];
        var classes = data.config && data.config.classes;
        if (!classes) return paths;
        for (var classId in classes) {
            if (!Object.prototype.hasOwnProperty.call(classes, classId)) continue;
            var subs = classes[classId].subjects;
            if (!subs) continue;
            for (var subId in subs) {
                if (!Object.prototype.hasOwnProperty.call(subs, subId)) continue;
                var path = subs[subId].path;
                if (path) paths.push(path);
            }
        }
        return paths;
    }

    /**
     * Полный путь к файлу теста: path + fileName.
     */
    function quizFullPath(subjectPath, fileName) {
        var path = subjectPath || "";
        if (path && path.charAt(path.length - 1) !== "/") path += "/";
        return path + (fileName || "");
    }

    global.AdminStore = {
        getData: getData,
        setData: setData,
        replaceData: replaceData,
        save: save,
        revert: revert,
        reloadFromStorage: reloadFromStorage,
        isDirty: isDirty,
        setDirty: setDirty,
        exportToFile: exportToFile,
        importFromFile: importFromFile,
        getAllSubjectPaths: getAllSubjectPaths,
        quizFullPath: quizFullPath,
        loadFromStorage: loadFromStorage
    };
})(typeof window !== "undefined" ? window : this);
