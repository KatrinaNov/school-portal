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

            function imageHtml(basePath, imageValue) {
                if (!imageValue || typeof imageValue !== "string") return "";
                var v = imageValue.trim();
                if (!v || /javascript:|data:\s*text\/html/i.test(v)) return "";
                var src = (v.indexOf("/") === 0 || v.indexOf("http") === 0) ? v : (basePath + v.replace(/^\.\//, ""));
                return "<img src=\"" + escapeHtml(src) + "\" alt=\"\" class=\"content-image\" loading=\"lazy\">";
            }

            var paragraphImageHtml = imageHtml(path, p.image);

            var sectionsHtml = "";
            if (p.sections && p.sections.length) {
                sectionsHtml = "<h2>Основные разделы</h2>";
                p.sections.forEach(function (s) {
                    var sectionImg = imageHtml(path, s && s.image);
                    sectionsHtml += "<div class=\"section-block\"><h3>" + escapeHtml((s && s.title) || "") + "</h3>" + (sectionImg ? "<div class=\"section-image\">" + sectionImg + "</div>" : "") + "<p>" + formatParagraphText((s && s.content) || "") + "</p></div>";
                });
            }

            var datesHtml = "";
            if (p.dates && p.dates.length) {
                datesHtml = "<h2>Важные даты</h2><ul>";
                p.dates.forEach(function (d) {
                    var dateImg = imageHtml(path, d && d.image);
                    datesHtml += "<li>" + (dateImg ? "<span class=\"date-image\">" + dateImg + "</span>" : "") + "<strong>" + escapeHtml((d && d.year) || "") + "</strong> — " + escapeHtml((d && d.event) || "") + "</li>";
                });
                datesHtml += "</ul>";
            }

            var termsHtml = "";
            if (p.terms && p.terms.length) {
                termsHtml = "<h2>Понятия</h2><ul>";
                p.terms.forEach(function (t) {
                    var termImg = imageHtml(path, t && t.image);
                    termsHtml += "<li>" + (termImg ? "<span class=\"term-image\">" + termImg + "</span>" : "") + "<strong>" + escapeHtml((t && t.term) || "") + "</strong> — " + escapeHtml((t && t.definition) || "") + "</li>";
                });
                termsHtml += "</ul>";
            }

            var peopleHtml = "";
            if (p.people && p.people.length) {
                peopleHtml = "<h2>Исторические личности</h2><ul>";
                p.people.forEach(function (person) {
                    var personImg = imageHtml(path, person && person.image);
                    peopleHtml += "<li>" + (personImg ? "<span class=\"person-image\">" + personImg + "</span>" : "") + "<strong>" + escapeHtml((person && person.name) || "") + "</strong> — " + escapeHtml((person && person.info) || "") + "</li>";
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

            app.innerHTML = "<div class=\"container\"><h1>" + escapeHtml(p.title || "") + "</h1>" + (paragraphImageHtml ? "<div class=\"paragraph-image\">" + paragraphImageHtml + "</div>" : "") + "<h2>Кратко</h2><p>" + formatParagraphText(p.summary || "") + "</p>" + sectionsHtml + datesHtml + termsHtml + peopleHtml + quizHtml + "<button class=\"secondary\" id=\"btnBackToSubject\">Назад к предмету</button></div>";

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
