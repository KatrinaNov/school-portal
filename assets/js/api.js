/**
 * Data layer: загрузка и кэширование JSON.
 * Поддерживает целевой формат content.json (ROADMAP 3.2) с fallback на paragraphs.json + quiz-*.json.
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

    /**
     * Загрузка параграфов: сначала пробуем content.json (единый формат v1),
     * при отсутствии или ошибке — paragraphs.json.
     */
    function getParagraphs(path) {
        var paragraphsKey = path + "paragraphs.json";
        if (cache[paragraphsKey]) return Promise.resolve(cache[paragraphsKey]);

        var contentUrl = path + "content.json";
        return fetch(contentUrl)
            .then(function (res) {
                if (!res.ok) throw new Error("content.json not found");
                return res.json();
            })
            .then(function (data) {
                if (typeof ContentAdapter !== "undefined" && ContentAdapter.isContentFormat && ContentAdapter.isContentFormat(data)) {
                    var result = ContentAdapter.normalize(data, path);
                    cache[paragraphsKey] = result.paragraphs;
                    (result.quizCacheEntries || []).forEach(function (entry) {
                        cache[entry.key] = entry.value;
                    });
                    return result.paragraphs;
                }
                throw new Error("Not content format");
            })
            .catch(function () {
                return getCached(paragraphsKey, function () {
                    return fetchJson(paragraphsKey);
                });
            });
    }

    function getQuiz(fullPath) {
        return getCached(fullPath, function () {
            return fetchJson(fullPath);
        });
    }

    /** Сброс кэша (для разработки: после изменения JSON обновить данные без перезагрузки вкладки). */
    function clearCache() {
        cache = {};
    }

    return {
        getParagraphs: getParagraphs,
        getQuiz: getQuiz,
        clearCache: clearCache
    };
})();
