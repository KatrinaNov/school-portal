/**
 * Quiz — привязка движка к DOM: загрузка, старт, рендер.
 * Ответы собираются без немедленной проверки; навигация Назад/Дальше, на последнем вопросе — Проверить.
 */

(function () {
    var Engine = typeof QuizEngine !== "undefined" ? QuizEngine : (typeof require !== "undefined" ? require("./quizEngine.js") : {});

    function getContainer() {
        return document.getElementById("app");
    }

    function renderEmptyQuiz(backAction) {
        var container = getContainer();
        if (!container) return;
        container.innerHTML = "<div class=\"container\"><h1>В этом тесте нет вопросов</h1><button id=\"btnBack\">Назад</button></div>";
        var btn = document.getElementById("btnBack");
        if (btn) btn.addEventListener("click", function () { (typeof backAction === "function" ? backAction() : (typeof Router !== "undefined" && Router.navigate ? Router.navigate(Router.hashForHome()) : (typeof renderHome === "function" && renderHome()))); });
    }

    function renderError(message, backAction) {
        var container = getContainer();
        if (!container) return;
        container.innerHTML = "<div class=\"container\"><h1>" + (typeof escapeHtml === "function" ? escapeHtml(message) : message) + "</h1><button id=\"btnBack\">Главная</button></div>";
        var btn = document.getElementById("btnBack");
        if (btn) btn.addEventListener("click", function () { (typeof Router !== "undefined" && Router.navigate ? Router.navigate(Router.hashForHome()) : (typeof renderHome === "function" && renderHome())); });
    }

    function buildQuestionHtml(quizTitle, current, total, question, options) {
        options = options || {};
        var selectedIndex = options.selectedChoiceIndex;
        var inputValue = options.inputValue != null ? options.inputValue : "";
        var reviewMode = options.reviewMode === true;
        var questionResult = options.questionResult;
        var answersHtml = "";
        if (question.type === "choice" && Array.isArray(question.a)) {
            question.a.forEach(function (a, i) {
                var selectedClass = (selectedIndex === i) ? " answer-card--selected" : "";
                if (reviewMode && selectedIndex === i) {
                    if (questionResult === true) selectedClass += " correct";
                    else if (questionResult === false) selectedClass += " wrong";
                }
                answersHtml += "<div class=\"card answer-card" + selectedClass + "\" data-index=\"" + i + "\">" + (typeof escapeHtml === "function" ? escapeHtml(String(a)) : String(a)) + "</div>";
            });
        }
        if (question.type === "input") {
            var safeValue = typeof escapeHtml === "function" ? escapeHtml(inputValue) : inputValue;
            var inputClass = "input-answer";
            if (reviewMode && questionResult === true) inputClass += " correct";
            else if (reviewMode && questionResult === false) inputClass += " wrong";
            answersHtml += "<input type=\"text\" id=\"userAnswer\" class=\"" + inputClass + "\" placeholder=\"Введите ответ\" value=\"" + safeValue + "\">";
        }
        var showBack = current > 0;
        var isLast = current === total - 1;
        var navHtml = "<div class=\"quiz-nav\">";
        if (showBack) navHtml += "<button type=\"button\" class=\"secondary\" id=\"btnQuizBack\">Назад</button>";
        if (!reviewMode) {
            if (isLast) navHtml += "<button type=\"button\" id=\"btnQuizFinish\">Проверить</button>";
            else navHtml += "<button type=\"button\" id=\"btnQuizNext\">Дальше</button>";
        } else {
            if (!isLast) navHtml += "<button type=\"button\" id=\"btnQuizNext\">Дальше</button>";
        }
        navHtml += "</div>";
        var welcomeText = reviewMode ? "Можно исправить ответы и нажать «Проверить тест» внизу справа. Зелёный — верно, красный — ошибка." : "Ты справишься! Выбери ответ или введи его — результат увидишь после проверки.";
        return "<div class=\"container\"><h1>" + (typeof escapeHtml === "function" ? escapeHtml(quizTitle) : quizTitle) + "</h1><p class=\"quiz-welcome\">" + (typeof escapeHtml === "function" ? escapeHtml(welcomeText) : welcomeText) + "</p><div class=\"progress\">" + (current + 1) + " из " + total + "</div><h2>" + (typeof escapeHtml === "function" ? escapeHtml((question.q != null) ? String(question.q) : "") : (question.q != null ? String(question.q) : "")) + "</h2>" + answersHtml + navHtml + "<button type=\"button\" class=\"secondary\" id=\"exitQuizBtn\">Выйти из теста</button></div>";
    }

    function getUnansweredNumbers(userAnswers, total) {
        var list = [];
        for (var i = 0; i < total; i++) {
            var a = userAnswers[i];
            if (a == null) list.push(i + 1);
            else if (a.type === "input" && (a.value == null || String(a.value).trim() === "")) list.push(i + 1);
        }
        return list;
    }

    function showConfirmFinish(container, userAnswers, total, onReturn, onFinish) {
        var unanswered = getUnansweredNumbers(userAnswers, total);
        var msg = "Вы уверены, что хотите завершить тест?";
        if (unanswered.length > 0) {
            msg += " Вы не дали ответы на следующие вопросы: " + unanswered.join(", ") + ".";
        }
        var html = "<div class=\"quiz-confirm-overlay\" id=\"quizConfirmOverlay\"><div class=\"quiz-confirm\"><p>" + (typeof escapeHtml === "function" ? escapeHtml(msg) : msg) + "</p><div class=\"quiz-confirm-buttons\"><button type=\"button\" class=\"secondary\" id=\"btnConfirmReturn\">Вернуться к тесту</button><button type=\"button\" id=\"btnConfirmFinish\">Завершить и проверить</button></div></div></div>";
        container.insertAdjacentHTML("beforeend", html);
        var overlay = document.getElementById("quizConfirmOverlay");
        document.getElementById("btnConfirmReturn").addEventListener("click", function () {
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (typeof onReturn === "function") onReturn();
        });
        document.getElementById("btnConfirmFinish").addEventListener("click", function () {
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (typeof onFinish === "function") onFinish();
        });
    }

    function attachChoiceHandlers(container, userAnswers, current, onSelect) {
        if (!container || !userAnswers) return;
        container.querySelectorAll(".answer-card").forEach(function (card) {
            card.addEventListener("click", function () {
                var idx = card.getAttribute("data-index");
                if (idx === null) return;
                idx = parseInt(idx, 10);
                userAnswers[current] = { type: "choice", index: idx };
                container.querySelectorAll(".answer-card").forEach(function (c) {
                    c.classList.remove("answer-card--selected");
                    c.classList.remove("correct");
                    c.classList.remove("wrong");
                });
                card.classList.add("answer-card--selected");
                if (typeof onSelect === "function") onSelect();
            });
        });
    }

    function attachExitHandler(container, onExit) {
        if (!container || typeof onExit !== "function") return;
        var btn = container.querySelector("#exitQuizBtn");
        if (btn) btn.addEventListener("click", onExit);
    }

    function startQuiz(data, backAction) {
        var questions = (data && data.questions) || [];
        if (questions.length === 0) {
            renderEmptyQuiz(backAction);
            return;
        }

        var engine = Engine;
        var quizTitle = (data && data.title) || "Тест";
        var container = getContainer();
        var userAnswers = [];
        var current = 0;
        var i;
        for (i = 0; i < questions.length; i++) userAnswers[i] = null;

        function saveCurrentInput() {
            var q = questions[current];
            if (!q || q.type !== "input") return;
            var inputEl = container.querySelector("#userAnswer");
            var val = inputEl ? inputEl.value : "";
            userAnswers[current] = { type: "input", value: val };
        }

        function goNext() {
            saveCurrentInput();
            current++;
            if (current < questions.length) renderQuestion();
        }

        function goBack() {
            saveCurrentInput();
            if (current <= 0) return;
            current--;
            renderQuestion();
        }

        var showFinishButton = false;
        var reviewMode = false;
        var questionResults = [];

        function requestFinish() {
            saveCurrentInput();
            showConfirmFinish(container, userAnswers, questions.length, function () {
                showFinishButton = true;
                renderQuestion();
            }, function () {
                doFinish();
            });
        }

        function doFinish() {
            var correct = 0;
            var wrong = 0;
            var i;
            questionResults.length = 0;
            for (i = 0; i < questions.length; i++) {
                var a = userAnswers[i];
                var q = questions[i];
                if (!q) {
                    questionResults[i] = null;
                    continue;
                }
                var answered = a != null && (a.type !== "input" || (a.value != null && String(a.value).trim() !== ""));
                if (!answered) {
                    wrong++;
                    questionResults[i] = false;
                    continue;
                }
                var ok = false;
                if (q.type === "choice" && a.type === "choice") ok = engine.validateAnswer && engine.validateAnswer(q, a.index);
                if (q.type === "input" && a.type === "input") ok = engine.validateAnswer && engine.validateAnswer(q, a.value);
                questionResults[i] = (ok === true);
                if (ok) correct++; else wrong++;
            }
            renderResult(correct, wrong);
        }

        function renderResult(correct, wrong) {
            if (!container) return;
            var totalQ = questions.length;
            var allCorrect = totalQ > 0 && wrong === 0 && correct === totalQ;
            var encourage = "Молодец, что прошёл тест! ";
            if (allCorrect) encourage = "";
            else if (wrong === 0 && correct > 0) encourage = "Отлично! Все ответы верные. ";
            else if (correct > 0) encourage = "Хорошая работа! Можно вернуться и подумать над ошибками. ";
            else encourage = "Не сдавайся — попробуй ещё раз. ";
            var celebrationBlock = "";
            if (allCorrect) {
                celebrationBlock = "<div class=\"quiz-celebration\" role=\"img\" aria-label=\"Поздравляем\"><div class=\"quiz-celebration-emoji\">🎉</div><p class=\"quiz-celebration-title\">Поздравляем!</p><p class=\"quiz-celebration-text\">Все ответы верные! Так держать!</p></div>";
            }
            var retryBtnHtml = allCorrect ? "" : "<button type=\"button\" class=\"secondary\" id=\"btnQuizRetry\">Вернуться и исправить</button>";
            var html = "<div class=\"container\"><h1>Результаты теста</h1>" + celebrationBlock + "<p class=\"quiz-welcome\">" + encourage + "</p><p><strong>Правильных ответов: " + correct + "</strong></p><p><strong>Неправильных ответов: " + wrong + "</strong></p><div class=\"quiz-result-actions\">" + retryBtnHtml + "<button type=\"button\" id=\"btnQuizExit\">Выйти из теста</button></div></div>";
            container.innerHTML = html;
            var btnRetry = document.getElementById("btnQuizRetry");
            if (btnRetry) btnRetry.addEventListener("click", function () {
                reviewMode = true;
                current = 0;
                renderQuestion();
            });
            document.getElementById("btnQuizExit").addEventListener("click", function () {
                if (typeof backAction === "function") backAction();
                else if (typeof renderHome === "function") renderHome();
            });
        }

        function ensureFloatFinishButton() {
            var floatEl = document.getElementById("quizFloatFinish");
            if (!floatEl) {
                floatEl = document.createElement("div");
                floatEl.id = "quizFloatFinish";
                floatEl.className = "quiz-float-finish";
                floatEl.innerHTML = "<button type=\"button\" id=\"btnQuizFloatFinish\">Завершить и проверить тест</button>";
                container.appendChild(floatEl);
                floatEl.querySelector("#btnQuizFloatFinish").addEventListener("click", requestFinish);
            }
            var btn = floatEl.querySelector("#btnQuizFloatFinish");
            if (btn) btn.textContent = reviewMode ? "Проверить тест" : "Завершить и проверить тест";
        }

        function renderQuestion() {
            var q = questions[current];
            if (!q) return;
            var opts = {};
            var a = userAnswers[current];
            if (q.type === "choice" && a && a.type === "choice") opts.selectedChoiceIndex = a.index;
            if (q.type === "input" && a && a.type === "input") opts.inputValue = a.value;
            opts.reviewMode = reviewMode;
            opts.questionResult = reviewMode && questionResults[current] !== undefined ? questionResults[current] : null;
            if (!container) return;
            container.innerHTML = buildQuestionHtml(quizTitle, current, questions.length, q, opts);

            if (showFinishButton || reviewMode) ensureFloatFinishButton();

            attachExitHandler(container, function () {
                if (typeof backAction === "function") backAction();
                else if (typeof renderHome === "function") renderHome();
            });

            var btnBack = document.getElementById("btnQuizBack");
            if (btnBack) btnBack.addEventListener("click", goBack);
            var btnNext = document.getElementById("btnQuizNext");
            if (btnNext) btnNext.addEventListener("click", goNext);
            var btnFinish = document.getElementById("btnQuizFinish");
            if (btnFinish) btnFinish.addEventListener("click", requestFinish);

            if (q.type === "choice") {
                if (a && a.type === "choice") {
                    var cards = container.querySelectorAll(".answer-card");
                    if (cards[a.index]) cards[a.index].classList.add("answer-card--selected");
                }
                attachChoiceHandlers(container, userAnswers, current);
            }
        }

        renderQuestion();
    }

    function loadQuiz(path, backAction) {
        if (typeof showLoader === "function") showLoader("Загрузка теста...");
        if (typeof Api !== "undefined" && Api.getQuiz) {
            Api.getQuiz(path)
                .then(function (data) { startQuiz(data, backAction); })
                .catch(function () { renderError("Ошибка загрузки теста", backAction); });
        } else {
            renderError("Ошибка загрузки теста", backAction);
        }
    }

    function createCustomTest(subjectPath, sourceType, questionLimit) {
        var checked = document.querySelectorAll && document.querySelectorAll(".paragraph-checkbox:checked");
        if (!checked || checked.length === 0) {
            alert("Выберите хотя бы один параграф");
            return;
        }
        var selectedIds = Array.from(checked).map(function (c) { return c.value; });
        var type = (sourceType != null && sourceType !== "") ? sourceType : (typeof QuizGenerators !== "undefined" && QuizGenerators.SOURCE_PARAGRAPHS ? QuizGenerators.SOURCE_PARAGRAPHS : "paragraphs");
        var limit = 20;
        if (typeof questionLimit === "number" && questionLimit >= 1 && questionLimit <= 50) limit = questionLimit;
        else if (typeof questionLimit === "string") { var n = parseInt(questionLimit, 10); if (!isNaN(n) && n >= 1 && n <= 50) limit = n; }

        if (typeof showLoader === "function") showLoader("Составление теста...");

        if (typeof QuizGenerators !== "undefined" && typeof QuizGenerators.run === "function") {
            QuizGenerators.run(type, subjectPath, selectedIds, { limit: limit })
                .then(function (result) {
                    if (!result || !result.questions || result.questions.length === 0) {
                        getContainer().innerHTML = "<div class=\"container\"><p>Для выбранных параграфов и типа теста нет вопросов</p><button id=\"btnBack\">Назад</button></div>";
                        var b = document.getElementById("btnBack");
                        if (b) b.addEventListener("click", function () { renderSubjectFromPath(subjectPath); });
                        return;
                    }
                    startQuiz({ title: result.title || "Свой тест", questions: result.questions }, function () { renderSubjectFromPath(subjectPath); });
                })
                .catch(function () {
                    getContainer().innerHTML = "<div class=\"container\"><p>Ошибка загрузки теста</p><button id=\"btnBack\">Назад</button></div>";
                    var b = document.getElementById("btnBack");
                    if (b) b.addEventListener("click", function () { renderSubjectFromPath(subjectPath); });
                });
            return;
        }

        if (typeof Api === "undefined" || !Api.getParagraphs) {
            renderError("Ошибка загрузки");
            return;
        }
        Api.getParagraphs(subjectPath).then(function (paragraphs) {
            var selectedParagraphs = paragraphs.filter(function (p) { return selectedIds.indexOf(String(p.id)) !== -1; });
            var quizPromises = [];
            selectedParagraphs.forEach(function (p) {
                if (p.quizzes && p.quizzes.length) {
                    p.quizzes.forEach(function (q) {
                        var file = (q && q.file) || (q && q.id ? q.id + ".json" : "");
                        if (file) quizPromises.push(Api.getQuiz(subjectPath + file));
                    });
                }
            });
            if (quizPromises.length === 0) {
                getContainer().innerHTML = "<div class=\"container\"><p>Для выбранных параграфов нет тестов</p><button id=\"btnBack\">Назад</button></div>";
                var b = document.getElementById("btnBack");
                if (b) b.addEventListener("click", function () { renderSubjectFromPath(subjectPath); });
                return;
            }
            Promise.all(quizPromises).then(function (quizzes) {
                var allQuestions = [];
                quizzes.forEach(function (q) {
                    if (q && q.questions && q.questions.length) allQuestions = allQuestions.concat(q.questions);
                });
                if (allQuestions.length === 0) {
                    getContainer().innerHTML = "<div class=\"container\"><p>Для выбранных параграфов нет вопросов</p><button id=\"btnBack\">Назад</button></div>";
                    var b = document.getElementById("btnBack");
                    if (b) b.addEventListener("click", function () { renderSubjectFromPath(subjectPath); });
                    return;
                }
                var limitNum = limit;
                var finalQuestions = Engine.takeRandomQuestions ? Engine.takeRandomQuestions(allQuestions, limitNum) : (Engine.shuffleArray ? Engine.shuffleArray(allQuestions).slice(0, limitNum) : allQuestions.slice(0, limitNum));
                startQuiz({ title: "Свой тест", questions: finalQuestions }, function () { renderSubjectFromPath(subjectPath); });
            }).catch(function () {
                getContainer().innerHTML = "<div class=\"container\"><p>Ошибка загрузки тестов</p><button id=\"btnBack\">Назад</button></div>";
                var b = document.getElementById("btnBack");
                if (b) b.addEventListener("click", function () { renderSubjectFromPath(subjectPath); });
            });
        }).catch(function () {
            renderError("Ошибка загрузки");
        });
    }

    function renderSubjectFromPath(path) {
        if (typeof Router !== "undefined" && Router.navigate && Router.hashFromPath) {
            Router.navigate(Router.hashFromPath(path));
            return;
        }
        var c = typeof CONFIG !== "undefined" && CONFIG && CONFIG.classes;
        if (!c) { if (typeof renderHome === "function") renderHome(); return; }
        for (var classId in c) {
            if (!c.hasOwnProperty(classId)) continue;
            var subj = c[classId].subjects;
            if (!subj) continue;
            for (var subjectId in subj) {
                if (!subj.hasOwnProperty(subjectId)) continue;
                if (subj[subjectId].path === path) {
                    if (typeof renderSubject === "function") renderSubject(classId, subjectId);
                    return;
                }
            }
        }
        if (typeof renderHome === "function") renderHome();
    }

    window.loadQuiz = loadQuiz;
    window.startQuiz = startQuiz;
    window.createCustomTest = createCustomTest;
    window.renderSubjectFromPath = renderSubjectFromPath;
})();
