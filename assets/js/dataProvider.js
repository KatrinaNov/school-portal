/**
 * Подключение данных из localStorage (админ-панель).
 * Если в localStorage есть school-portal-data, CONFIG и Api берут данные оттуда вместо fetch.
 */
(function () {
    "use strict";

    var STORAGE_KEY = "school-portal-data";

    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        var data = JSON.parse(raw);
        if (!data || !data.config || !data.config.classes) return;

        window.CONFIG = { classes: data.config.classes };

        if (window.Api) {
            window.Api.getParagraphs = function (path) {
                var arr = (data.paragraphs && data.paragraphs[path]) || [];
                return Promise.resolve(arr);
            };
            window.Api.getQuiz = function (fullPath) {
                var quiz = (data.quizzes && data.quizzes[fullPath]) || null;
                if (!quiz) return Promise.reject(new Error("Тест не найден"));
                return Promise.resolve(quiz);
            };
        }
    } catch (e) {
        console.warn("dataProvider: не удалось загрузить данные из localStorage", e);
    }
})();
