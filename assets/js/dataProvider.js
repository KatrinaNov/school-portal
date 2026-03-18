/**
 * Подключение данных из localStorage (админ-панель).
 * Если в localStorage есть school-portal-data, пытаемся брать данные оттуда.
 *
 * Важно: localStorage может содержать неполный/устаревший набор данных.
 * Поэтому логика такая:
 * - CONFIG: аккуратно мерджим классы (localStorage имеет приоритет, но не удаляет новые предметы из data.js)
 * - Api.getParagraphs/getQuiz: сначала localStorage, иначе fallback на оригинальный fetch из api.js
 */
(function () {
    "use strict";

    var STORAGE_KEY = "school-portal-data";

    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var data = JSON.parse(raw);
        if (!data || !data.config || !data.config.classes) return;

        // Merge classes into existing CONFIG (do not wipe new subjects).
        // localStorage has priority for existing fields, but we keep subjects that exist only in data.js.
        if (window.CONFIG && window.CONFIG.classes && typeof window.CONFIG.classes === "object") {
            var merged = JSON.parse(JSON.stringify(window.CONFIG.classes));
            var fromLs = data.config.classes;
            for (var classId in fromLs) {
                if (!Object.prototype.hasOwnProperty.call(fromLs, classId)) continue;
                var incomingClass = fromLs[classId];
                if (!merged[classId]) {
                    merged[classId] = incomingClass;
                    continue;
                }
                // Merge class-level fields
                if (incomingClass && typeof incomingClass.name === "string" && incomingClass.name.trim()) {
                    merged[classId].name = incomingClass.name;
                }
                if (!merged[classId].subjects || typeof merged[classId].subjects !== "object") merged[classId].subjects = {};
                var inSubs = incomingClass && incomingClass.subjects ? incomingClass.subjects : {};
                for (var subId in inSubs) {
                    if (!Object.prototype.hasOwnProperty.call(inSubs, subId)) continue;
                    merged[classId].subjects[subId] = inSubs[subId];
                }
            }
            window.CONFIG = { classes: merged };
        } else {
            window.CONFIG = { classes: data.config.classes };
        }

        if (window.Api) {
            var originalGetParagraphs = window.Api.getParagraphs;
            var originalGetQuiz = window.Api.getQuiz;

            window.Api.getParagraphs = function (path) {
                if (data.paragraphs && Object.prototype.hasOwnProperty.call(data.paragraphs, path)) {
                    var stored = data.paragraphs[path];
                    // Если в localStorage пусто, не скрываем реальные данные из JSON/content.json.
                    if (Array.isArray(stored) && stored.length > 0) return Promise.resolve(stored);
                    return typeof originalGetParagraphs === "function"
                        ? originalGetParagraphs(path).then(function (fallback) {
                            return (Array.isArray(fallback) && fallback.length > 0) ? fallback : (Array.isArray(stored) ? stored : []);
                        })
                        : Promise.resolve(Array.isArray(stored) ? stored : []);
                }
                return typeof originalGetParagraphs === "function" ? originalGetParagraphs(path) : Promise.resolve([]);
            };

            window.Api.getQuiz = function (fullPath) {
                if (data.quizzes && Object.prototype.hasOwnProperty.call(data.quizzes, fullPath)) {
                    var q = data.quizzes[fullPath];
                    if (q) return Promise.resolve(q);
                }
                return typeof originalGetQuiz === "function"
                    ? originalGetQuiz(fullPath)
                    : Promise.reject(new Error("Тест не найден"));
            };
        }
    } catch (e) {
        console.warn("dataProvider: не удалось загрузить данные из localStorage", e);
    }
})();
