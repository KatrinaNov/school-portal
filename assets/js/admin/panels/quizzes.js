/**
 * Панель: управление тестами и вопросами (choice/input), перетаскивание порядка вопросов.
 */
(function (global) {
    "use strict";

    var Store = global.AdminStore;
    var UI = global.AdminUI;
    var Sanitize = global.AdminSanitize;
    var Schema = global.AdminSchema;

    function getAllPathsWithNames(data) {
        var out = [];
        var classes = data.config && data.config.classes || {};
        for (var classId in classes) {
            if (!Object.prototype.hasOwnProperty.call(classes, classId)) continue;
            var subs = classes[classId].subjects;
            if (!subs) continue;
            for (var subId in subs) {
                if (!Object.prototype.hasOwnProperty.call(subs, subId)) continue;
                out.push({ path: subs[subId].path, label: classes[classId].name + " / " + subs[subId].name });
            }
        }
        return out;
    }

    function getQuizzesForPath(data, path) {
        var result = [];
        for (var key in data.quizzes) {
            if (!Object.prototype.hasOwnProperty.call(data.quizzes, key)) continue;
            if (key.indexOf(path) === 0) {
                var file = key.slice(path.length);
                if (file) result.push({ fullKey: key, file: file, quiz: data.quizzes[key] });
            }
        }
        return result;
    }

    function render(container) {
        var data = Store.getData();
        var paths = getAllPathsWithNames(data);

        var html = "<h2>Тесты</h2>";
        if (paths.length === 0) {
            html += "<p class=\"admin-empty\">Сначала добавьте класс и предмет во вкладках «Классы» и «Предметы».</p>";
            container.innerHTML = html;
            return;
        }
        html += "<div class=\"admin-form-group\"><label>Предмет</label><select id=\"admin-quiz-path\">";
        paths.forEach(function (p) {
            html += "<option value=\"" + Sanitize.escapeHtml(p.path) + "\">" + Sanitize.escapeHtml(p.label) + "</option>";
        });
        html += "</select></div>";
        html += "<ul class=\"admin-list\" id=\"admin-quizzes-list\"></ul>";
        html += "<h3>Добавить тест</h3>";
        html += "<div class=\"admin-form-group\"><label>Имя файла теста</label><input type=\"text\" id=\"admin-quiz-filename\" placeholder=\"quiz-1.json\"></div>";
        html += "<div class=\"admin-form-group\"><label>Название теста</label><input type=\"text\" id=\"admin-quiz-title\" placeholder=\"Тест по теме 1\"></div>";
        html += "<button type=\"button\" class=\"admin-btn admin-btn--primary\" id=\"admin-quiz-add\">Добавить тест</button>";
        html += "<div id=\"admin-quiz-editor\" style=\"display:none; margin-top: 24px;\"></div>";

        container.innerHTML = html;

        var pathSelect = document.getElementById("admin-quiz-path");
        var listEl = document.getElementById("admin-quizzes-list");
        var editorWrap = document.getElementById("admin-quiz-editor");

        function fillList() {
            var path = pathSelect.value;
            var data = Store.getData();
            var list = getQuizzesForPath(data, path);
            listEl.innerHTML = "";
            list.forEach(function (item) {
                var li = document.createElement("li");
                li.className = "admin-list__item";
                var qCount = (item.quiz.questions && item.quiz.questions.length) || 0;
                li.innerHTML = "<span><strong>" + Sanitize.escapeHtml(item.file) + "</strong> — " + Sanitize.escapeHtml(item.quiz.title || "") + " (" + qCount + " вопр.)</span>" +
                    "<div class=\"admin-item-actions\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--edit\" data-quiz-edit=\"" + Sanitize.escapeHtml(item.fullKey) + "\">Редактировать</button>" +
                    "<button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-quiz-delete=\"" + Sanitize.escapeHtml(item.fullKey) + "\">Удалить</button></div>";
                listEl.appendChild(li);
            });
        }

        pathSelect.addEventListener("change", fillList);
        fillList();

        document.getElementById("admin-quiz-add").addEventListener("click", addQuiz);
        listEl.addEventListener("click", function (e) {
            var editKey = e.target.getAttribute("data-quiz-edit");
            var delKey = e.target.getAttribute("data-quiz-delete");
            if (editKey) openQuizEditor(editKey);
            if (delKey) deleteQuiz(delKey);
        });
    }

    function addQuiz() {
        var path = document.getElementById("admin-quiz-path").value;
        var fileName = Sanitize.sanitizeQuizFileName(document.getElementById("admin-quiz-filename").value);
        var title = Sanitize.sanitizeString(document.getElementById("admin-quiz-title").value, 500);
        if (!fileName) {
            UI.showError("Введите имя файла теста");
            return;
        }
        var fullKey = Store.quizFullPath(path, fileName);
        var data = Store.getData();
        if (data.quizzes[fullKey]) {
            UI.showError("Тест с таким именем уже есть");
            return;
        }
        data.quizzes[fullKey] = { title: title || "Тест", questions: [] };
        if (!data.quizzes) data.quizzes = {};
        Store.replaceData(data);
        UI.showSuccess("Тест добавлен");
        document.getElementById("admin-quiz-filename").value = "";
        document.getElementById("admin-quiz-title").value = "";
        render(document.getElementById("admin-panel"));
        setTimeout(function () { openQuizEditor(fullKey); }, 0);
    }

    function openQuizEditor(fullKey) {
        var editorWrap = document.getElementById("admin-quiz-editor");
        if (!editorWrap) return;
        var data = Store.getData();
        var quiz = data.quizzes[fullKey];
        if (!quiz) {
            editorWrap.style.display = "none";
            return;
        }
        var questions = (quiz.questions || []).slice();

        editorWrap.style.display = "block";
        var titleHtml = "<div class=\"admin-form-group\"><label>Название теста</label><input type=\"text\" id=\"qe-title\" value=\"" + Sanitize.escapeHtml(quiz.title || "") + "\"></div>";
        var listHtml = "<ul class=\"admin-questions-list\" id=\"qe-questions\"></ul>";
        var addChoiceHtml = "<button type=\"button\" class=\"admin-btn admin-btn--secondary\" id=\"qe-add-choice\">+ Вопрос (варианты)</button>";
        var addInputHtml = " <button type=\"button\" class=\"admin-btn admin-btn--secondary\" id=\"qe-add-input\">+ Вопрос (ввод)</button>";
        editorWrap.innerHTML = "<h3>Редактор теста: " + Sanitize.escapeHtml(fullKey) + "</h3>" + titleHtml + "<h4>Вопросы (перетащите для смены порядка)</h4>" + listHtml + "<div class=\"admin-form-actions\">" + addChoiceHtml + addInputHtml + " <button type=\"button\" class=\"admin-btn admin-btn--primary\" id=\"qe-save\">Сохранить тест</button> <button type=\"button\" class=\"admin-btn admin-btn--secondary\" id=\"qe-close\">Закрыть</button></div>";

        var listEl = document.getElementById("qe-questions");

        function renderQuestionsList() {
            listEl.innerHTML = "";
            questions.forEach(function (q, i) {
                var li = document.createElement("li");
                li.className = "admin-question-item";
                li.setAttribute("data-index", i);
                li.draggable = true;
                var typeLabel = q.type === "input" ? "ввод" : "варианты";
                var preview = q.type === "choice" ? ("Варианты: " + (q.a && q.a.length) + ", правильный: " + (q.c + 1)) : ("Ответ: " + (q.answer || (q.answers && q.answers[0]) || "—"));
                li.innerHTML = "<span class=\"admin-question-drag-handle\" aria-label=\"Перетащить\">⋮⋮</span><div class=\"admin-question-body\"><strong>" + (i + 1) + ".</strong> " + Sanitize.escapeHtml((q.q || "").slice(0, 80)) + (q.q && q.q.length > 80 ? "…" : "") + " <small>(" + typeLabel + ", " + preview + ")</small></div><div class=\"admin-question-actions\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--edit\" data-q-edit=\"" + i + "\">Изменить</button><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-q-del=\"" + i + "\">Удалить</button></div>";
                listEl.appendChild(li);
            });
            setupDragAndDrop();
        }

        function setupDragAndDrop() {
            var draggedIndex = null;
            listEl.querySelectorAll(".admin-question-item").forEach(function (el) {
                el.addEventListener("dragstart", function (e) {
                    draggedIndex = parseInt(el.getAttribute("data-index"), 10);
                    el.classList.add("dragging");
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", draggedIndex);
                });
                el.addEventListener("dragend", function () {
                    el.classList.remove("dragging");
                    draggedIndex = null;
                });
                el.addEventListener("dragover", function (e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    var idx = parseInt(el.getAttribute("data-index"), 10);
                    if (idx !== draggedIndex) el.classList.add("drag-over");
                });
                el.addEventListener("dragleave", function () {
                    el.classList.remove("drag-over");
                });
                el.addEventListener("drop", function (e) {
                    e.preventDefault();
                    el.classList.remove("drag-over");
                    var toIndex = parseInt(el.getAttribute("data-index"), 10);
                    if (draggedIndex === null || draggedIndex === toIndex) return;
                    var moved = questions.splice(draggedIndex, 1)[0];
                    questions.splice(toIndex, 0, moved);
                    renderQuestionsList();
                });
            });
        }

        renderQuestionsList();

        listEl.addEventListener("click", function (e) {
            var editIdx = e.target.getAttribute("data-q-edit");
            var delIdx = e.target.getAttribute("data-q-del");
            if (editIdx != null) openQuestionEditor(parseInt(editIdx, 10));
            if (delIdx != null) deleteQuestion(parseInt(delIdx, 10));
        });

        document.getElementById("qe-add-choice").addEventListener("click", function () {
            questions.push({ type: "choice", q: "", a: ["", ""], c: 0 });
            renderQuestionsList();
            openQuestionEditor(questions.length - 1);
        });
        document.getElementById("qe-add-input").addEventListener("click", function () {
            questions.push({ type: "input", q: "", answers: [""] });
            renderQuestionsList();
            openQuestionEditor(questions.length - 1);
        });

        function openQuestionEditor(index) {
            var q = questions[index];
            if (!q) return;
            var isChoice = q.type === "choice";
            var msg = isChoice ? "Текст вопроса, варианты ответов (каждый с новой строки), номер правильного (1, 2, 3...):" : "Текст вопроса и правильный ответ (или несколько через запятую):";
            var extra = isChoice ? (Array.isArray(q.a) ? q.a.join("\n") : "") + "\n---\nПравильный: " + ((q.c != null ? q.c + 1 : 1)) : (q.answers && q.answers.length ? q.answers.join(", ") : q.answer || "");
            var raw = window.prompt(msg, (q.q || "") + "\n---\n" + extra);
            if (raw === null) return;
            var parts = raw.split("\n---\n");
            var qText = Sanitize.sanitizeString(parts[0], 2000);
            if (!qText) {
                UI.showError("Текст вопроса не может быть пустым");
                return;
            }
            if (isChoice) {
                var opts = (parts[1] || "").split("\n").map(function (s) { return Sanitize.sanitizeString(s, 500); }).filter(Boolean);
                var correctNum = parseInt(parts[2], 10) || 1;
                if (opts.length === 0) opts = ["Вариант 1", "Вариант 2"];
                var c = Math.max(0, Math.min(correctNum - 1, opts.length - 1));
                questions[index] = { type: "choice", q: qText, a: opts, c: c };
            } else {
                var ansStr = (parts[1] || "").trim();
                var answers = ansStr ? ansStr.split(",").map(function (s) { return Sanitize.sanitizeString(s, 500); }).filter(Boolean) : [""];
                if (answers.length === 0) answers = [""];
                questions[index] = { type: "input", q: qText, answers: answers };
            }
            renderQuestionsList();
        }

        function deleteQuestion(index) {
            UI.confirmAction("Удалить этот вопрос?", "Удалить вопрос").then(function (ok) {
                if (ok) {
                    questions.splice(index, 1);
                    renderQuestionsList();
                }
            });
        }

        document.getElementById("qe-save").addEventListener("click", function () {
            var newTitle = Sanitize.sanitizeString(document.getElementById("qe-title").value, 500);
            if (!newTitle) {
                UI.showError("Введите название теста");
                return;
            }
            var data = Store.getData();
            var quizObj = { title: newTitle, questions: questions.map(function (q) { return Sanitize.sanitizeQuestion(q); }).filter(Boolean) };
            var v = Schema.validateQuiz(quizObj);
            if (!v.valid) {
                UI.showError(v.error);
                return;
            }
            data.quizzes[fullKey] = quizObj;
            Store.replaceData(data);
            UI.showSuccess("Тест сохранён");
            editorWrap.style.display = "none";
            render(document.getElementById("admin-panel"));
        });

        document.getElementById("qe-close").addEventListener("click", function () {
            editorWrap.style.display = "none";
            render(document.getElementById("admin-panel"));
        });
    }

    function deleteQuiz(fullKey) {
        UI.confirmAction("Удалить этот тест? Ссылки в параграфах на файл останутся и могут сломаться.", "Удалить тест").then(function (ok) {
            if (!ok) return;
            var data = Store.getData();
            delete data.quizzes[fullKey];
            Store.replaceData(data);
            UI.showSuccess("Тест удалён");
            document.getElementById("admin-quiz-editor").style.display = "none";
            render(document.getElementById("admin-panel"));
        });
    }

    if (global.Admin) {
        global.Admin.registerPanel("quizzes", render);
    }
})(typeof window !== "undefined" ? window : this);
