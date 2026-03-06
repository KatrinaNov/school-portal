/**
 * Панель: управление предметами (добавить, переименовать, удалить, привязка к классу).
 */
(function (global) {
    "use strict";

    var Store = global.AdminStore;
    var UI = global.AdminUI;
    var Sanitize = global.AdminSanitize;

    function render(container) {
        var data = Store.getData();
        var classes = data.config.classes || {};
        var classIds = Object.keys(classes);

        var html = "<h2>Предметы</h2>";
        if (classIds.length === 0) {
            html += "<p class=\"admin-empty\">Сначала добавьте класс во вкладке «Классы».</p>";
            container.innerHTML = html;
            return;
        }
        html += "<p>Выберите класс и управляйте предметами.</p>";
        html += "<div class=\"admin-form-group\"><label>Класс</label><select id=\"admin-subject-class\">";
        classIds.forEach(function (id) {
            html += "<option value=\"" + Sanitize.escapeHtml(id) + "\">" + Sanitize.escapeHtml(classes[id].name) + "</option>";
        });
        html += "</select></div>";
        html += "<ul class=\"admin-list\" id=\"admin-subjects-list\"></ul>";
        html += "<h3>Добавить предмет</h3>";
        html += "<div class=\"admin-form-group\"><label>ID предмета (латиница)</label><input type=\"text\" id=\"admin-subject-id\" placeholder=\"math\"></div>";
        html += "<div class=\"admin-form-group\"><label>Название</label><input type=\"text\" id=\"admin-subject-name\" placeholder=\"Математика\"></div>";
        html += "<div class=\"admin-form-group\"><label>Путь (папка данных)</label><input type=\"text\" id=\"admin-subject-path\" placeholder=\"data/2/math/\"></div>";
        html += "<div class=\"admin-form-actions\"><button type=\"button\" class=\"admin-btn admin-btn--primary\" id=\"admin-subject-add\">Добавить предмет</button></div>";

        container.innerHTML = html;

        var classSelect = document.getElementById("admin-subject-class");
        var listEl = document.getElementById("admin-subjects-list");

        function fillSubjects() {
            var classId = classSelect.value;
            var subjects = (classes[classId] && classes[classId].subjects) || {};
            listEl.innerHTML = "";
            Object.keys(subjects).forEach(function (subId) {
                var s = subjects[subId];
                var li = document.createElement("li");
                li.className = "admin-list__item";
                li.innerHTML = "<span><strong>" + Sanitize.escapeHtml(subId) + "</strong> — " + Sanitize.escapeHtml(s.name) + " <small>(" + Sanitize.escapeHtml(s.path) + ")</small></span>" +
                    "<div class=\"admin-item-actions\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--edit\" data-subject-edit=\"" + Sanitize.escapeHtml(classId) + "\" data-subject-id=\"" + Sanitize.escapeHtml(subId) + "\">Изменить</button>" +
                    "<button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-subject-delete=\"" + Sanitize.escapeHtml(classId) + "\" data-subject-id=\"" + Sanitize.escapeHtml(subId) + "\">Удалить</button></div>";
                listEl.appendChild(li);
            });
        }

        classSelect.addEventListener("change", fillSubjects);
        fillSubjects();

        document.getElementById("admin-subject-add").addEventListener("click", addSubject);
        listEl.addEventListener("click", function (e) {
            var editClass = e.target.getAttribute("data-subject-edit");
            var editId = e.target.getAttribute("data-subject-id");
            var delClass = e.target.getAttribute("data-subject-delete");
            var delId = e.target.getAttribute("data-subject-id");
            if (editClass && editId) editSubject(editClass, editId);
            if (delClass && delId) deleteSubject(delClass, delId);
        });
    }

    function addSubject() {
        var classId = document.getElementById("admin-subject-class").value;
        var id = Sanitize.sanitizeId(document.getElementById("admin-subject-id").value);
        var name = Sanitize.sanitizeString(document.getElementById("admin-subject-name").value, 200);
        var path = Sanitize.sanitizePath(document.getElementById("admin-subject-path").value);
        if (!id) {
            UI.showError("Введите ID предмета (латиница)");
            return;
        }
        var data = Store.getData();
        var subjects = data.config.classes[classId] && data.config.classes[classId].subjects;
        if (!subjects) return;
        if (subjects[id]) {
            UI.showError("Предмет с таким ID уже есть в этом классе");
            return;
        }
        if (!path) path = "data/" + classId + "/" + id + "/";
        subjects[id] = { name: name || id, path: path };
        if (!data.paragraphs[path]) data.paragraphs[path] = [];
        if (!data.quizzes) data.quizzes = {};
        if (!Store.replaceData(data) || !Store.save()) {
            UI.showError("Ошибка сохранения");
            return;
        }
        UI.showSuccess("Предмет добавлен");
        document.getElementById("admin-subject-id").value = "";
        document.getElementById("admin-subject-name").value = "";
        document.getElementById("admin-subject-path").value = "";
        render(document.getElementById("admin-panel"));
    }

    function editSubject(classId, subjectId) {
        var data = Store.getData();
        var s = data.config.classes[classId] && data.config.classes[classId].subjects[subjectId];
        if (!s) return;
        var newName = window.prompt("Название предмета:", s.name);
        if (newName === null) return;
        newName = Sanitize.sanitizeString(newName, 200);
        if (!newName) return;
        var newPath = window.prompt("Путь (папка данных):", s.path);
        if (newPath === null) return;
        newPath = Sanitize.sanitizePath(newPath);
        data.config.classes[classId].subjects[subjectId].name = newName;
        if (newPath && newPath !== s.path) {
            data.config.classes[classId].subjects[subjectId].path = newPath;
            if (data.paragraphs[s.path]) {
                data.paragraphs[newPath] = data.paragraphs[s.path];
                delete data.paragraphs[s.path];
            } else {
                data.paragraphs[newPath] = data.paragraphs[newPath] || [];
            }
            var oldPath = s.path;
            for (var key in data.quizzes) {
                if (data.quizzes.hasOwnProperty(key) && key.indexOf(oldPath) === 0) {
                    var newKey = newPath + key.slice(oldPath.length);
                    data.quizzes[newKey] = data.quizzes[key];
                    delete data.quizzes[key];
                }
            }
        }
        if (!Store.replaceData(data) || !Store.save()) {
            UI.showError("Ошибка сохранения");
            return;
        }
        UI.showSuccess("Предмет обновлён");
        render(document.getElementById("admin-panel"));
    }

    function deleteSubject(classId, subjectId) {
        UI.confirmAction("Удалить предмет и все его параграфы и тесты?", "Удалить предмет").then(function (ok) {
            if (!ok) return;
            var data = Store.getData();
            var s = data.config.classes[classId] && data.config.classes[classId].subjects[subjectId];
            if (!s) return;
            var path = s.path;
            delete data.config.classes[classId].subjects[subjectId];
            delete data.paragraphs[path];
            for (var key in data.quizzes) {
                if (data.quizzes.hasOwnProperty(key) && key.indexOf(path) === 0) delete data.quizzes[key];
            }
            if (!Store.replaceData(data) || !Store.save()) {
                UI.showError("Ошибка сохранения");
                return;
            }
            UI.showSuccess("Предмет удалён");
            render(document.getElementById("admin-panel"));
        });
    }

    if (global.Admin) {
        global.Admin.registerPanel("subjects", render);
    }
})(typeof window !== "undefined" ? window : this);
