/**
 * Адаптер целевого формата content.json (ROADMAP 3.2).
 * Приводит единый content.json к виду, ожидаемому приложением:
 * - paragraphs[] с quizzes: [{ title, file }] (file = id + ".json" для совместимости с getQuiz)
 * - тесты кладутся в кэш по ключу path + id + ".json"
 */
var ContentAdapter = (function () {
    "use strict";

    function ensureArray(val) {
        return Array.isArray(val) ? val : [];
    }

    function ensureString(val) {
        return val != null ? String(val) : "";
    }

    /**
     * Нормализует один параграф из content.json: добавляет недостающие поля,
     * приводит ссылки на тесты к виду { title, file }.
     */
    function normalizeParagraph(p, quizzesById) {
        var refs = ensureArray(p.quizzes);
        var normalizedRefs = refs.map(function (ref) {
            var id = ref.id != null ? String(ref.id) : (ref.file ? String(ref.file).replace(/\.json$/i, "") : "");
            var title = ref.title != null ? String(ref.title) : (quizzesById[id] && quizzesById[id].title ? quizzesById[id].title : "");
            var file = id ? id + ".json" : (ref.file || "");
            return { title: title, file: file };
        }).filter(function (r) { return r.file; });

        return {
            id: ensureString(p.id),
            title: ensureString(p.title),
            summary: ensureString(p.summary),
            image: p.image != null ? p.image : null,
            sections: ensureArray(p.sections).map(function (s) {
                return {
                    title: ensureString(s.title),
                    content: ensureString(s.content),
                    image: s && s.image != null ? s.image : null
                };
            }),
            dates: ensureArray(p.dates).map(function (d) {
                return {
                    id: d.id != null ? String(d.id) : undefined,
                    year: ensureString(d.year),
                    event: ensureString(d.event),
                    image: d && d.image != null ? d.image : null
                };
            }),
            terms: ensureArray(p.terms).map(function (t) {
                return {
                    id: t.id != null ? String(t.id) : undefined,
                    term: ensureString(t.term),
                    definition: ensureString(t.definition),
                    image: t && t.image != null ? t.image : null
                };
            }),
            people: ensureArray(p.people).map(function (h) {
                return {
                    id: h.id != null ? String(h.id) : undefined,
                    name: ensureString(h.name),
                    info: ensureString(h.info),
                    image: h && h.image != null ? h.image : null
                };
            }),
            quizzes: normalizedRefs
        };
    }

    /**
     * Нормализует тест из content.json к виду { title, questions } для кэша Api.
     */
    function normalizeQuiz(q) {
        return {
            title: ensureString(q.title),
            questions: ensureArray(q.questions)
        };
    }

    /**
     * Проверяет, что объект похож на content.json (version, paragraphs, quizzes).
     */
    function isContentFormat(obj) {
        if (!obj || typeof obj !== "object") return false;
        if (obj.version !== 1 && obj.version != null) return false;
        if (!Array.isArray(obj.paragraphs) || !Array.isArray(obj.quizzes)) return false;
        return true;
    }

    /**
     * Нормализует content.json в формат приложения.
     * @param {object} content — распарсенный content.json
     * @param {string} path — путь предмета (например "data/6/english/")
     * @returns {{ paragraphs: Array, quizCacheEntries: Array<{key: string, value: object}> }}
     */
    function normalize(content, path) {
        if (!isContentFormat(content)) {
            return { paragraphs: [], quizCacheEntries: [] };
        }

        var quizzesById = {};
        content.quizzes.forEach(function (q) {
            var id = q.id != null ? String(q.id) : "";
            if (id) quizzesById[id] = q;
        });

        var paragraphs = content.paragraphs.map(function (p) {
            return normalizeParagraph(p, quizzesById);
        });

        var quizCacheEntries = [];
        content.quizzes.forEach(function (q) {
            var id = q.id != null ? String(q.id) : "";
            if (!id) return;
            var key = path + id + ".json";
            quizCacheEntries.push({ key: key, value: normalizeQuiz(q) });
        });

        return { paragraphs: paragraphs, quizCacheEntries: quizCacheEntries };
    }

    return {
        isContentFormat: isContentFormat,
        normalize: normalize
    };
})();
