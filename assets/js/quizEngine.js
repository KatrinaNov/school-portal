/**
 * Quiz Engine — чистая логика без DOM.
 * Нормализация ответов, проверка, рандомизация, лимит попыток и пропуск.
 */

var MAX_ATTEMPTS = 3;

function normalizeAnswer(str) {
    return String(str == null ? "" : str).trim().toLowerCase();
}

function validateAnswer(question, userAnswer) {
    if (!question) return false;
    if (question.type === "choice") {
        var correctIndex = question.c;
        if (correctIndex == null || !Array.isArray(question.a)) return false;
        return parseInt(userAnswer, 10) === correctIndex;
    }
    if (question.type === "input") {
        var answers = question.answers || (question.answer != null ? [question.answer] : []);
        var normalized = normalizeAnswer(userAnswer);
        return answers.some(function (a) { return normalizeAnswer(a) === normalized; });
    }
    return false;
}

function getCorrectAnswerForDisplay(question) {
    if (!question || question.type !== "input") return "";
    var answers = question.answers || (question.answer != null ? [question.answer] : []);
    return answers[0] != null ? String(answers[0]) : "";
}

function canShowSkip(attempts, maxAttempts) {
    return (attempts || 0) >= (maxAttempts != null ? maxAttempts : MAX_ATTEMPTS);
}

function shuffleArray(array) {
    var a = array.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i];
        a[i] = a[j];
        a[j] = t;
    }
    return a;
}

function takeRandomQuestions(questions, limit) {
    if (!Array.isArray(questions)) return [];
    if (questions.length <= limit) return questions.slice();
    return shuffleArray(questions).slice(0, limit);
}

(function exportEngine() {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            normalizeAnswer: normalizeAnswer,
            validateAnswer: validateAnswer,
            getCorrectAnswerForDisplay: getCorrectAnswerForDisplay,
            canShowSkip: canShowSkip,
            shuffleArray: shuffleArray,
            takeRandomQuestions: takeRandomQuestions,
            MAX_ATTEMPTS: MAX_ATTEMPTS
        };
    } else {
        window.QuizEngine = {
            normalizeAnswer: normalizeAnswer,
            validateAnswer: validateAnswer,
            getCorrectAnswerForDisplay: getCorrectAnswerForDisplay,
            canShowSkip: canShowSkip,
            shuffleArray: shuffleArray,
            takeRandomQuestions: takeRandomQuestions,
            MAX_ATTEMPTS: MAX_ATTEMPTS
        };
    }
})();
