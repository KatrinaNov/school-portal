/* ===============================
   Загрузка списка параграфов
================================= */

function loadParagraphs(path) {

    fetch(path + "paragraphs.json")
        .then(res => res.json())
        .then(data => {

            app.innerHTML = `
            <div class="container">
                <h1>Параграфы</h1>

                ${data.map(p => `
                    <div class="card" 
                         onclick="openParagraph('${path}', '${p.id}')">
                        <h2>${p.title}</h2>
                        <p>${p.summary}</p>
                    </div>
                `).join("")}

                <button onclick="renderHome()">
                    Главная
                </button>
            </div>
            `;
        })
        .catch(() => {
            app.innerHTML = `
            <div class="container">
                <h1>Ошибка загрузки</h1>
                <button onclick="renderHome()">Главная</button>
            </div>`;
        });
}


/* ===============================
   Открытие конкретного параграфа
================================= */

function openParagraph(path, id) {

    fetch(path + "paragraphs.json")
        .then(res => res.json())
        .then(data => {

            const p = data.find(item => item.id === id);

            if (!p) {
                app.innerHTML = `
                <div class="container">
                    <h1>Параграф не найден</h1>
                    <button onclick="renderHome()">Главная</button>
                </div>`;
                return;
            }

            /* ====== РЕНДЕР РАЗДЕЛОВ ====== */

            const sectionsHtml =
                p.sections && p.sections.length
                    ? `
                        <h2>Основные разделы</h2>
                        ${p.sections.map(s => `
                            <div class="section-block">
                                <h3>${s.title}</h3>
                                <p>${s.content}</p>
                            </div>
                        `).join("")}
                      `
                    : "";


            /* ====== ДАТЫ ====== */

            const datesHtml =
                p.dates && p.dates.length
                    ? `
                        <h2>Важные даты</h2>
                        <ul>
                            ${p.dates.map(d =>
                                `<li><strong>${d.year}</strong> — ${d.event}</li>`
                            ).join("")}
                        </ul>
                      `
                    : "";


            /* ====== ПОНЯТИЯ ====== */

            const termsHtml =
                p.terms && p.terms.length
                    ? `
                        <h2>Понятия</h2>
                        <ul>
                            ${p.terms.map(t =>
                                `<li><strong>${t.term}</strong> — ${t.definition}</li>`
                            ).join("")}
                        </ul>
                      `
                    : "";


            /* ====== ЛЮДИ ====== */

            const peopleHtml =
                p.people && p.people.length
                    ? `
                        <h2>Исторические личности</h2>
                        <ul>
                            ${p.people.map(person =>
                                `<li><strong>${person.name}</strong> — ${person.info}</li>`
                            ).join("")}
                        </ul>
                      `
                    : "";


            /* ====== ТЕСТЫ ====== */

            const quizHtml =
                p.quizzes && p.quizzes.length
                    ? `
                        <h2>Тесты по теме</h2>
                        ${p.quizzes.map(q =>
                            `<div class="card"
                                onclick="loadQuiz(
                                    '${path}${q.file}',
                                    () => openParagraph('${path}','${p.id}')
                                )">
                                ${q.title}
                            </div>`
                        ).join("")}
                      `
                    : `<p><em>Тестов пока нет</em></p>`;


            /* ====== ВЫВОД ====== */

            app.innerHTML = `
            <div class="container">
                <h1>${p.title}</h1>

                <h2>Кратко</h2>
                <p>${p.summary}</p>

                ${sectionsHtml}
                ${datesHtml}
                ${termsHtml}
                ${peopleHtml}
                ${quizHtml}

                <button class="secondary"
                        onclick="renderSubjectFromPath('${path}')">
                    Назад к предмету
                </button>
            </div>
            `;


            /* ====== ХЛЕБНЫЕ КРОШКИ ====== */

            setBreadcrumbs([
                { label: "Главная", action: "renderHome()" },
                { label: "6 класс", action: "renderClass('6')" },
                { label: "История Беларуси", action: "renderSubject('6','history')" },
                { label: p.title }
            ]);

        })
        .catch(() => {
            app.innerHTML = `
            <div class="container">
                <h1>Ошибка загрузки параграфа</h1>
                <button onclick="renderHome()">Главная</button>
            </div>`;
        });
}