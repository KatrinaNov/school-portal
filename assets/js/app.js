const app = document.getElementById("app");
const breadcrumbs = document.getElementById("breadcrumbs");

function setBreadcrumbs(items) {
    breadcrumbs.innerHTML = items.map((item, i) => {
        if(item.action) {
            return `<span onclick="${item.action}">${item.label}</span>`;
        }
        return item.label;
    }).join(" / ");
}

function renderHome() {
    setBreadcrumbs([{label:"Главная"}]);

    app.innerHTML = `
    <div class="container">
        <h1>Выберите класс</h1>
        ${Object.keys(CONFIG.classes).map(c =>
            `<div class="card" onclick="renderClass('${c}')">
                ${CONFIG.classes[c].name}
            </div>`
        ).join("")}
    </div>`;
}

function renderClass(classId) {
    const subjects = CONFIG.classes[classId].subjects;
    setBreadcrumbs([
        {label:"Главная", action:"renderHome()"},
        {label: CONFIG.classes[classId].name}
    ]);

    app.innerHTML = `<div class="container">
        <h1>${CONFIG.classes[classId].name}</h1>
        ${Object.keys(subjects).map(s =>
            `<div class="card" onclick="renderSubject('${classId}','${s}')">
                ${subjects[s].name}
            </div>`
        ).join("")}
        <button onclick="renderHome()">Назад</button>
    </div>`;
}

function renderSubject(classId, subjectId) {
    const subject = CONFIG.classes[classId]?.subjects?.[subjectId];

    if (!subject) {
        app.innerHTML = `<div class="container"><p>Предмет не найден</p></div>`;
        return;
    }

    fetch(subject.path + "paragraphs.json")
        .then(res => {
            if (!res.ok) throw new Error("Ошибка загрузки данных");
            return res.json();
        })
        .then(paragraphs => {

            setBreadcrumbs([
                {label:"Главная", action:"renderHome()"},
                {label: CONFIG.classes[classId].name, action:`renderClass('${classId}')`},
                {label: subject.name}
            ]);

            const hasAnyQuiz = paragraphs.some(
                p => p.quizzes && p.quizzes.length
            );

            const paragraphsHTML = paragraphs.map(p => {

                const hasQuiz = p.quizzes && p.quizzes.length;

                return `
                    <div class="paragraph-item">
                        <div class="card"
                            onclick="openParagraph('${subject.path}','${p.id}')">
                            ${p.title}
                        </div>

                        ${
                            hasQuiz
                            ? `
                                <label class="checkbox-label">
                                    <input type="checkbox"
                                        value="${p.id}"
                                        class="paragraph-checkbox">
                                    Добавить в свой тест
                                </label>
                              `
                            : `<small class="no-quiz">Тестов пока нет</small>`
                        }
                    </div>
                `;
            }).join("");

            app.innerHTML = `
                <div class="container">
                    <h1>${subject.name}</h1>

                    <h2>Темы</h2>

                    ${paragraphsHTML}

                    ${
                        hasAnyQuiz
                        ? `
                            <button onclick="createCustomTest('${subject.path}')">
                                Составить тест
                            </button>
                          `
                        : ""
                    }

                    <button onclick="renderClass('${classId}')">
                        Назад
                    </button>
                </div>
            `;
        })
        .catch(err => {
            app.innerHTML = `
                <div class="container">
                    <p>Ошибка загрузки тем.</p>
                </div>
            `;
            console.error(err);
        });
}

renderHome();