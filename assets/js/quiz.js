/* ===============================
   QUIZ CORE
================================= */

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

function loadQuiz(path, backAction) {
    showLoader("Загрузка теста...");
    Api.getQuiz(path)
        .then(function (data) {
            startQuiz(data, backAction);
        })
        .catch(function () {
            app.innerHTML = "<div class=\"container\"><h1>Ошибка загрузки теста</h1><button id=\"btnBack\">Главная</button></div>";
            document.getElementById("btnBack").addEventListener("click", renderHome);
        });
}

function startQuiz(data, backAction) {
    var questions = (data && data.questions) || [];
    if (questions.length === 0) {
        app.innerHTML = "<div class=\"container\"><h1>В этом тесте нет вопросов</h1><button id=\"btnBack\">Назад</button></div>";
        document.getElementById("btnBack").addEventListener("click", function () {
            if (typeof backAction === "function") backAction();
            else renderHome();
        });
        return;
    }

    var current = 0;
    var correct = 0;
    var wrong = 0;
    var locked = false;
    var quizTitle = (data && data.title) || "Тест";

    function renderQuestion() {
        locked = false;
        var q = questions[current];
        if (!q) {
            renderResult();
            return;
        }

        var answersHtml = "";
        if (q.type === "choice" && Array.isArray(q.a)) {
            q.a.forEach(function (a, i) {
                answersHtml += "<div class=\"card answer-card\" data-index=\"" + i + "\">" + escapeHtml(String(a)) + "</div>";
            });
        }
        if (q.type === "input") {
            answersHtml = "<input type=\"text\" id=\"userAnswer\" class=\"input-answer\" placeholder=\"Введите ответ\"><button class=\"primary\" id=\"submitInputAnswer\">Ответить</button>";
        }

        app.innerHTML = "<div class=\"container\"><h1>" + escapeHtml(quizTitle) + "</h1><div class=\"progress\">" + (current + 1) + " из " + questions.length + "</div><h2>" + escapeHtml((q.q != null) ? String(q.q) : "") + "</h2>" + answersHtml + "<div id=\"quizFeedback\" class=\"quiz-feedback\" aria-live=\"polite\"></div><button class=\"secondary\" id=\"exitQuizBtn\">Выйти из теста</button></div>";

        document.getElementById("exitQuizBtn").addEventListener("click", function () {
            if (typeof backAction === "function") backAction();
            else renderHome();
        });

        if (q.type === "choice") {
            app.querySelectorAll(".answer-card").forEach(function (card) {
                card.addEventListener("click", function () {
                    handleChoiceAnswer(parseInt(card.getAttribute("data-index"), 10));
                });
            });
        }
        if (q.type === "input") {
            document.getElementById("submitInputAnswer").addEventListener("click", handleInputAnswer);
        }
    }

    function handleChoiceAnswer(index) {
        if (locked) return;
        var q = questions[current];
        var correctIndex = q && q.c;
        var cards = app.querySelectorAll(".answer-card");
        var isCorrect = validateAnswer(q, index);

        if (isCorrect) {
            locked = true;
            cards[index].classList.add("correct");
            correct++;
            setTimeout(nextStep, 700);
        } else {
            wrong++;
            cards[index].classList.add("wrong");
            showWrongAnswerFeedback(q);
        }
    }

    function showWrongAnswerFeedback(question) {
        var el = document.getElementById("quizFeedback");
        if (!el) return;
        var msg = "Ответ неверный.";
        var hint = (question && (question.hint || question.explanation)) ? String(question.hint || question.explanation) : "";
        if (hint) msg += " " + hint;
        el.textContent = msg;
        el.className = "quiz-feedback quiz-feedback--wrong";
    }

    function handleInputAnswer() {
        if (locked) return;
        var input = document.getElementById("userAnswer");
        if (!input) return;
        var userValue = input.value;
        var q = questions[current];
        var isCorrect = validateAnswer(q, userValue);

        if (isCorrect) {
            locked = true;
            correct++;
            input.classList.remove("wrong");
            input.classList.add("correct");
            setTimeout(nextStep, 700);
        } else {
            wrong++;
            input.classList.add("wrong");
            showWrongAnswerFeedback(q);
        }
    }

    function nextStep() {
        current++;
        if (current < questions.length) {
            renderQuestion();
        } else {
            renderResult();
        }
    }

    function renderResult() {
        var total = questions.length;
        var pct = total ? Math.round((correct / total) * 100) : 0;
        app.innerHTML = "<div class=\"container\"><h1>Тест завершён</h1><p>Правильных: " + correct + "</p><p>Ошибок: " + wrong + "</p><p>Процент: " + pct + "%</p><button id=\"btnQuizResultBack\">Назад</button></div>";
        document.getElementById("btnQuizResultBack").addEventListener("click", function () {
            if (typeof backAction === "function") backAction();
            else renderHome();
        });
    }

    renderQuestion();
}

