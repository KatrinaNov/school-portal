/**
 * Оркестратор генераторов тестов: выбор типа (параграфы / даты / термины / персоны / комбинированный),
 * сбор вопросов и лимит. Не зависит от DOM; использует Api и QuizGenerators.*.generate.
 */
(function (global) {
    "use strict";

    var Engine = global.QuizEngine;
    var Api = global.Api;
    var G = global.QuizGenerators;

    var DEFAULT_LIMIT = 20;
    var SOURCE_PARAGRAPHS = "paragraphs";
    var SOURCE_DATES = "dates";
    var SOURCE_TERMS = "terms";
    var SOURCE_PEOPLE = "people";
    var SOURCE_COMBINED = "combined";

    function shuffleArray(arr) {
        if (Engine && Engine.shuffleArray) return Engine.shuffleArray(arr);
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function takeRandom(questions, limit) {
        if (Engine && Engine.takeRandomQuestions) return Engine.takeRandomQuestions(questions, limit);
        if (!Array.isArray(questions) || questions.length <= limit) return questions.slice();
        return shuffleArray(questions).slice(0, limit);
    }

    /**
     * Генерация теста из привязанных к параграфам готовых тестов (текущая логика).
     */
    function fromParagraphsAsync(paragraphs, selectedIds, subjectPath, limit) {
        var selected = paragraphs.filter(function (p) { return selectedIds.indexOf(String(p.id)) !== -1; });
        var quizPromises = [];
        selected.forEach(function (p) {
            if (p.quizzes && p.quizzes.length) {
                p.quizzes.forEach(function (q) {
                    var file = q.file || (q.id ? q.id + ".json" : "");
                    if (file) quizPromises.push(Api.getQuiz(subjectPath + file));
                });
            }
        });
        if (quizPromises.length === 0) return Promise.resolve([]);
        return Promise.all(quizPromises).then(function (quizzes) {
            var all = [];
            quizzes.forEach(function (q) {
                if (q && q.questions && q.questions.length) all = all.concat(q.questions);
            });
            return takeRandom(all, limit || DEFAULT_LIMIT);
        });
    }

    /**
     * Запуск генерации по типу источника.
     * @param {string} sourceType — paragraphs | dates | terms | people | combined
     * @param {string} subjectPath — путь предмета (data/6/history/)
     * @param {Array<string>} selectedIds — id выбранных параграфов
     * @param {Object} options — { limit: number }
     * @returns {Promise<{ title: string, questions: Array }>}
     */
    function run(sourceType, subjectPath, selectedIds, options) {
        var limit = (options && options.limit) || DEFAULT_LIMIT;
        if (!Api || !Api.getParagraphs) return Promise.reject(new Error("Api.getParagraphs недоступен"));

        return Api.getParagraphs(subjectPath).then(function (paragraphs) {
            var selected = paragraphs.filter(function (p) { return selectedIds.indexOf(String(p.id)) !== -1; });
            if (selected.length === 0) return { title: "Свой тест", questions: [] };

            var title = "Свой тест";
            if (sourceType === SOURCE_DATES) title = "Тест по датам";
            else if (sourceType === SOURCE_TERMS) title = "Тест по понятиям";
            else if (sourceType === SOURCE_PEOPLE) title = "Тест по персонам";
            else if (sourceType === SOURCE_COMBINED) title = "Тест: даты, понятия, персоны";

            if (sourceType === SOURCE_PARAGRAPHS) {
                return fromParagraphsAsync(paragraphs, selectedIds, subjectPath, limit).then(function (questions) {
                    return { title: title, questions: questions };
                });
            }

            var questions = [];
            if (sourceType === SOURCE_DATES && G && G.fromDates && G.fromDates.generate) {
                questions = questions.concat(G.fromDates.generate(selected, { limit: limit }));
            }
            if (sourceType === SOURCE_TERMS && G && G.fromTerms && G.fromTerms.generate) {
                questions = questions.concat(G.fromTerms.generate(selected, { limit: limit }));
            }
            if (sourceType === SOURCE_PEOPLE && G && G.fromPeople && G.fromPeople.generate) {
                questions = questions.concat(G.fromPeople.generate(selected, { limit: limit }));
            }
            if (sourceType === SOURCE_COMBINED) {
                if (G && G.fromDates && G.fromDates.generate) questions = questions.concat(G.fromDates.generate(selected, { limit: 999 }));
                if (G && G.fromTerms && G.fromTerms.generate) questions = questions.concat(G.fromTerms.generate(selected, { limit: 999 }));
                if (G && G.fromPeople && G.fromPeople.generate) questions = questions.concat(G.fromPeople.generate(selected, { limit: 999 }));
                questions = takeRandom(questions, limit);
            } else {
                questions = takeRandom(questions, limit);
            }

            return Promise.resolve({ title: title, questions: questions });
        });
    }

    function hasAnyData(paragraphs, selectedIds) {
        var selected = paragraphs.filter(function (p) { return selectedIds.indexOf(String(p.id)) !== -1; });
        var hasQuizzes = selected.some(function (p) { return p.quizzes && p.quizzes.length; });
        var hasDates = selected.some(function (p) { return p.dates && p.dates.length; });
        var hasTerms = selected.some(function (p) { return p.terms && p.terms.length; });
        var hasPeople = selected.some(function (p) { return p.people && p.people.length; });
        return {
            paragraphs: hasQuizzes,
            dates: hasDates,
            terms: hasTerms,
            people: hasPeople,
            combined: hasDates || hasTerms || hasPeople
        };
    }

    global.QuizGenerators = G || {};
    global.QuizGenerators.run = run;
    global.QuizGenerators.hasAnyData = hasAnyData;
    global.QuizGenerators.SOURCE_PARAGRAPHS = SOURCE_PARAGRAPHS;
    global.QuizGenerators.SOURCE_DATES = SOURCE_DATES;
    global.QuizGenerators.SOURCE_TERMS = SOURCE_TERMS;
    global.QuizGenerators.SOURCE_PEOPLE = SOURCE_PEOPLE;
    global.QuizGenerators.SOURCE_COMBINED = SOURCE_COMBINED;
})(typeof window !== "undefined" ? window : this);
