/* Страница профиля студента: статистика по тестам (Firestore). */
(function () {
    "use strict";

    function renderMe() {
        var app = document.getElementById("app");
        if (!app) return;

        var user = typeof window !== "undefined" ? window.__authUser : null;
        var isAdmin = typeof window !== "undefined" && window.__isAdmin === true;
        if (!user) {
            app.innerHTML = "<div class=\"container\"><h1>Профиль</h1><p>Вы сейчас в гостевом режиме. Войдите, чтобы сохранялась статистика.</p><button type=\"button\" class=\"secondary\" id=\"btnGoHome\">На главную</button></div>";
            var b = document.getElementById("btnGoHome");
            if (b && typeof Router !== "undefined" && Router.navigate) b.addEventListener("click", function () { Router.navigate(Router.hashForHome()); });
            return;
        }

        app.innerHTML = "<div class=\"container\"><h1>Мой профиль</h1><p><strong>" + (typeof escapeHtml === "function" ? escapeHtml(user.displayName || user.email || user.uid) : (user.displayName || user.email || user.uid)) + "</strong></p><div class=\"loader\"></div><p>Загрузка статистики...</p><button type=\"button\" class=\"secondary\" id=\"btnGoHome\">На главную</button></div>";
        var back = document.getElementById("btnGoHome");
        if (back && typeof Router !== "undefined" && Router.navigate) back.addEventListener("click", function () { Router.navigate(Router.hashForHome()); });

        if (!window.FirestoreStats || typeof window.FirestoreStats.listQuizAttempts !== "function") {
            app.innerHTML = "<div class=\"container\"><h1>Мой профиль</h1><p>Статистика недоступна.</p><button type=\"button\" class=\"secondary\" id=\"btnGoHome\">На главную</button></div>";
            var b2 = document.getElementById("btnGoHome");
            if (b2 && typeof Router !== "undefined" && Router.navigate) b2.addEventListener("click", function () { Router.navigate(Router.hashForHome()); });
            return;
        }

        window.FirestoreStats.listQuizAttempts(user.uid, 50).then(function (items) {
            var html = "<div class=\"container\"><h1>Мой профиль</h1><p><strong>" + (typeof escapeHtml === "function" ? escapeHtml(user.displayName || user.email || user.uid) : (user.displayName || user.email || user.uid)) + "</strong></p>";

            if (isAdmin) {
                html += "<h2>Администратор</h2>";
                html += "<div class=\"stats-list\">";
                html += "<div class=\"card stats-card\"><div><strong>Редактирование материала</strong></div><div>Открыть админ-панель и редактировать классы, предметы, параграфы и тесты.</div><div style=\"margin-top:10px\"><a class=\"admin-link\" href=\"admin.html#panel=classes\">Перейти в админку</a></div></div>";
                html += "<div class=\"card stats-card\"><div><strong>Статистика пользователей</strong></div><div>Список студентов и их результаты.</div><div style=\"margin-top:10px\"><a class=\"admin-link\" href=\"admin.html#panel=students\">Открыть статистику</a></div></div>";
                html += "</div>";

                // Quick overview of current content from CONFIG (always available).
                try {
                    var c = typeof CONFIG !== "undefined" && CONFIG && CONFIG.classes ? CONFIG.classes : null;
                    if (c) {
                        html += "<h2>Текущие данные</h2>";
                        html += "<ul>";
                        Object.keys(c).forEach(function (classId) {
                            var cls = c[classId];
                            var subj = cls && cls.subjects ? cls.subjects : {};
                            var subjCount = Object.keys(subj).length;
                            html += "<li><strong>" + (typeof escapeHtml === "function" ? escapeHtml(String(cls.name || classId)) : String(cls.name || classId)) + "</strong> — предметов: " + subjCount + "</li>";
                        });
                        html += "</ul>";
                    }
                } catch (e) { }
            }

            html += "<h2>Статистика</h2>";
            if (!items || items.length === 0) {
                html += "<p><em>Пока нет результатов. Пройдите любой тест — и он появится здесь.</em></p>";
            } else {
                var doneCount = items.length;
                var avg = 0;
                var cnt = 0;
                items.forEach(function (it) { if (it && it.score != null && !isNaN(Number(it.score))) { avg += Number(it.score); cnt++; } });
                var avgScore = cnt > 0 ? Math.round(avg / cnt) : 0;
                html += "<p><strong>Пройдено тестов:</strong> " + doneCount + (cnt ? (" · <strong>Средний результат:</strong> " + avgScore + "%") : "") + "</p>";
                html += "<div class=\"stats-list\">";
                items.forEach(function (it) {
                    var title = it.quizTitle || it.quizId || "Тест";
                    var score = (it.score != null) ? String(it.score) : "0";
                    var total = (it.total != null) ? String(it.total) : "";
                    var correct = (it.correct != null) ? String(it.correct) : "";
                    var finishedAt = it.finishedAt && it.finishedAt.toDate ? it.finishedAt.toDate().toLocaleString() : (it.finishedAt || "");
                    html += "<div class=\"card stats-card\"><div><strong>" + (typeof escapeHtml === "function" ? escapeHtml(String(title)) : String(title)) + "</strong></div>";
                    html += "<div>Результат: <strong>" + (typeof escapeHtml === "function" ? escapeHtml(score) : score) + "%</strong> (" + (typeof escapeHtml === "function" ? escapeHtml(correct) : correct) + "/" + (typeof escapeHtml === "function" ? escapeHtml(total) : total) + ")</div>";
                    if (finishedAt) html += "<div class=\"stats-date\">" + (typeof escapeHtml === "function" ? escapeHtml(String(finishedAt)) : String(finishedAt)) + "</div>";
                    html += "</div>";
                });
                html += "</div>";
            }
            html += "<button type=\"button\" class=\"secondary\" id=\"btnGoHome\">На главную</button></div>";
            app.innerHTML = html;
            var b3 = document.getElementById("btnGoHome");
            if (b3 && typeof Router !== "undefined" && Router.navigate) b3.addEventListener("click", function () { Router.navigate(Router.hashForHome()); });
        }).catch(function () {
            app.innerHTML = "<div class=\"container\"><h1>Мой профиль</h1><p>Не удалось загрузить статистику.</p><button type=\"button\" class=\"secondary\" id=\"btnGoHome\">На главную</button></div>";
            var b4 = document.getElementById("btnGoHome");
            if (b4 && typeof Router !== "undefined" && Router.navigate) b4.addEventListener("click", function () { Router.navigate(Router.hashForHome()); });
        });
    }

    window.renderMe = renderMe;
})();

