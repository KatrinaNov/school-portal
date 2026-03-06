/**
 * Панель: управление классами (добавить, переименовать, удалить).
 */
(function (global) {
    "use strict";

    var Store = global.AdminStore;
    var UI = global.AdminUI;
    var Sanitize = global.AdminSanitize;
    var Schema = global.AdminSchema;

    function render(container) {
        var data = Store.getData();
        var classes = data.config.classes || {};
        var classIds = Object.keys(classes);

        var html = "<h2>Классы</h2>";
        html += "<p class=\"admin-empty\">Добавьте класс (например: 2, 6, 10).</p>";
        html += "<ul class=\"admin-list\" id=\"admin-classes-list\"></ul>";
        html += "<div class=\"admin-form-group\"><label>Новый класс (ID)</label><input type=\"text\" id=\"admin-class-id\" placeholder=\"например: 7\"></div>";
        html += "<div class=\"admin-form-group\"><label>Название класса</label><input type=\"text\" id=\"admin-class-name\" placeholder=\"7 класс\"></div>";
        html += "<div class=\"admin-form-actions\"><button type=\"button\" class=\"admin-btn admin-btn--primary\" id=\"admin-class-add\">Добавить класс</button></div>";

        container.innerHTML = html;

        var listEl = document.getElementById("admin-classes-list");
        classIds.forEach(function (id) {
            var item = classes[id];
            var li = document.createElement("li");
            li.className = "admin-list__item";
            li.innerHTML = "<span><strong>" + Sanitize.escapeHtml(id) + "</strong> — " + Sanitize.escapeHtml(item.name) + "</span>" +
                "<div class=\"admin-item-actions\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--edit\" data-class-edit=\"" + Sanitize.escapeHtml(id) + "\">Переименовать</button>" +
                "<button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-class-delete=\"" + Sanitize.escapeHtml(id) + "\">Удалить</button></div>";
            listEl.appendChild(li);
        });

        document.getElementById("admin-class-add").addEventListener("click", addClass);
        listEl.addEventListener("click", function (e) {
            var editId = e.target.getAttribute("data-class-edit");
            var deleteId = e.target.getAttribute("data-class-delete");
            if (editId) renameClass(editId);
            if (deleteId) deleteClass(deleteId);
        });
    }

    function addClass() {
        var idInput = document.getElementById("admin-class-id");
        var nameInput = document.getElementById("admin-class-name");
        var id = Sanitize.sanitizeId(idInput.value) || Sanitize.sanitizeString(idInput.value, 50).replace(/\s/g, "");
        var name = Sanitize.sanitizeString(nameInput.value, 200);
        if (!id) {
            UI.showError("Введите ID класса");
            idInput.classList.add("error");
            return;
        }
        idInput.classList.remove("error");
        var data = Store.getData();
        if (data.config.classes[id]) {
            UI.showError("Класс с таким ID уже есть");
            return;
        }
        data.config.classes[id] = { name: name || id + " класс", subjects: {} };
        if (!Store.replaceData(data) || !Store.save()) {
            UI.showError("Ошибка сохранения");
            return;
        }
        UI.showSuccess("Класс добавлен");
        idInput.value = "";
        nameInput.value = "";
        render(document.getElementById("admin-panel"));
    }

    function renameClass(classId) {
        var data = Store.getData();
        var c = data.config.classes[classId];
        if (!c) return;
        var newName = window.prompt("Название класса:", c.name);
        if (newName === null) return;
        newName = Sanitize.sanitizeString(newName, 200);
        if (!newName) {
            UI.showError("Название не может быть пустым");
            return;
        }
        data.config.classes[classId].name = newName;
        if (!Store.replaceData(data) || !Store.save()) {
            UI.showError("Ошибка сохранения");
            return;
        }
        UI.showSuccess("Класс переименован");
        render(document.getElementById("admin-panel"));
    }

    function deleteClass(classId) {
        UI.confirmAction("Удалить класс «" + classId + "» и все его предметы?", "Удалить класс").then(function (ok) {
            if (!ok) return;
            var data = Store.getData();
            delete data.config.classes[classId];
            if (!Store.replaceData(data) || !Store.save()) {
                UI.showError("Ошибка сохранения");
                return;
            }
            UI.showSuccess("Класс удалён");
            render(document.getElementById("admin-panel"));
        });
    }

    if (global.Admin) {
        global.Admin.registerPanel("classes", render);
    }
})(typeof window !== "undefined" ? window : this);
