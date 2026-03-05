const app = document.getElementById("app");
const breadcrumbs = document.getElementById("breadcrumbs");

function showLoader(message) {
    message = message || "Загрузка...";
    app.innerHTML = "<div class=\"container container--loader\"><div class=\"loader\"></div><p>" + escapeHtml(message) + "</p></div>";
}

function setBreadcrumbs(items) {
    var parts = [];
    items.forEach(function (item) {
        if (item.action) {
            var args = item.args ? JSON.stringify(item.args) : "[]";
            parts.push("<span class=\"breadcrumb-link\" data-action=\"" + escapeHtml(item.action) + "\" data-args=\"" + escapeHtml(args) + "\">" + escapeHtml(item.label) + "</span>");
        } else {
            parts.push(escapeHtml(item.label));
        }
    });
    breadcrumbs.innerHTML = parts.join(" / ");
    breadcrumbs.querySelectorAll(".breadcrumb-link").forEach(function (span) {
        span.addEventListener("click", function () {
            var action = span.getAttribute("data-action");
            var args = [];
            try {
                args = JSON.parse(span.getAttribute("data-args") || "[]");
            } catch (e) {}
            if (typeof window[action] === "function") window[action].apply(null, args);
        });
    });
}

function renderHome() {
    setBreadcrumbs([{ label: "Главная" }]);
    var html = "<div class=\"container\"><h1>Выберите класс</h1>";
    Object.keys(CONFIG.classes).forEach(function (c) {
        html += "<div class=\"card\" data-class-id=\"" + escapeHtml(c) + "\">" + escapeHtml(CONFIG.classes[c].name) + "</div>";
    });
    html += "</div>";
    app.innerHTML = html;
    app.querySelectorAll(".card[data-class-id]").forEach(function (el) {
        el.addEventListener("click", function () {
            renderClass(el.getAttribute("data-class-id"));
        });
    });
}

function renderClass(classId) {
    var subjects = CONFIG.classes[classId].subjects;
    setBreadcrumbs([
        { label: "Главная", action: "renderHome" },
        { label: CONFIG.classes[classId].name }
    ]); // renderClass не нужен в крошках на этой странице
    var html = "<div class=\"container\"><h1>" + escapeHtml(CONFIG.classes[classId].name) + "</h1>";
    Object.keys(subjects).forEach(function (s) {
        html += "<div class=\"card\" data-class-id=\"" + escapeHtml(classId) + "\" data-subject-id=\"" + escapeHtml(s) + "\">" + escapeHtml(subjects[s].name) + "</div>";
    });
    html += "<button id=\"btnBackClass\">Назад</button></div>";
    app.innerHTML = html;
    app.querySelectorAll(".card[data-subject-id]").forEach(function (el) {
        el.addEventListener("click", function () {
            renderSubject(el.getAttribute("data-class-id"), el.getAttribute("data-subject-id"));
        });
    });
    document.getElementById("btnBackClass").addEventListener("click", renderHome);
}

function renderSubject(classId, subjectId) {
    var subject = CONFIG.classes[classId] && CONFIG.classes[classId].subjects && CONFIG.classes[classId].subjects[subjectId];
    if (!subject) {
        app.innerHTML = "<div class=\"container\"><p>Предмет не найден</p></div>";
        return;
    }
    State.setCurrentSubject(classId, subjectId, subject.path);
    showLoader("Загрузка тем...");
    Api.getParagraphs(subject.path)
        .then(function (paragraphs) {
            setBreadcrumbs([
                { label: "Главная", action: "renderHome" },
                { label: CONFIG.classes[classId].name, action: "renderClass", args: [classId] },
                { label: subject.name }
            ]);
            var hasAnyQuiz = paragraphs.some(function (p) { return p.quizzes && p.quizzes.length; });
            var paragraphsHTML = "";
            paragraphs.forEach(function (p) {
                var hasQuiz = p.quizzes && p.quizzes.length;
                paragraphsHTML += "<div class=\"paragraph-item\"><div class=\"card\" data-paragraph-path=\"" + escapeHtml(subject.path) + "\" data-paragraph-id=\"" + escapeHtml(String(p.id)) + "\">" + escapeHtml(p.title || "") + "</div>";
                if (hasQuiz) {
                    paragraphsHTML += "<label class=\"checkbox-label\"><input type=\"checkbox\" value=\"" + escapeHtml(String(p.id)) + "\" class=\"paragraph-checkbox\">Добавить в свой тест</label>";
                } else {
                    paragraphsHTML += "<small class=\"no-quiz\">Тестов пока нет</small>";
                }
                paragraphsHTML += "</div>";
            });
            var html = "<div class=\"container\"><h1>" + escapeHtml(subject.name) + "</h1><h2>Темы</h2>" + paragraphsHTML;
            if (hasAnyQuiz) {
                html += "<button id=\"btnCustomTest\" data-path=\"" + escapeHtml(subject.path) + "\">Составить тест</button>";
            }
            html += "<button id=\"btnBackSubject\">Назад</button></div>";
            app.innerHTML = html;
            app.querySelectorAll(".card[data-paragraph-id]").forEach(function (el) {
                el.addEventListener("click", function () {
                    openParagraph(el.getAttribute("data-paragraph-path"), el.getAttribute("data-paragraph-id"));
                });
            });
            if (hasAnyQuiz) {
                document.getElementById("btnCustomTest").addEventListener("click", function () {
                    createCustomTest(this.getAttribute("data-path"));
                });
            }
            document.getElementById("btnBackSubject").addEventListener("click", function () { renderClass(classId); });
        })
        .catch(function (err) {
            app.innerHTML = "<div class=\"container\"><p>Ошибка загрузки тем.</p><button id=\"btnErrorBack\">Назад</button></div>";
            document.getElementById("btnErrorBack").addEventListener("click", renderHome);
            console.error(err);
        });
}

renderHome();