/**
 * Quiz — привязка движка к DOM: загрузка, старт, рендер, обработчики.
 * Состояние сессии (current, correct, wrong, skipped, attempts) в замыкании.
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

    function showWrongAnswerFeedback(container, question) {
        var el = container ? container.querySelector("#quizFeedback") : null;
        if (!el) return;
        var msg = "Ответ неверный.";
        var hint = (question && (question.hint || question.explanation)) ? String(question.hint || question.explanation) : "";
        if (hint) msg += " " + hint;
        el.textContent = msg;
        el.className = "quiz-feedback quiz-feedback--wrong";
    }

    function showCorrectAnswerBlock(container, correctText) {
        var el = container ? container.querySelector("#quizCorrectAnswer") : null;
        if (!el) return;
        el.textContent = "Правильный ответ: " + (correctText || "");
        el.className = "quiz-feedback quiz-feedback--correct";
        el.hidden = false;
    }

    function buildQuestionHtml(quizTitle, current, total, question, options) {
        options = options || {};
        var feedbackId = "quizFeedback";
        var correctId = "quizCorrectAnswer";
        var answersHtml = "";
        if (question.type === "choice" && Array.isArray(question.a)) {
            question.a.forEach(function (a, i) {
                answersHtml += "<div class=\"card answer-card\" data-index=\"" + i + "\">" + (typeof escapeHtml === "function" ? escapeHtml(String(a)) : String(a)) + "</div>";
            });
        }
        if (question.type === "input") {
            var inputDisabled = options.inputDisabled ? " disabled" : "";
            answersHtml += "<input type=\"text\" id=\"userAnswer\" class=\"input-answer\" placeholder=\"Введите ответ\"" + inputDisabled + "><button class=\"primary\" id=\"submitInputAnswer\"" + (options.inputDisabled ? " disabled" : "") + ">Ответить</button>";
        }
        var correctBlock = "<div id=\"" + correctId + "\" class=\"quiz-feedback quiz-feedback--correct\" hidden aria-live=\"polite\"></div>";
        var skipBtn = options.showSkip ? "<button class=\"secondary\" id=\"btnSkipQuestion\">Пропустить вопрос</button>" : "";
        return "<div class=\"container\"><h1>" + (typeof escapeHtml === "function" ? escapeHtml(quizTitle) : quizTitle) + "</h1><div class=\"progress\">" + (current + 1) + " из " + total + "</div><h2>" + (typeof escapeHtml === "function" ? escapeHtml((question.q != null) ? String(question.q) : "") : (question.q != null ? String(question.q) : "")) + "</h2>" + answersHtml + "<div id=\"" + feedbackId + "\" class=\"quiz-feedback\" aria-live=\"polite\"></div>" + correctBlock + skipBtn + "<button class=\"secondary\" id=\"exitQuizBtn\">Выйти из теста</button></div>";
    }

    function attachChoiceHandlers(container, onChoice) {
        if (!container || typeof onChoice !== "function") return;
        container.querySelectorAll(".answer-card").forEach(function (card) {
            card.addEventListener("click", function () {
                var idx = card.getAttribute("data-index");
                if (idx !== null) onChoice(parseInt(idx, 10));
            });
        });
    }

    function attachInputHandlers(container, onSubmit, onSkip) {
        if (!container) return;
        var submitBtn = container.querySelector("#submitInputAnswer");
        if (submitBtn && typeof onSubmit === "function") submitBtn.addEventListener("click", function () { onSubmit(); });
        var skipBtn = container.querySelector("#btnSkipQuestion");
        if (skipBtn && typeof onSkip === "function") skipBtn.addEventListener("click", function () { onSkip(); });
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
        var maxAttempts = (engine.MAX_ATTEMPTS != null) ? engine.MAX_ATTEMPTS : 3;
        var current = 0;
        var correct = 0;
        var wrong = 0;
        var skipped = 0;
        var locked = false;
        var attempts = 0;
        var quizTitle = (data && data.title) || "Тест";
        var container = getContainer();

        function resetAttempts() {
            attempts = 0;
        }

        function nextStep() {
            resetAttempts();
            current++;
            if (current < questions.length) {
                renderQuestion();
            } else {
                renderResult();
            }
        }

        function renderQuestion() {
            locked = false;
            var q = questions[current];
            if (!q) {
                renderResult();
                return;
            }

            var canSkip = engine.canShowSkip && engine.canShowSkip(attempts, maxAttempts);
            var correctAnswerText = (q.type === "input" && engine.getCorrectAnswerForDisplay) ? engine.getCorrectAnswerForDisplay(q) : "";
        var showSkip = q.type === "input" && canSkip;
        var inputDisabled = showSkip;

        if (!container) return;
        container.innerHTML = buildQuestionHtml(quizTitle, current, questions.length, q, {
            showSkip: showSkip,
            inputDisabled: inputDisabled
        });

            attachExitHandler(container, function () {
                if (typeof backAction === "function") backAction();
                else if (typeof renderHome === "function") renderHome();
            });

            if (q.type === "choice") {
                attachChoiceHandlers(container, function (index) {
                    if (locked) return;
                    var isCorrect = engine.validateAnswer && engine.validateAnswer(q, index);
                    if (isCorrect) {
                        locked = true;
                        var cards = container.querySelectorAll(".answer-card");
                        if (cards[index]) cards[index].classList.add("correct");
                        correct++;
                        setTimeout(nextStep, 700);
                    } else {
                        wrong++;
                        var cards = container.querySelectorAll(".answer-card");
                        if (cards[index]) cards[index].classList.add("wrong");
                        showWrongAnswerFeedback(container, q);
                    }
                });
            }

            if (q.type === "input") {
                var inputEl = container.querySelector("#userAnswer");
                var submitBtn = container.querySelector("#submitInputAnswer");

                if (showSkip) {
                    showCorrectAnswerBlock(container, correctAnswerText);
                    if (inputEl) inputEl.disabled = true;
                    if (submitBtn) submitBtn.disabled = true;
                    attachInputHandlers(container, null, function () {
                        if (locked) return;
                        locked = true;
                        skipped++;
                        nextStep();
                    });
                    return;
                }

                attachInputHandlers(container, function () {
                    if (locked) return;
                    if (!inputEl) return;
                    var userValue = inputEl.value;
                    var isCorrect = engine.validateAnswer && engine.validateAnswer(q, userValue);

                    if (isCorrect) {
                        locked = true;
                        correct++;
                        inputEl.classList.remove("wrong");
                        inputEl.classList.add("correct");
                        if (submitBtn) submitBtn.disabled = true;
                        setTimeout(nextStep, 700);
                    } else {
                        wrong++;
                        attempts++;
                        inputEl.classList.add("wrong");
                        showWrongAnswerFeedback(container, q);
                        if (engine.canShowSkip && engine.canShowSkip(attempts, maxAttempts)) {
                            showCorrectAnswerBlock(container, correctAnswerText);
                            if (inputEl) inputEl.disabled = true;
                            if (submitBtn) submitBtn.disabled = true;
                            var skipBtn = container.querySelector("#btnSkipQuestion");
                            if (!skipBtn) {
                                var correctEl = container.querySelector("#quizCorrectAnswer");
                                var btn = document.createElement("button");
                                btn.className = "secondary";
                                btn.id = "btnSkipQuestion";
                                btn.textContent = "Пропустить вопрос";
                                btn.addEventListener("click", function () {
                                    if (locked) return;
                                    locked = true;
                                    skipped++;
                                    nextStep();
                                });
                                var parent = correctEl ? correctEl.parentNode : container;
                                if (parent) {
                                    if (correctEl && correctEl.nextSibling) parent.insertBefore(btn, correctEl.nextSibling);
                                    else parent.appendChild(btn);
                                }
                            }
                        }
                    }
                }, null);
            }
        }

        function renderResult() {
            if (!container) return;
            var total = questions.length;
            var pct = total ? Math.round((correct / total) * 100) : 0;
            container.innerHTML = "<div class=\"container\"><h1>Тест завершён</h1><p>Правильных: " + correct + "</p><p>Ошибок: " + wrong + "</p><p>Пропущено: " + skipped + "</p><p>Процент: " + pct + "%</p><button id=\"btnQuizResultBack\">Назад</button></div>";
            var btn = container.querySelector("#btnQuizResultBack");
            if (btn) btn.addEventListener("click", function () {
                if (typeof backAction === "function") backAction();
                else if (typeof renderHome === "function") renderHome();
            });
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

    function createCustomTest(subjectPath, sourceType) {
        var checked = document.querySelectorAll && document.querySelectorAll(".paragraph-checkbox:checked");
        if (!checked || checked.length === 0) {
            alert("Выберите хотя бы один параграф");
            return;
        }
        var selectedIds = Array.from(checked).map(function (c) { return c.value; });
        var type = (sourceType != null && sourceType !== "") ? sourceType : (typeof QuizGenerators !== "undefined" && QuizGenerators.SOURCE_PARAGRAPHS ? QuizGenerators.SOURCE_PARAGRAPHS : "paragraphs");

        if (typeof showLoader === "function") showLoader("Составление теста...");

        if (typeof QuizGenerators !== "undefined" && typeof QuizGenerators.run === "function") {
            QuizGenerators.run(type, subjectPath, selectedIds, { limit: 20 })
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
                var finalQuestions = Engine.takeRandomQuestions ? Engine.takeRandomQuestions(allQuestions, 20) : (Engine.shuffleArray ? Engine.shuffleArray(allQuestions).slice(0, 20) : allQuestions.slice(0, 20));
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
