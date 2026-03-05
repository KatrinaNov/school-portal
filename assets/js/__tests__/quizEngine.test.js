/**
 * Unit-тесты для Quiz Engine (нормализация, валидация, попытки, skip, рандомизация).
 */
const {
    normalizeAnswer,
    validateAnswer,
    getCorrectAnswerForDisplay,
    canShowSkip,
    shuffleArray,
    takeRandomQuestions,
    MAX_ATTEMPTS
} = require("../quizEngine.js");

describe("normalizeAnswer", function () {
    test("приводит к нижнему регистру", function () {
        expect(normalizeAnswer("Ответ")).toBe("ответ");
        expect(normalizeAnswer("ANSWER")).toBe("answer");
    });

    test("обрезает пробелы по краям", function () {
        expect(normalizeAnswer("  1253  ")).toBe("1253");
        expect(normalizeAnswer("\t слово \n")).toBe("слово");
    });

    test("обрабатывает null и undefined", function () {
        expect(normalizeAnswer(null)).toBe("");
        expect(normalizeAnswer(undefined)).toBe("");
    });

    test("число преобразует в строку и нормализует", function () {
        expect(normalizeAnswer(1253)).toBe("1253");
    });
});

describe("validateAnswer", function () {
    describe("choice", function () {
        test("верный индекс — true", function () {
            var q = { type: "choice", a: ["A", "B", "C"], c: 1 };
            expect(validateAnswer(q, 1)).toBe(true);
        });
        test("неверный индекс — false", function () {
            var q = { type: "choice", a: ["A", "B", "C"], c: 1 };
            expect(validateAnswer(q, 0)).toBe(false);
        });
        test("нет question — false", function () {
            expect(validateAnswer(null, 0)).toBe(false);
        });
    });

    describe("input: один ответ (answer)", function () {
        test("совпадение без учёта регистра", function () {
            var q = { type: "input", answer: "1253" };
            expect(validateAnswer(q, "1253")).toBe(true);
            expect(validateAnswer(q, "1253")).toBe(true);
        });
        test("разный регистр", function () {
            var q = { type: "input", answer: "Миндовг" };
            expect(validateAnswer(q, "миндовг")).toBe(true);
            expect(validateAnswer(q, "МИНДОВГ")).toBe(true);
        });
        test("лишние пробелы", function () {
            var q = { type: "input", answer: "1253" };
            expect(validateAnswer(q, "  1253  ")).toBe(true);
        });
    });

    describe("input: массив допустимых ответов (answers)", function () {
        test("один из вариантов — true", function () {
            var q = { type: "input", answers: ["1253", "1253 год", "год 1253"] };
            expect(validateAnswer(q, "1253")).toBe(true);
            expect(validateAnswer(q, "1253 год")).toBe(true);
        });
        test("разный регистр и пробелы с массивом", function () {
            var q = { type: "input", answers: ["ВКЛ", "Великое Княжество"] };
            expect(validateAnswer(q, "  вкл  ")).toBe(true);
        });
    });
});

describe("getCorrectAnswerForDisplay", function () {
    test("input с answer возвращает его", function () {
        expect(getCorrectAnswerForDisplay({ type: "input", answer: "1253" })).toBe("1253");
    });
    test("input с answers возвращает первый", function () {
        expect(getCorrectAnswerForDisplay({ type: "input", answers: ["1253", "1253 год"] })).toBe("1253");
    });
    test("не input — пустая строка", function () {
        expect(getCorrectAnswerForDisplay({ type: "choice" })).toBe("");
    });
    test("нет question — пустая строка", function () {
        expect(getCorrectAnswerForDisplay(null)).toBe("");
    });
});

describe("canShowSkip (логика 3 попыток)", function () {
    test("меньше 3 попыток — false", function () {
        expect(canShowSkip(0, 3)).toBe(false);
        expect(canShowSkip(1, 3)).toBe(false);
        expect(canShowSkip(2, 3)).toBe(false);
    });
    test("3 и больше — true", function () {
        expect(canShowSkip(3, 3)).toBe(true);
        expect(canShowSkip(4, 3)).toBe(true);
    });
    test("использует MAX_ATTEMPTS по умолчанию", function () {
        expect(canShowSkip(MAX_ATTEMPTS)).toBe(true);
        expect(canShowSkip(MAX_ATTEMPTS - 1)).toBe(false);
    });
});

describe("shuffleArray", function () {
    test("сохраняет длину и состав элементов", function () {
        var arr = [1, 2, 3, 4, 5];
        var shuffled = shuffleArray(arr);
        expect(shuffled).toHaveLength(arr.length);
        expect([...shuffled].sort()).toEqual([...arr].sort());
    });
    test("не мутирует исходный массив", function () {
        var arr = [1, 2, 3];
        shuffleArray(arr);
        expect(arr).toEqual([1, 2, 3]);
    });
});

describe("takeRandomQuestions (рандомизация 20 вопросов)", function () {
    test("возвращает 20 элементов из списка больше 20", function () {
        var questions = Array.from({ length: 50 }, function (_, i) { return { id: i }; });
        var result = takeRandomQuestions(questions, 20);
        expect(result).toHaveLength(20);
        var ids = result.map(function (q) { return q.id; });
        var set = new Set(ids);
        expect(set.size).toBe(20);
        result.forEach(function (q) {
            expect(questions).toContainEqual(q);
        });
    });
    test("если вопросов меньше лимита — возвращает копию всего массива", function () {
        var questions = [{ id: 1 }, { id: 2 }];
        var result = takeRandomQuestions(questions, 20);
        expect(result).toHaveLength(2);
        expect(result).toEqual(questions);
    });
    test("пустой массив — пустой результат", function () {
        expect(takeRandomQuestions([], 20)).toEqual([]);
    });
});
