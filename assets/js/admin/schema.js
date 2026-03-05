/**
 * Схема данных и валидация структуры для Admin Panel.
 * Единый JSON: config (classes/subjects) + paragraphs по path + quizzes по path.
 */
(function (global) {
    "use strict";

    var STORAGE_KEY = "school-portal-data";

    function getStorageKey() {
        return STORAGE_KEY;
    }

    /**
     * Минимальная валидная структура данных.
     */
    function createEmpty() {
        return {
            config: {
                classes: {}
            },
            paragraphs: {},
            quizzes: {}
        };
    }

    /**
     * Проверка: объект и не null.
     */
    function isObject(v) {
        return v !== null && typeof v === "object" && !Array.isArray(v);
    }

    /**
     * Валидация config (classes → subjects с name, path).
     */
    function validateConfig(config) {
        if (!isObject(config) || !isObject(config.classes)) {
            return { valid: false, error: "config.classes должен быть объектом" };
        }
        var classes = config.classes;
        for (var classId in classes) {
            if (!Object.prototype.hasOwnProperty.call(classes, classId)) continue;
            var c = classes[classId];
            if (!isObject(c) || typeof c.name !== "string" || !c.name.trim()) {
                return { valid: false, error: "Класс " + classId + ": нужен непустой name" };
            }
            if (!isObject(c.subjects)) {
                return { valid: false, error: "Класс " + classId + ": subjects должен быть объектом" };
            }
            for (var subId in c.subjects) {
                if (!Object.prototype.hasOwnProperty.call(c.subjects, subId)) continue;
                var s = c.subjects[subId];
                if (!isObject(s) || typeof s.name !== "string" || !s.name.trim()) {
                    return { valid: false, error: "Предмет " + subId + ": нужен непустой name" };
                }
                if (typeof s.path !== "string" || !s.path.trim()) {
                    return { valid: false, error: "Предмет " + subId + ": нужен непустой path" };
                }
            }
        }
        return { valid: true };
    }

    /**
     * Валидация одного параграфа.
     */
    function validateParagraph(p, paragraphIds, pathKey) {
        if (!isObject(p)) return { valid: false, error: "Параграф должен быть объектом" };
        var id = p.id != null ? String(p.id).trim() : "";
        if (!id) return { valid: false, error: "У параграфа должен быть id" };
        if (paragraphIds[id]) {
            return { valid: false, error: "Дубликат id параграфа: " + id };
        }
        paragraphIds[id] = true;
        if (typeof p.title !== "string") return { valid: false, error: "Параграф " + id + ": title должен быть строкой" };
        if (typeof p.summary !== "string") return { valid: false, error: "Параграф " + id + ": summary должен быть строкой" };
        if (p.sections !== undefined && p.sections !== null && !Array.isArray(p.sections)) {
            return { valid: false, error: "Параграф " + id + ": sections должен быть массивом" };
        }
        if (p.sections) {
            for (var i = 0; i < p.sections.length; i++) {
                var sec = p.sections[i];
                if (!isObject(sec) || typeof sec.title !== "string" || typeof sec.content !== "string") {
                    return { valid: false, error: "Параграф " + id + ": sections[" + i + "] — title и content строки" };
                }
            }
        }
        if (p.dates !== undefined && p.dates !== null && !Array.isArray(p.dates)) {
            return { valid: false, error: "Параграф " + id + ": dates должен быть массивом" };
        }
        if (p.dates) {
            for (var j = 0; j < p.dates.length; j++) {
                var d = p.dates[j];
                if (!isObject(d) || typeof d.year !== "string" || typeof d.event !== "string") {
                    return { valid: false, error: "Параграф " + id + ": dates[" + j + "] — year и event строки" };
                }
            }
        }
        if (p.terms !== undefined && p.terms !== null && !Array.isArray(p.terms)) {
            return { valid: false, error: "Параграф " + id + ": terms должен быть массивом" };
        }
        if (p.terms) {
            for (var k = 0; k < p.terms.length; k++) {
                var t = p.terms[k];
                if (!isObject(t) || typeof t.term !== "string" || typeof t.definition !== "string") {
                    return { valid: false, error: "Параграф " + id + ": terms[" + k + "] — term и definition строки" };
                }
            }
        }
        if (p.people !== undefined && p.people !== null && !Array.isArray(p.people)) {
            return { valid: false, error: "Параграф " + id + ": people должен быть массивом" };
        }
        if (p.people) {
            for (var m = 0; m < p.people.length; m++) {
                var pers = p.people[m];
                if (!isObject(pers) || typeof pers.name !== "string" || typeof pers.info !== "string") {
                    return { valid: false, error: "Параграф " + id + ": people[" + m + "] — name и info строки" };
                }
            }
        }
        if (p.quizzes !== undefined && p.quizzes !== null && !Array.isArray(p.quizzes)) {
            return { valid: false, error: "Параграф " + id + ": quizzes должен быть массивом" };
        }
        if (p.quizzes) {
            for (var qq = 0; qq < p.quizzes.length; qq++) {
                var qref = p.quizzes[qq];
                if (!isObject(qref) || typeof qref.title !== "string" || typeof qref.file !== "string" || !qref.file.trim()) {
                    return { valid: false, error: "Параграф " + id + ": quizzes[" + qq + "] — title и file (непустой) строки" };
                }
            }
        }
        return { valid: true };
    }

    /**
     * Валидация paragraphs по path.
     */
    function validateParagraphs(paragraphsObj) {
        if (!isObject(paragraphsObj)) return { valid: false, error: "paragraphs должен быть объектом" };
        var paragraphIds = {};
        for (var pathKey in paragraphsObj) {
            if (!Object.prototype.hasOwnProperty.call(paragraphsObj, pathKey)) continue;
            var arr = paragraphsObj[pathKey];
            if (!Array.isArray(arr)) {
                return { valid: false, error: "paragraphs[" + pathKey + "] должен быть массивом" };
            }
            for (var i = 0; i < arr.length; i++) {
                var res = validateParagraph(arr[i], paragraphIds, pathKey);
                if (!res.valid) return res;
            }
        }
        return { valid: true };
    }

    /**
     * Валидация одного вопроса теста.
     */
    function validateQuestion(q, index) {
        if (!isObject(q)) return { valid: false, error: "Вопрос " + index + ": должен быть объектом" };
        var qText = q.q != null ? String(q.q).trim() : "";
        if (!qText) return { valid: false, error: "Вопрос " + index + ": поле q (текст вопроса) обязательно" };
        if (q.type === "choice") {
            if (!Array.isArray(q.a) || q.a.length === 0) {
                return { valid: false, error: "Вопрос " + index + " (choice): массив вариантов a не пустой" };
            }
            var c = q.c;
            if (c == null || typeof c !== "number" || c < 0 || c >= q.a.length) {
                return { valid: false, error: "Вопрос " + index + " (choice): указан правильный ответ c (индекс 0.." + (q.a.length - 1) + ")" };
            }
            return { valid: true };
        }
        if (q.type === "input") {
            var answers = q.answers || (q.answer != null ? [q.answer] : []);
            if (!Array.isArray(answers)) answers = [].concat(answers);
            if (answers.length === 0) {
                return { valid: false, error: "Вопрос " + index + " (input): укажите answer или answers" };
            }
            return { valid: true };
        }
        return { valid: false, error: "Вопрос " + index + ": type должен быть choice или input" };
    }

    /**
     * Валидация одного теста (объект с title и questions).
     */
    function validateQuiz(quiz) {
        if (!isObject(quiz)) return { valid: false, error: "Тест должен быть объектом" };
        if (typeof quiz.title !== "string" || !quiz.title.trim()) {
            return { valid: false, error: "У теста должен быть непустой title" };
        }
        if (!Array.isArray(quiz.questions)) {
            return { valid: false, error: "У теста должен быть массив questions" };
        }
        for (var i = 0; i < quiz.questions.length; i++) {
            var res = validateQuestion(quiz.questions[i], i);
            if (!res.valid) return res;
        }
        return { valid: true };
    }

    /**
     * Валидация всех quizzes (объект path -> quiz).
     */
    function validateQuizzes(quizzesObj) {
        if (!isObject(quizzesObj)) return { valid: false, error: "quizzes должен быть объектом" };
        for (var pathKey in quizzesObj) {
            if (!Object.prototype.hasOwnProperty.call(quizzesObj, pathKey)) continue;
            var res = validateQuiz(quizzesObj[pathKey]);
            if (!res.valid) return res;
        }
        return { valid: true };
    }

    /**
     * Полная валидация импортируемого JSON.
     */
    function validateFullData(data) {
        if (!isObject(data)) {
            return { valid: false, error: "Данные должны быть объектом" };
        }
        var r1 = validateConfig(data.config);
        if (!r1.valid) return r1;
        var r2 = validateParagraphs(data.paragraphs || {});
        if (!r2.valid) return r2;
        var r3 = validateQuizzes(data.quizzes || {});
        if (!r3.valid) return r3;
        return { valid: true };
    }

    global.AdminSchema = {
        getStorageKey: getStorageKey,
        createEmpty: createEmpty,
        validateConfig: validateConfig,
        validateParagraph: validateParagraph,
        validateParagraphs: validateParagraphs,
        validateQuestion: validateQuestion,
        validateQuiz: validateQuiz,
        validateQuizzes: validateQuizzes,
        validateFullData: validateFullData,
        isObject: isObject
    };
})(typeof window !== "undefined" ? window : this);
