/**
 * Генератор вопросов из персон (имя / инфо).
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
        while (uniq.length < count) uniq = uniq.concat(uniq.slice(0, count - uniq.length));
        return uniq.slice(0, count);
    }

    /**
     * @param {Array} paragraphs
     * @param {Object} options — { limit: number }
     */
    function generate(paragraphs, options) {
        if (!Array.isArray(paragraphs)) return [];
        var limit = (options && options.limit) || 999;
        var people = [];
        paragraphs.forEach(function (p) {
            if (p.people && Array.isArray(p.people)) {
                p.people.forEach(function (h) {
                    if (h && (h.name != null || h.info != null)) people.push({ name: String(h.name || "").trim(), info: String(h.info || "").trim() });
                });
            }
        });
        people = people.filter(function (h) { return h.name || h.info; });
        if (people.length === 0) return [];

        var names = people.map(function (h) { return h.name; });
        var infos = people.map(function (h) { return h.info; });
        var questions = [];

        people.forEach(function (h) {
            var variants = [];
            if (h.info) {
                var wrongInfos = pickWrongOptions(h.info, infos, 3);
                var opts = [h.info].concat(wrongInfos);
                shuffleArray(opts);
                var c = opts.indexOf(h.info);
                if (c === -1) c = 0;
                variants.push({ type: "choice", q: "Кто такой(ая) «" + h.name + "»?", a: opts, c: c });
                variants.push({ type: "input", q: "Кратко: кто такой(ая) «" + h.name + "»?", answer: h.info });
            }
            if (h.name) {
                var wrongNames = pickWrongOptions(h.name, names, 3);
                var optsN = [h.name].concat(wrongNames);
                shuffleArray(optsN);
                var cN = optsN.indexOf(h.name);
                if (cN === -1) cN = 0;
                variants.push({ type: "choice", q: "О ком идёт речь: «" + (h.info || "—") + "»?", a: optsN, c: cN });
                variants.push({ type: "input", q: "Назовите имя по описанию: «" + (h.info || "") + "»", answer: h.name });
            }
            if (variants.length > 0) {
                questions.push(variants[Math.floor(Math.random() * variants.length)]);
            }
        });

        shuffleArray(questions);
        return questions.slice(0, limit);
    }

    global.QuizGenerators = global.QuizGenerators || {};
    global.QuizGenerators.fromPeople = { generate: generate };
    if (typeof module !== "undefined" && module.exports) module.exports = { generate: generate };
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
