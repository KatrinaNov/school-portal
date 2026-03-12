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
        if (!path || typeof path !== "string") return Promise.reject(new Error("Путь не указан"));
        path = path.replace(/\/?$/, "/");
        var paragraphsKey = path + "paragraphs.json";
        if (cache[paragraphsKey]) return Promise.resolve(cache[paragraphsKey]);

        var contentUrl = path + "content.json";

        function loadParagraphsFallback() {
            return getCached(paragraphsKey, function () {
                return fetchJson(paragraphsKey);
            }).then(function (data) {
                return Array.isArray(data) ? data : [];
            });
        }

        return fetch(contentUrl)
            .then(function (res) {
                if (!res.ok) throw new Error("content.json not found");
                return res.json();
            })
            .then(function (data) {
                if (!data || typeof data !== "object") throw new Error("Invalid content");
                if (typeof ContentAdapter !== "undefined" && ContentAdapter.isContentFormat && ContentAdapter.isContentFormat(data)) {
                    try {
                        var result = ContentAdapter.normalize(data, path);
                        var list = result && result.paragraphs;
                        if (!Array.isArray(list)) return loadParagraphsFallback();
                        cache[paragraphsKey] = list;
                        (result.quizCacheEntries || []).forEach(function (entry) {
                            cache[entry.key] = entry.value;
                        });
                        return list;
                    } catch (e) {
                        return loadParagraphsFallback();
                    }
                }
                throw new Error("Not content format");
            })
            .catch(function () {
                return loadParagraphsFallback();
            });
    }

    /**
     * Загрузка теста по пути (например data/0/minecraft/quiz-minecraft-basics.json).
     * Сначала проверяется кэш, затем файл. Если файла нет (тест только в content.json),
     * загружаем content.json и подставляем тест из кэша адаптера.
     */
    function getQuiz(fullPath) {
        if (cache[fullPath]) return Promise.resolve(cache[fullPath]);
        return fetch(fullPath)
            .then(function (res) {
                if (res.ok) return res.json();
                throw new Error("Not found");
            })
            .then(function (data) {
                cache[fullPath] = data;
                return data;
            })
            .catch(function () {
                var dir = fullPath.lastIndexOf("/") !== -1 ? fullPath.substring(0, fullPath.lastIndexOf("/") + 1) : "";
                if (!dir || typeof ContentAdapter === "undefined" || !ContentAdapter.isContentFormat || !ContentAdapter.normalize) {
                    return Promise.reject(new Error("Тест не найден"));
                }
                return fetch(dir + "content.json")
                    .then(function (res) {
                        if (!res.ok) throw new Error("content.json not found");
                        return res.json();
                    })
                    .then(function (content) {
                        if (!ContentAdapter.isContentFormat(content)) throw new Error("Invalid content");
                        var result = ContentAdapter.normalize(content, dir);
                        (result.quizCacheEntries || []).forEach(function (entry) {
                            cache[entry.key] = entry.value;
                        });
                        if (cache[fullPath]) return cache[fullPath];
                        return Promise.reject(new Error("Тест не найден"));
                    });
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
