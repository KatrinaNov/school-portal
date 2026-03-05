/**
 * Data layer: загрузка и кэширование JSON.
 * Повторные переходы "Назад" не делают повторный fetch.
 */
var Api = (function () {
    var cache = {};

    function fetchJson(url) {
        return fetch(url).then(function (res) {
            if (!res.ok) throw new Error("Ошибка загрузки: " + res.status);
            return res.json();
        });
    }

    function getCached(key, fetchFn) {
        if (cache[key]) return Promise.resolve(cache[key]);
        return fetchFn().then(function (data) {
            cache[key] = data;
            return data;
        });
    }

    function getParagraphs(path) {
        var key = path + "paragraphs.json";
        return getCached(key, function () {
            return fetchJson(key);
        });
    }

    function getQuiz(fullPath) {
        return getCached(fullPath, function () {
            return fetchJson(fullPath);
        });
    }

    return {
        getParagraphs: getParagraphs,
        getQuiz: getQuiz
    };
})();
