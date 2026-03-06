/* ===============================
   Открытие конкретного параграфа
   (loadParagraphs не используется — список тем в renderSubject)
================================= */

function openParagraph(path, id) {
    showLoader("Загрузка параграфа...");
    Api.getParagraphs(path)
        .then(function (data) {
            var p = data.find(function (item) { return String(item.id) === String(id); });
            if (!p) {
                app.innerHTML = "<div class=\"container\"><h1>Параграф не найден</h1><button id=\"btnBack\">Главная</button></div>";
                document.getElementById("btnBack").addEventListener("click", function () { if (typeof Router !== "undefined" && Router.navigate) Router.navigate(Router.hashForHome()); });
                return;
            }
            var curr = State.getCurrentSubject();
            var classId = curr.classId;
            var subjectId = curr.subjectId;
            var subjectName = (CONFIG.classes[classId] && CONFIG.classes[classId].subjects[subjectId]) ? CONFIG.classes[classId].subjects[subjectId].name : "Предмет";

            var sectionsHtml = "";
            if (p.sections && p.sections.length) {
                sectionsHtml = "<h2>Основные разделы</h2>";
                p.sections.forEach(function (s) {
                    sectionsHtml += "<div class=\"section-block\"><h3>" + escapeHtml((s && s.title) || "") + "</h3><p>" + formatParagraphText((s && s.content) || "") + "</p></div>";
                });
            }

            var datesHtml = "";
            if (p.dates && p.dates.length) {
                datesHtml = "<h2>Важные даты</h2><ul>";
                p.dates.forEach(function (d) {
                    datesHtml += "<li><strong>" + escapeHtml((d && d.year) || "") + "</strong> — " + escapeHtml((d && d.event) || "") + "</li>";
                });
                datesHtml += "</ul>";
            }

            var termsHtml = "";
            if (p.terms && p.terms.length) {
                termsHtml = "<h2>Понятия</h2><ul>";
                p.terms.forEach(function (t) {
                    termsHtml += "<li><strong>" + escapeHtml((t && t.term) || "") + "</strong> — " + escapeHtml((t && t.definition) || "") + "</li>";
                });
                termsHtml += "</ul>";
            }

            var peopleHtml = "";
            if (p.people && p.people.length) {
                peopleHtml = "<h2>Исторические личности</h2><ul>";
                p.people.forEach(function (person) {
                    peopleHtml += "<li><strong>" + escapeHtml((person && person.name) || "") + "</strong> — " + escapeHtml((person && person.info) || "") + "</li>";
                });
                peopleHtml += "</ul>";
            }

            var quizHtml = "";
            if (p.quizzes && p.quizzes.length) {
                quizHtml = "<h2>Тесты по теме</h2>";
                p.quizzes.forEach(function (q) {
                    var quizPath = path + (q && q.file || "");
                    var quizSlug = (q && q.file) ? String(q.file).replace(/\.json$/i, "") : "";
                    var quizTitle = (q && q.title) || "Тест";
                    quizHtml += "<div class=\"card quiz-card\" data-class-id=\"" + escapeHtml(String(classId)) + "\" data-subject-id=\"" + escapeHtml(String(subjectId)) + "\" data-quiz-slug=\"" + escapeHtml(quizSlug) + "\">" + escapeHtml(quizTitle) + "</div>";
                });
                quizHtml += "";
            } else {
                quizHtml = "<p><em>Тестов пока нет</em></p>";
            }

            setBreadcrumbs([
                { label: "Главная", action: "goHome" },
                { label: (CONFIG.classes[classId] && CONFIG.classes[classId].name) || "", action: "goClass", args: [classId] },
                { label: subjectName, action: "goSubject", args: [classId, subjectId] },
                { label: (p.title || "") }
            ]);

            app.innerHTML = "<div class=\"container\"><h1>" + escapeHtml(p.title || "") + "</h1><h2>Кратко</h2><p>" + formatParagraphText(p.summary || "") + "</p>" + sectionsHtml + datesHtml + termsHtml + peopleHtml + quizHtml + "<button class=\"secondary\" id=\"btnBackToSubject\">Назад к предмету</button></div>";

            app.querySelectorAll(".quiz-card").forEach(function (el) {
                el.addEventListener("click", function () {
                    var cid = el.getAttribute("data-class-id");
                    var sid = el.getAttribute("data-subject-id");
                    var slug = el.getAttribute("data-quiz-slug");
                    if (typeof Router !== "undefined" && Router.navigate && Router.hashForQuiz && cid && sid && slug) {
                        Router.navigate(Router.hashForQuiz(cid, sid, slug));
                    }
                });
            });
            document.getElementById("btnBackToSubject").addEventListener("click", function () {
                if (classId != null && subjectId != null && typeof Router !== "undefined" && Router.navigate) Router.navigate(Router.hashForSubject(classId, subjectId));
                else if (typeof renderSubjectFromPath === "function") renderSubjectFromPath(path);
            });
        })
        .catch(function () {
            app.innerHTML = "<div class=\"container\"><h1>Ошибка загрузки параграфа</h1><button id=\"btnBack\">Главная</button></div>";
            document.getElementById("btnBack").addEventListener("click", function () { if (typeof Router !== "undefined" && Router.navigate) Router.navigate(Router.hashForHome()); });
        });
}
