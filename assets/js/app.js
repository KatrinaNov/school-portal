const app = document.getElementById("app");
const breadcrumbs = document.getElementById("breadcrumbs");

/** Маршрутизация по hash: #/ , #/class/:id , #/class/:id/:subject , #/class/:id/:subject/paragraph/:id , #/class/:id/:subject/quiz/:slug */
var Router = (function () {
    function getRoute() {
        var h = location.hash;
        if (!h && location.href.indexOf("#") !== -1) {
            h = "#" + location.href.split("#")[1];
        }
        var raw = (h || "").replace(/^#/, "");
        try { raw = decodeURIComponent(raw); } catch (e) {}
        var parts = raw ? raw.split("/").filter(Boolean) : [];
        if (parts[0] !== "class") {
            return { page: "home" };
        }
        var classId = parts[1];
        if (!classId) return { page: "home" };
        if (!parts[2]) return { page: "class", classId: classId };
        var subjectId = parts[2];
        if (parts[3] === "paragraph" && parts[4]) return { page: "paragraph", classId: classId, subjectId: subjectId, paragraphId: parts[4] };
        if (parts[3] === "quiz" && parts[4]) return { page: "quiz", classId: classId, subjectId: subjectId, quizSlug: parts[4] };
        return { page: "subject", classId: classId, subjectId: subjectId };
    }

    function dispatch(route) {
        if (route.page === "home") {
            renderHome();
            return;
        }
        if (route.page === "class" && route.classId) {
            renderClass(route.classId);
            return;
        }
        if (route.page === "subject" && route.classId && route.subjectId) {
            renderSubject(route.classId, route.subjectId);
            return;
        }
        if (route.page === "paragraph" && route.classId && route.subjectId && route.paragraphId) {
            var path = typeof CONFIG !== "undefined" && CONFIG.classes[route.classId] && CONFIG.classes[route.classId].subjects[route.subjectId]
                ? CONFIG.classes[route.classId].subjects[route.subjectId].path : null;
            if (path && typeof openParagraph === "function") {
                if (typeof State !== "undefined" && State.setCurrentSubject) State.setCurrentSubject(route.classId, route.subjectId, path);
                openParagraph(path, route.paragraphId);
            } else if (typeof renderHome === "function") renderHome();
            return;
        }
        if (route.page === "quiz" && route.classId && route.subjectId && route.quizSlug) {
            var subj = typeof CONFIG !== "undefined" && CONFIG.classes[route.classId] && CONFIG.classes[route.classId].subjects[route.subjectId];
            var path = subj ? subj.path + route.quizSlug + ".json" : null;
            if (path && typeof loadQuiz === "function") {
                loadQuiz(path, function () { Router.navigate(Router.hashForSubject(route.classId, route.subjectId)); });
            } else if (typeof renderHome === "function") renderHome();
            return;
        }
        if (typeof renderHome === "function") renderHome();
    }

    function onHashChange() {
        dispatch(getRoute());
    }

    return {
        getRoute: getRoute,
        navigate: function (hash) {
            var h = (hash || "").indexOf("#") === 0 ? hash : "#" + (hash ? "/" + hash.replace(/^\//, "") : "");
            if (location.hash !== h) location.hash = h;
            else dispatch(getRoute());
        },
        hashForHome: function () { return "#/"; },
        hashForClass: function (classId) { return "#/class/" + encodeURIComponent(classId); },
        hashForSubject: function (classId, subjectId) { return "#/class/" + encodeURIComponent(classId) + "/" + encodeURIComponent(subjectId); },
        hashForParagraph: function (classId, subjectId, paragraphId) { return "#/class/" + encodeURIComponent(classId) + "/" + encodeURIComponent(subjectId) + "/paragraph/" + encodeURIComponent(String(paragraphId)); },
        hashForQuiz: function (classId, subjectId, quizSlug) { return "#/class/" + encodeURIComponent(classId) + "/" + encodeURIComponent(subjectId) + "/quiz/" + encodeURIComponent(quizSlug); },
        hashFromPath: function (path) {
            if (!path || typeof CONFIG === "undefined" || !CONFIG.classes) return "#/";
            var p = path.replace(/\/$/, "");
            var c = CONFIG.classes;
            for (var classId in c) {
                if (!c.hasOwnProperty(classId) || !c[classId].subjects) continue;
                for (var subjectId in c[classId].subjects) {
                    if (c[classId].subjects[subjectId].path.replace(/\/$/, "") === p) return this.hashForSubject(classId, subjectId);
                }
            }
            return "#/";
        },
        init: function () {
            window.addEventListener("hashchange", onHashChange);
            // Первый разбор — после загрузки всех скриптов, чтобы hash уже был в URL
            setTimeout(function () { onHashChange(); }, 0);
        }
    };
})();

function goHome() { Router.navigate(Router.hashForHome()); }
function goClass(classId) { Router.navigate(Router.hashForClass(classId)); }
function goSubject(classId, subjectId) { Router.navigate(Router.hashForSubject(classId, subjectId)); }

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
    var html = "<div class=\"container\">";
    html += "<div class=\"home-hero\">";
    html += "<h1>Привет! Здесь можно учиться и играть</h1>";
    html += "<p class=\"hero-tagline\">Выбери класс, открой предмет — читай темы и проходи тесты. Удачи!</p>";
    html += "</div>";
    html += "<p class=\"home-classes-title\">Выберите класс</p>";
    Object.keys(CONFIG.classes).forEach(function (c) {
        html += "<div class=\"card\" data-class-id=\"" + escapeHtml(c) + "\">" + escapeHtml(CONFIG.classes[c].name) + "</div>";
    });
    html += "</div>";
    app.innerHTML = html;
    app.querySelectorAll(".card[data-class-id]").forEach(function (el) {
        el.addEventListener("click", function () {
            Router.navigate(Router.hashForClass(el.getAttribute("data-class-id")));
        });
    });
}

function renderClass(classId) {
    var subjects = CONFIG.classes[classId].subjects;
    setBreadcrumbs([
        { label: "Главная", action: "goHome" },
        { label: CONFIG.classes[classId].name }
    ]);
    var html = "<div class=\"container\"><h1>" + escapeHtml(CONFIG.classes[classId].name) + "</h1>";
    Object.keys(subjects).forEach(function (s) {
        html += "<div class=\"card\" data-class-id=\"" + escapeHtml(classId) + "\" data-subject-id=\"" + escapeHtml(s) + "\">" + escapeHtml(subjects[s].name) + "</div>";
    });
    html += "<button id=\"btnBackClass\">Назад</button></div>";
    app.innerHTML = html;
    app.querySelectorAll(".card[data-subject-id]").forEach(function (el) {
        el.addEventListener("click", function () {
            Router.navigate(Router.hashForSubject(el.getAttribute("data-class-id"), el.getAttribute("data-subject-id")));
        });
    });
    document.getElementById("btnBackClass").addEventListener("click", function () { Router.navigate(Router.hashForHome()); });
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
                { label: "Главная", action: "goHome" },
                { label: CONFIG.classes[classId].name, action: "goClass", args: [classId] },
                { label: subject.name }
            ]);
            var hasAnyQuiz = paragraphs.some(function (p) { return p.quizzes && p.quizzes.length; });
            var hasAnyData = paragraphs.some(function (p) {
                return (p.dates && p.dates.length) || (p.terms && p.terms.length) || (p.people && p.people.length);
            });
            var canBuildTest = hasAnyQuiz || hasAnyData;
            var quizzesList = [];
            var seenSlugs = {};
            paragraphs.forEach(function (p) {
                if (p.quizzes && p.quizzes.length) {
                    p.quizzes.forEach(function (q) {
                        var slug = (q && q.file) ? String(q.file).replace(/\.json$/i, "") : "";
                        if (slug && !seenSlugs[slug]) {
                            seenSlugs[slug] = true;
                            quizzesList.push({ slug: slug, title: (q && q.title) || "Тест" });
                        }
                    });
                }
            });
            var showOnlyQuizzes = subject.showOnlyQuizzes === true;
            var quizzesHTML = "";
            if (quizzesList.length > 0) {
                quizzesHTML = "<h2>Тесты</h2><div class=\"subject-quiz-list\">";
                quizzesList.forEach(function (q) {
                    quizzesHTML += "<div class=\"card quiz-card\" data-class-id=\"" + escapeHtml(classId) + "\" data-subject-id=\"" + escapeHtml(subjectId) + "\" data-quiz-slug=\"" + escapeHtml(q.slug) + "\">" + escapeHtml(q.title) + "</div>";
                });
                quizzesHTML += "</div>";
            }
            var paragraphsHTML = "";
            if (!showOnlyQuizzes) {
                paragraphs.forEach(function (p) {
                    var hasQuiz = p.quizzes && p.quizzes.length;
                    var hasData = (p.dates && p.dates.length) || (p.terms && p.terms.length) || (p.people && p.people.length);
                    var showCheckbox = hasQuiz || hasData;
                    paragraphsHTML += "<div class=\"paragraph-item\"><div class=\"card\" data-paragraph-path=\"" + escapeHtml(subject.path) + "\" data-paragraph-id=\"" + escapeHtml(String(p.id)) + "\">" + escapeHtml(p.title || "") + "</div>";
                    if (showCheckbox) {
                        paragraphsHTML += "<label class=\"checkbox-label\"><input type=\"checkbox\" value=\"" + escapeHtml(String(p.id)) + "\" class=\"paragraph-checkbox\">Добавить в свой тест</label>";
                    } else {
                        paragraphsHTML += "<small class=\"no-quiz\">Тестов пока нет</small>";
                    }
                    paragraphsHTML += "</div>";
                });
            }
            var typeSelect = "";
            if (canBuildTest && typeof QuizGenerators !== "undefined" && QuizGenerators.SOURCE_PARAGRAPHS) {
                typeSelect = "<div class=\"form-group form-group--inline\"><label for=\"customTestType\">Тип теста:</label><select id=\"customTestType\">" +
                    "<option value=\"" + escapeHtml(QuizGenerators.SOURCE_PARAGRAPHS) + "\">По тестам параграфов</option>" +
                    "<option value=\"" + escapeHtml(QuizGenerators.SOURCE_DATES) + "\">По датам</option>" +
                    "<option value=\"" + escapeHtml(QuizGenerators.SOURCE_TERMS) + "\">По понятиям</option>" +
                    "<option value=\"" + escapeHtml(QuizGenerators.SOURCE_PEOPLE) + "\">По персонам</option>" +
                    "<option value=\"" + escapeHtml(QuizGenerators.SOURCE_COMBINED) + "\">Комбинированный</option>" +
                    "</select></div>";
            }
            var limitSelect = "";
            if (canBuildTest) {
                limitSelect = "<div class=\"form-group form-group--inline\"><label for=\"customTestLimit\">Вопросов в тесте:</label><input type=\"number\" id=\"customTestLimit\" min=\"1\" max=\"50\" value=\"20\" step=\"1\"></div>";
            }
            var themesBlock = showOnlyQuizzes ? "" : "<h2>Темы</h2>" + paragraphsHTML;
            var html = "<div class=\"container\"><h1>" + escapeHtml(subject.name) + "</h1>" + quizzesHTML + themesBlock;
            if (canBuildTest && !showOnlyQuizzes) {
                html += "<div class=\"custom-test-actions\">" + typeSelect + limitSelect + "<button id=\"btnCustomTest\" data-path=\"" + escapeHtml(subject.path) + "\">Составить тест</button></div>";
            }
            html += "<button id=\"btnBackSubject\">Назад</button></div>";
            app.innerHTML = html;
            app.querySelectorAll(".quiz-card[data-quiz-slug]").forEach(function (el) {
                el.addEventListener("click", function () {
                    var cid = el.getAttribute("data-class-id");
                    var sid = el.getAttribute("data-subject-id");
                    var slug = el.getAttribute("data-quiz-slug");
                    if (cid && sid && slug && typeof Router !== "undefined" && Router.navigate && Router.hashForQuiz) {
                        Router.navigate(Router.hashForQuiz(cid, sid, slug));
                    }
                });
            });
            app.querySelectorAll(".card[data-paragraph-id]").forEach(function (el) {
                el.addEventListener("click", function () {
                    Router.navigate(Router.hashForParagraph(classId, subjectId, el.getAttribute("data-paragraph-id")));
                });
            });
            var btnCustomTest = document.getElementById("btnCustomTest");
            if (btnCustomTest) {
                btnCustomTest.addEventListener("click", function () {
                    var path = this.getAttribute("data-path");
                    var typeEl = document.getElementById("customTestType");
                    var type = typeEl ? typeEl.value : undefined;
                    var limitEl = document.getElementById("customTestLimit");
                    var limit = 20;
                    if (limitEl) {
                        var n = parseInt(limitEl.value, 10);
                        if (!isNaN(n) && n >= 1 && n <= 50) limit = n;
                    }
                    createCustomTest(path, type, limit);
                });
            }
            var btnBackSubject = document.getElementById("btnBackSubject");
            if (btnBackSubject) btnBackSubject.addEventListener("click", function () { Router.navigate(Router.hashForClass(classId)); });
        })
        .catch(function (err) {
            app.innerHTML = "<div class=\"container\"><p>Ошибка загрузки тем.</p><button id=\"btnErrorBack\">Назад</button></div>";
            var btnErrorBack = document.getElementById("btnErrorBack");
            if (btnErrorBack) btnErrorBack.addEventListener("click", function () { Router.navigate(Router.hashForHome()); });
            console.error(err);
        });
}

Router.init();