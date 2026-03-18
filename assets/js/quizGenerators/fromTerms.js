/**
 * Генератор вопросов из терминов (термин / определение).
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
        var normalized = String(correct).trim().toLowerCase();
        var others = pool.filter(function (x) { return String(x).trim().toLowerCase() !== normalized; });
        var uniq = [];
        var seen = {};
        others.forEach(function (x) {
            var s = String(x).trim().toLowerCase();
            if (!seen[s]) { seen[s] = true; uniq.push(x); }
        });
        shuffleArray(uniq);
        // If there are no alternative options, avoid infinite loop.
        if (uniq.length === 0) return Array(count).fill(correct);
        while (uniq.length < count) uniq = uniq.concat(uniq.slice(0, count - uniq.length));
        return uniq.slice(0, count);
    }

    function generate(paragraphs, options) {
        if (!Array.isArray(paragraphs)) return [];
        var limit = (options && options.limit) || 999;
        var terms = [];
        paragraphs.forEach(function (p) {
            if (p.terms && Array.isArray(p.terms)) {
                p.terms.forEach(function (t) {
                    if (t && (t.term != null || t.definition != null)) terms.push({ term: String(t.term || "").trim(), definition: String(t.definition || "").trim() });
                });
            }
        });
        terms = terms.filter(function (t) { return t.term || t.definition; });
        if (terms.length === 0) return [];

        var termStrs = terms.map(function (t) { return t.term; });
        var defStrs = terms.map(function (t) { return t.definition; });
        var questions = [];

        terms.forEach(function (t) {
            var variants = [];
            if (t.definition) {
                var wrongDefs = pickWrongOptions(t.definition, defStrs, 3);
                var opts = [t.definition].concat(wrongDefs);
                shuffleArray(opts);
                var c = opts.indexOf(t.definition);
                if (c === -1) c = 0;
                variants.push({ type: "choice", q: "Что такое «" + t.term + "»?", a: opts, c: c });
                variants.push({ type: "input", q: "Дайте определение термину «" + t.term + "»", answer: t.definition });
            }
            if (t.term) {
                var wrongTerms = pickWrongOptions(t.term, termStrs, 3);
                var optsT = [t.term].concat(wrongTerms);
                shuffleArray(optsT);
                var cT = optsT.indexOf(t.term);
                if (cT === -1) cT = 0;
                variants.push({ type: "choice", q: "Как называется: «" + t.definition + "»?", a: optsT, c: cT });
                variants.push({ type: "input", q: "Назовите термин по определению: «" + t.definition + "»", answer: t.term });
            }
            if (variants.length > 0) {
                questions.push(variants[Math.floor(Math.random() * variants.length)]);
            }
        });

        shuffleArray(questions);
        return questions.slice(0, limit);
    }

    global.QuizGenerators = global.QuizGenerators || {};
    global.QuizGenerators.fromTerms = { generate: generate };
    if (typeof module !== "undefined" && module.exports) module.exports = { generate: generate };
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
