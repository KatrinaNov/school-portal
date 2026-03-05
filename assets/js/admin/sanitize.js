/**
 * Санитизация ввода для Admin Panel (XSS и нормализация).
 */
(function (global) {
    "use strict";

    function escapeHtml(str) {
        if (str == null || typeof str !== "string") return "";
        var div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML.replace(/"/g, "&quot;");
    }

    /**
     * Нормализация строки: trim, ограничение длины (по умолчанию 10000).
     */
    function sanitizeString(str, maxLength) {
        if (str == null) return "";
        var s = String(str).trim();
        var max = (typeof maxLength === "number" && maxLength > 0) ? maxLength : 10000;
        if (s.length > max) s = s.slice(0, max);
        return s;
    }

    /**
     * Санитизация id (латиница, цифры, дефис, подчёркивание).
     */
    function sanitizeId(str) {
        var s = sanitizeString(str, 200);
        return s.replace(/[^\w\-]/g, "");
    }

    /**
     * Санитизация пути (для path subject: data/2/math/).
     */
    function sanitizePath(str) {
        var s = sanitizeString(str, 500);
        if (s && s.charAt(s.length - 1) !== "/") s += "/";
        return s.replace(/\/+/g, "/");
    }

    /**
     * Санитизация имени файла теста (без пути).
     */
    function sanitizeQuizFileName(str) {
        var s = sanitizeString(str, 200);
        if (!/\.json$/i.test(s)) s += ".json";
        return s.replace(/[^\w\-\.]/g, "");
    }

    /**
     * Санитизация объекта параграфа (все строковые поля).
     */
    function sanitizeParagraph(p) {
        if (!p || typeof p !== "object") return null;
        var out = {
            id: sanitizeId(p.id) || "id-" + Date.now(),
            title: sanitizeString(p.title, 500),
            summary: sanitizeString(p.summary, 5000),
            sections: [],
            dates: [],
            terms: [],
            people: [],
            examples: [],
            quizzes: []
        };
        if (Array.isArray(p.sections)) {
            p.sections.forEach(function (s) {
                if (s && typeof s === "object") {
                    out.sections.push({
                        title: sanitizeString(s.title, 500),
                        content: sanitizeString(s.content, 10000)
                    });
                }
            });
        }
        if (Array.isArray(p.dates)) {
            p.dates.forEach(function (d) {
                if (d && typeof d === "object") {
                    out.dates.push({
                        year: sanitizeString(d.year, 50),
                        event: sanitizeString(d.event, 500)
                    });
                }
            });
        }
        if (Array.isArray(p.terms)) {
            p.terms.forEach(function (t) {
                if (t && typeof t === "object") {
                    out.terms.push({
                        term: sanitizeString(t.term, 300),
                        definition: sanitizeString(t.definition, 2000)
                    });
                }
            });
        }
        if (Array.isArray(p.people)) {
            p.people.forEach(function (pers) {
                if (pers && typeof pers === "object") {
                    out.people.push({
                        name: sanitizeString(pers.name, 200),
                        info: sanitizeString(pers.info, 2000)
                    });
                }
            });
        }
        if (Array.isArray(p.examples)) {
            p.examples.forEach(function (ex) {
                if (ex != null) out.examples.push(sanitizeString(String(ex), 1000));
            });
        }
        if (Array.isArray(p.quizzes)) {
            p.quizzes.forEach(function (q) {
                if (q && typeof q === "object") {
                    out.quizzes.push({
                        title: sanitizeString(q.title, 300),
                        file: sanitizeQuizFileName(q.file || "")
                    });
                }
            });
        }
        return out;
    }

    /**
     * Санитизация вопроса теста.
     */
    function sanitizeQuestion(q) {
        if (!q || typeof q !== "object") return null;
        var type = (q.type === "input" || q.type === "choice") ? q.type : "choice";
        var out = {
            type: type,
            q: sanitizeString(q.q, 2000)
        };
        if (type === "choice") {
            var a = Array.isArray(q.a) ? q.a : [];
            out.a = a.map(function (v) { return sanitizeString(String(v), 500); });
            var c = parseInt(q.c, 10);
            if (isNaN(c) || c < 0 || c >= out.a.length) c = 0;
            out.c = c;
        } else {
            var answers = q.answers || (q.answer != null ? [q.answer] : []);
            if (!Array.isArray(answers)) answers = [answers];
            out.answers = answers.map(function (v) { return sanitizeString(String(v), 500); });
            if (out.answers.length === 0) out.answers = [""];
        }
        return out;
    }

    /**
     * Санитизация теста.
     */
    function sanitizeQuiz(quiz) {
        if (!quiz || typeof quiz !== "object") return null;
        var out = {
            title: sanitizeString(quiz.title, 500),
            questions: []
        };
        if (Array.isArray(quiz.questions)) {
            quiz.questions.forEach(function (q) {
                var sq = sanitizeQuestion(q);
                if (sq) out.questions.push(sq);
            });
        }
        return out;
    }

    global.AdminSanitize = {
        escapeHtml: escapeHtml,
        sanitizeString: sanitizeString,
        sanitizeId: sanitizeId,
        sanitizePath: sanitizePath,
        sanitizeQuizFileName: sanitizeQuizFileName,
        sanitizeParagraph: sanitizeParagraph,
        sanitizeQuestion: sanitizeQuestion,
        sanitizeQuiz: sanitizeQuiz
    };
})(typeof window !== "undefined" ? window : this);
