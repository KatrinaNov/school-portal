/**
 * Unit-тесты для генераторов тестов (fromDates, fromTerms, fromPeople).
 */
var QuizEngine = require("../quizEngine.js");
global.QuizEngine = QuizEngine;

var fromDates = require("../quizGenerators/fromDates.js");
var fromTerms = require("../quizGenerators/fromTerms.js");
var fromPeople = require("../quizGenerators/fromPeople.js");

describe("fromDates.generate", function () {
    test("возвращает массив вопросов", function () {
        var paragraphs = [{ id: "1", dates: [{ year: "862", event: "Призвание варягов" }] }];
        var questions = fromDates.generate(paragraphs, { limit: 10 });
        expect(Array.isArray(questions)).toBe(true);
        expect(questions.length).toBeGreaterThan(0);
    });

    test("вопросы имеют тип choice или input и текст q", function () {
        var paragraphs = [{ dates: [{ year: "988", event: "Крещение Руси" }] }];
        var questions = fromDates.generate(paragraphs, { limit: 5 });
        questions.forEach(function (q) {
            expect(["choice", "input"]).toContain(q.type);
            expect(typeof q.q).toBe("string");
            expect(q.q.length).toBeGreaterThan(0);
        });
    });

    test("choice имеет a и c", function () {
        var paragraphs = [{ dates: [{ year: "862", event: "Событие" }] }];
        var questions = fromDates.generate(paragraphs, { limit: 20 });
        var choiceQ = questions.find(function (q) { return q.type === "choice"; });
        expect(choiceQ).toBeDefined();
        expect(Array.isArray(choiceQ.a)).toBe(true);
        expect(typeof choiceQ.c).toBe("number");
    });

    test("input имеет answer", function () {
        var paragraphs = [{ dates: [{ year: "862", event: "Событие" }] }];
        var questions = fromDates.generate(paragraphs, { limit: 20 });
        var inputQ = questions.find(function (q) { return q.type === "input"; });
        expect(inputQ).toBeDefined();
        expect(inputQ.answer != null).toBe(true);
    });

    test("пустые параграфы — пустой массив", function () {
        expect(fromDates.generate([], {}).length).toBe(0);
        expect(fromDates.generate([{ dates: [] }], {}).length).toBe(0);
    });
});

describe("fromTerms.generate", function () {
    test("возвращает массив вопросов", function () {
        var paragraphs = [{ terms: [{ term: "Варяги", definition: "Скандинавские воины" }] }];
        var questions = fromTerms.generate(paragraphs, { limit: 10 });
        expect(Array.isArray(questions)).toBe(true);
        expect(questions.length).toBeGreaterThan(0);
    });

    test("пустые термины — пустой массив", function () {
        expect(fromTerms.generate([], {}).length).toBe(0);
        expect(fromTerms.generate([{ terms: [] }], {}).length).toBe(0);
    });
});

describe("fromPeople.generate", function () {
    test("возвращает массив вопросов при наличии people", function () {
        var paragraphs = [{ people: [{ name: "Владимир", info: "Князь, крестил Русь" }] }];
        var questions = fromPeople.generate(paragraphs, { limit: 10 });
        expect(Array.isArray(questions)).toBe(true);
        expect(questions.length).toBeGreaterThan(0);
    });

    test("пустые people — пустой массив", function () {
        expect(fromPeople.generate([], {}).length).toBe(0);
    });
});
