/**
 * Панель: список студентов и их статистика (Firestore).
 */
(function (global) {
    "use strict";

    var UI = global.AdminUI;
    var Sanitize = global.AdminSanitize;

    function render(container) {
        container.innerHTML = "<h2>Студенты</h2><div class=\"loader\"></div><p>Загрузка...</p>";

        if (!global.AdminFirebaseBridge || typeof global.AdminFirebaseBridge.ensureAdminOrLock !== "function") {
            container.innerHTML = "<h2>Студенты</h2><p class=\"admin-empty\">Firebase bridge не подключён.</p>";
            return;
        }

        global.AdminFirebaseBridge.ensureAdminOrLock().then(function (ok) {
            if (!ok) return;
            return global.AdminFirebaseBridge.listStudents(200);
        }).then(function (students) {
            if (!students) return;
            var html = "<h2>Студенты</h2>";
            if (students.length === 0) {
                html += "<p class=\"admin-empty\">Пока нет зарегистрированных студентов.</p>";
                container.innerHTML = html;
                return;
            }
            html += "<p class=\"admin-empty\">Нажмите на студента, чтобы увидеть последние результаты.</p>";
            html += "<div class=\"admin-students-grid\">";
            students.forEach(function (s) {
                var name = s.displayName || s.email || s.uid;
                html += "<div class=\"card\" data-student-uid=\"" + Sanitize.escapeHtml(String(s.uid)) + "\"><strong>" + Sanitize.escapeHtml(String(name)) + "</strong><div style=\"font-size:12px; opacity:.8\">" + Sanitize.escapeHtml(String(s.uid)) + "</div></div>";
            });
            html += "</div><div id=\"admin-student-details\"></div>";
            container.innerHTML = html;

            container.querySelectorAll("[data-student-uid]").forEach(function (el) {
                el.addEventListener("click", function () {
                    var uid = el.getAttribute("data-student-uid");
                    showStudent(uid);
                });
            });
        }).catch(function (e) {
            container.innerHTML = "<h2>Студенты</h2><p>Не удалось загрузить студентов.</p>";
            if (UI && UI.showError) UI.showError("Ошибка загрузки студентов");
            console.error(e);
        });
    }

    function showStudent(uid) {
        var details = document.getElementById("admin-student-details");
        if (!details) return;
        details.innerHTML = "<h3>Результаты</h3><div class=\"loader\"></div><p>Загрузка...</p>";

        global.AdminFirebaseBridge.listAttemptsForUser(uid, 50).then(function (items) {
            var html = "<h3>Результаты</h3>";
            if (!items || items.length === 0) {
                html += "<p class=\"admin-empty\">У этого студента пока нет результатов.</p>";
                details.innerHTML = html;
                return;
            }
            html += "<ul class=\"admin-list\">";
            items.forEach(function (it) {
                var title = it.quizTitle || it.quizId || "Тест";
                var score = it.score != null ? String(it.score) : "0";
                var correct = it.correct != null ? String(it.correct) : "";
                var total = it.total != null ? String(it.total) : "";
                var finishedAt = it.finishedAt && it.finishedAt.toDate ? it.finishedAt.toDate().toLocaleString() : (it.finishedAt || "");
                html += "<li class=\"admin-list__item\"><span><strong>" + Sanitize.escapeHtml(String(title)) + "</strong><br><small>Результат: " + Sanitize.escapeHtml(score) + "% (" + Sanitize.escapeHtml(correct) + "/" + Sanitize.escapeHtml(total) + ")</small>" + (finishedAt ? "<br><small>" + Sanitize.escapeHtml(String(finishedAt)) + "</small>" : "") + "</span></li>";
            });
            html += "</ul>";
            details.innerHTML = html;
        }).catch(function (e) {
            details.innerHTML = "<h3>Результаты</h3><p>Не удалось загрузить результаты.</p>";
            console.error(e);
        });
    }

    global.Admin.registerPanel("students", render);
})(typeof window !== "undefined" ? window : this);

