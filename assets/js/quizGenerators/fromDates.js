/**
 * Генератор вопросов из дат параграфов (год / событие).
 * Чистая функция: paragraphs → questions (формат движка: choice / input).
 */
(function (global) {
    "use strict";

    var Engine = global.QuizEngine;

    function shuffleArray(arr) {
        if (typeof Engine !== "undefined" && Engine.shuffleArray) return Engine.shuffleArray(arr);
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function pickWrongOptions(correct, pool, count) {
        var normalized = String(correct).trim();
        var others = pool.filter(function (x) { return String(x).trim() !== normalized; });
        var uniq = [];
        var seen = {};
        others.forEach(function (x) {
            var s = String(x).trim();
            if (!seen[s]) { seen[s] = true; uniq.push(x); }
        });
        shuffleArray(uniq);
        while (uniq.length < count) uniq = uniq.concat(uniq.slice(0, count - uniq.length));
        return uniq.slice(0, count);
    }

    /**
     * @param {Array} paragraphs — массив параграфов с полем dates[]
     * @param {Object} options — { limit: number }
     * @returns {Array} questions
     */
    function generate(paragraphs, options) {
        if (!Array.isArray(paragraphs)) return [];
        var limit = (options && options.limit) || 999;
        var dates = [];
        paragraphs.forEach(function (p) {
            if (p.dates && Array.isArray(p.dates)) {
                p.dates.forEach(function (d) {
                    if (d && (d.year != null || d.event != null)) dates.push({ year: String(d.year || "").trim(), event: String(d.event || "").trim() });
                });
            }
        });
        dates = dates.filter(function (d) { return d.year || d.event; });
        if (dates.length === 0) return [];

        var years = dates.map(function (d) { return d.year; });
        var events = dates.map(function (d) { return d.event; });
        var questions = [];

        dates.forEach(function (d) {
            var variants = [];
            if (d.event) {
                var wrongYears = pickWrongOptions(d.year, years, 3);
                var opts = [d.year].concat(wrongYears);
                shuffleArray(opts);
                var c = opts.indexOf(d.year);
                if (c === -1) c = 0;
                variants.push({ type: "choice", q: "В каком году произошло: «" + d.event + "»?", a: opts, c: c });
                variants.push({ type: "input", q: "Напишите год события: «" + d.event + "»", answer: d.year });
            }
            if (d.year) {
                var wrongEvents = pickWrongOptions(d.event, events, 3);
                var optsEv = [d.event].concat(wrongEvents);
                shuffleArray(optsEv);
                var cEv = optsEv.indexOf(d.event);
                if (cEv === -1) cEv = 0;
                variants.push({ type: "choice", q: "Какое событие произошло в " + d.year + " году?", a: optsEv, c: cEv });
                variants.push({ type: "input", q: "Напишите событие для года " + d.year, answer: d.event });
            }
            if (variants.length > 0) {
                questions.push(variants[Math.floor(Math.random() * variants.length)]);
            }
        });

        shuffleArray(questions);
        return questions.slice(0, limit);
    }

    global.QuizGenerators = global.QuizGenerators || {};
    global.QuizGenerators.fromDates = { generate: generate };
    if (typeof module !== "undefined" && module.exports) module.exports = { generate: generate };
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