/* ===============================
   CUSTOM TEST
================================= */

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

function createCustomTest(subjectPath) {
    var checked = document.querySelectorAll(".paragraph-checkbox:checked");
    if (checked.length === 0) {
        alert("Выберите хотя бы один параграф");
        return;
    }

    showLoader("Составление теста...");
    Api.getParagraphs(subjectPath)
        .then(function (paragraphs) {
            var selectedIds = Array.from(checked).map(function (c) { return c.value; });
            var selectedParagraphs = paragraphs.filter(function (p) { return selectedIds.indexOf(String(p.id)) !== -1; });
            var quizPromises = [];
            selectedParagraphs.forEach(function (p) {
                if (p.quizzes && p.quizzes.length) {
                    p.quizzes.forEach(function (q) {
                        var path = subjectPath + (q.file || "");
                        quizPromises.push(Api.getQuiz(path));
                    });
                }
            });

            if (quizPromises.length === 0) {
                app.innerHTML = "<div class=\"container\"><p>Для выбранных параграфов нет тестов</p><button id=\"btnBack\">Назад</button></div>";
                document.getElementById("btnBack").addEventListener("click", function () { renderSubjectFromPath(subjectPath); });
                return;
            }

            Promise.all(quizPromises)
                .then(function (quizzes) {
                    var allQuestions = [];
                    quizzes.forEach(function (q) {
                        if (q.questions && q.questions.length) {
                            allQuestions = allQuestions.concat(q.questions);
                        }
                    });
                    if (allQuestions.length === 0) {
                        app.innerHTML = "<div class=\"container\"><p>Для выбранных параграфов нет вопросов</p><button id=\"btnBack\">Назад</button></div>";
                        document.getElementById("btnBack").addEventListener("click", function () { renderSubjectFromPath(subjectPath); });
                        return;
                    }
                    shuffleArray(allQuestions);
                    var finalQuestions = allQuestions.length > 20 ? allQuestions.slice(0, 20) : allQuestions;
                    startQuiz(
                        { title: "Свой тест", questions: finalQuestions },
                        function () { renderSubjectFromPath(subjectPath); }
                    );
                })
                .catch(function () {
                    app.innerHTML = "<div class=\"container\"><p>Ошибка загрузки тестов</p><button id=\"btnBack\">Назад</button></div>";
                    document.getElementById("btnBack").addEventListener("click", function () { renderSubjectFromPath(subjectPath); });
                });
        })
        .catch(function () {
            app.innerHTML = "<div class=\"container\"><p>Ошибка загрузки</p><button id=\"btnBack\">Назад</button></div>";
            document.getElementById("btnBack").addEventListener("click", renderHome);
        });
}

/* ===============================
   HELPERS
================================= */

function renderSubjectFromPath(path) {
    var classId, subjectId;
    for (classId in CONFIG.classes) {
        if (!CONFIG.classes.hasOwnProperty(classId)) continue;
        for (subjectId in CONFIG.classes[classId].subjects) {
            if (!CONFIG.classes[classId].subjects.hasOwnProperty(subjectId)) continue;
            if (CONFIG.classes[classId].subjects[subjectId].path === path) {
                renderSubject(classId, subjectId);
                return;
            }
        }
    }
    renderHome();
}
