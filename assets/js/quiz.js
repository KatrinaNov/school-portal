/* ===============================
   QUIZ CORE
================================= */

function loadQuiz(path, backAction = null) {
    fetch(path)
        .then(res => res.json())
        .then(data => startQuiz(data, backAction))
        .catch(() => {
            app.innerHTML = `<div class="container">
                <h1>Ошибка загрузки теста</h1>
                <button onclick="renderHome()">Главная</button>
            </div>`;
        });
}


function startQuiz(data, backAction) {

    let current = 0;
    let correct = 0;
    let wrong = 0;
    let locked = false; // защита от двойных кликов

    function renderQuestion() {
        locked = false;

        const q = data.questions[current];

        let answersHtml = "";

        // Вариант с выбором
        if (q.type === "choice") {
            answersHtml = q.a.map((a, i) =>
                `<div class="card answer-card" data-index="${i}">
                    ${a}
                </div>`
            ).join("");
        }

        // Ввод ответа
        if (q.type === "input") {
            answersHtml = `
                <input type="text" id="userAnswer" class="input-answer">
                <button class="primary" id="submitInputAnswer">
                    Ответить
                </button>
            `;
        }

        app.innerHTML = `
        <div class="container">
            <h1>${data.title}</h1>

            <div class="progress">
                ${current + 1} из ${data.questions.length}
            </div>

            <h2>${q.q}</h2>

            ${answersHtml}

            <button class="secondary" id="exitQuizBtn">
                Выйти из теста
            </button>
        </div>`;

        // Навешиваем события
        document
            .getElementById("exitQuizBtn")
            .addEventListener("click", exitQuiz);

        if (q.type === "choice") {
            document.querySelectorAll(".answer-card")
                .forEach(card => {
                    card.addEventListener("click", () => {
                        checkChoiceAnswer(
                            parseInt(card.dataset.index)
                        );
                    });
                });
        }

        if (q.type === "input") {
            document
                .getElementById("submitInputAnswer")
                .addEventListener("click", checkInputAnswer);
        }
    }


    function exitQuiz() {
        if (backAction) {
            backAction();
        } else {
            renderHome();
        }
    }


    function nextStep() {
        current++;
        if (current < data.questions.length) {
            renderQuestion();
        } else {
            renderResult();
        }
    }


    function renderResult() {
        app.innerHTML = `
        <div class="container">
            <h1>Тест завершён</h1>
            <p>Правильных: ${correct}</p>
            <p>Ошибок: ${wrong}</p>
            <p>Процент: ${Math.round((correct / data.questions.length) * 100)}%</p>

            <button onclick="renderHome()">Главная</button>
        </div>`;
    }


    function checkChoiceAnswer(index) {

        const correctIndex = data.questions[current].c;
        const cards = document.querySelectorAll(".answer-card");

        // Если уже правильно ответили — блокируем
        if (locked) return;

        if (index === correctIndex) {
            locked = true;

            cards[index].classList.add("correct");
            correct++;

            setTimeout(nextStep, 700);

        } else {
            cards[index].classList.add("wrong");
            wrong++;

            // ❗ НЕ переходим дальше
            // Просто даём попробовать ещё раз
        }
    }


    function normalize(str) {
        return str
            .trim()
            .toLowerCase();
    }


   function checkInputAnswer() {

        const input = document.getElementById("userAnswer");
        const userValue = normalize(input.value);
        const correctAnswer = normalize(data.questions[current].answer);

        if (locked) return;

        if (userValue === correctAnswer) {
            locked = true;

            correct++;
            input.classList.remove("wrong");
            input.classList.add("correct");

            setTimeout(nextStep, 700);

        } else {
            wrong++;
            input.classList.add("wrong");

            // ❗ НЕ переходим дальше
            // Можно пробовать снова
        }
    }

    renderQuestion();
}



/* ===============================
   CUSTOM TEST
================================= */

function shuffleArray(array) {
    // Правильный Fisher–Yates shuffle
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}


function createCustomTest(subjectPath) {

    const checked = document.querySelectorAll(".paragraph-checkbox:checked");

    if (checked.length === 0) {
        alert("Выберите хотя бы один параграф");
        return;
    }

    fetch(subjectPath + "paragraphs.json")
        .then(res => res.json())
        .then(paragraphs => {

            const selectedIds =
                Array.from(checked).map(c => c.value);

            const selectedParagraphs =
                paragraphs.filter(p => selectedIds.includes(p.id));

            const quizPromises = [];

            selectedParagraphs.forEach(p => {
                if (p.quizzes && p.quizzes.length) {
                    p.quizzes.forEach(q => {
                        quizPromises.push(
                            fetch(subjectPath + q.file)
                                .then(res => res.json())
                        );
                    });
                }
            });

            Promise.all(quizPromises)
                .then(quizzes => {

                    let allQuestions = [];

                    quizzes.forEach(q => {
                        allQuestions =
                            allQuestions.concat(q.questions);
                    });

                    if (allQuestions.length === 0) {
                        alert("Для выбранных параграфов нет тестов");
                        return;
                    }

                    shuffleArray(allQuestions);

                    const finalQuestions =
                        allQuestions.length > 20
                            ? allQuestions.slice(0, 20)
                            : allQuestions;

                    startQuiz(
                        {
                            title: "Свой тест",
                            questions: finalQuestions
                        },
                        () => renderSubjectFromPath(subjectPath)
                    );
                });
        });
}



/* ===============================
   HELPERS
================================= */

function renderSubjectFromPath(path) {
    for (const classId in CONFIG.classes) {
        for (const subjectId in CONFIG.classes[classId].subjects) {
            const subject =
                CONFIG.classes[classId].subjects[subjectId];

            if (subject.path === path) {
                renderSubject(classId, subjectId);
                return;
            }
        }
    }
}