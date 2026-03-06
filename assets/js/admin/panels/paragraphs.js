/**
 * Панель: управление параграфами (id, title, summary, sections, dates, terms, people), превью, проверка уникальности id.
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

    function collectAllParagraphIds(data, excludePath, excludeId) {
        var ids = {};
        for (var path in data.paragraphs) {
            if (!Object.prototype.hasOwnProperty.call(data.paragraphs, path)) continue;
            var arr = data.paragraphs[path];
            if (!Array.isArray(arr)) continue;
            arr.forEach(function (p) {
                if (excludePath === path && String(p.id) === String(excludeId)) return;
                ids[String(p.id)] = true;
            });
        }
        return ids;
    }

    function render(container) {
        var data = Store.getData();
        var paths = getAllPathsWithNames(data);
        var paragraphs = data.paragraphs || {};

        var html = "<h2>Параграфы</h2>";
        if (paths.length === 0) {
            html += "<p class=\"admin-empty\">Сначала добавьте класс и предмет во вкладках «Классы» и «Предметы».</p>";
            container.innerHTML = html;
            return;
        }
        html += "<div class=\"admin-form-group\"><label>Предмет</label><select id=\"admin-paragraph-path\">";
        paths.forEach(function (p) {
            html += "<option value=\"" + Sanitize.escapeHtml(p.path) + "\">" + Sanitize.escapeHtml(p.label) + "</option>";
        });
        html += "</select></div>";
        html += "<ul class=\"admin-list\" id=\"admin-paragraphs-list\"></ul>";
        html += "<button type=\"button\" class=\"admin-btn admin-btn--primary\" id=\"admin-paragraph-new\">Добавить параграф</button>";
        html += "<div id=\"admin-paragraph-editor\" style=\"display:none; margin-top: 24px;\"></div>";

        container.innerHTML = html;

        var pathSelect = document.getElementById("admin-paragraph-path");
        var listEl = document.getElementById("admin-paragraphs-list");
        var editorWrap = document.getElementById("admin-paragraph-editor");

        function fillList() {
            var path = pathSelect.value;
            var arr = paragraphs[path] || [];
            listEl.innerHTML = "";
            arr.forEach(function (p, index) {
                var li = document.createElement("li");
                li.className = "admin-list__item";
                li.innerHTML = "<span><strong>" + Sanitize.escapeHtml(String(p.id)) + "</strong> — " + Sanitize.escapeHtml((p.title || "").slice(0, 50)) + (p.title && p.title.length > 50 ? "…" : "") + "</span>" +
                    "<div class=\"admin-item-actions\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--edit\" data-path=\"" + Sanitize.escapeHtml(path) + "\" data-index=\"" + index + "\">Редактировать</button>" +
                    "<button type=\"button\" class=\"admin-btn-small\" data-path=\"" + Sanitize.escapeHtml(path) + "\" data-index=\"" + index + "\" data-preview=\"1\">Превью</button>" +
                    "<button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-path=\"" + Sanitize.escapeHtml(path) + "\" data-index=\"" + index + "\" data-delete=\"1\">Удалить</button></div>";
                listEl.appendChild(li);
            });
        }

        pathSelect.addEventListener("change", fillList);
        fillList();

        document.getElementById("admin-paragraph-new").addEventListener("click", function () {
            openEditor(pathSelect.value, null);
        });

        listEl.addEventListener("click", function (e) {
            var path = e.target.getAttribute("data-path");
            var index = e.target.getAttribute("data-index");
            if (path == null || index == null) return;
            if (e.target.getAttribute("data-preview")) {
                showPreview(path, parseInt(index, 10));
                return;
            }
            if (e.target.getAttribute("data-delete")) {
                deleteParagraph(path, parseInt(index, 10));
                return;
            }
            if (e.target.classList.contains("admin-btn-small--edit")) {
                openEditor(path, parseInt(index, 10));
            }
        });
    }

    function openEditor(path, index) {
        var editorWrap = document.getElementById("admin-paragraph-editor");
        if (!editorWrap) return;
        var data = Store.getData();
        var arr = data.paragraphs[path] || [];
        var p = index !== null && arr[index] ? JSON.parse(JSON.stringify(arr[index])) : {
            id: "",
            title: "",
            summary: "",
            sections: [],
            dates: [],
            terms: [],
            people: [],
            examples: [],
            quizzes: []
        };

        var isNew = index === null;
        var allIds = collectAllParagraphIds(data, isNew ? null : path, isNew ? null : p.id);

        var sectionsHtml = (p.sections || []).map(function (s, i) {
            return "<div class=\"admin-subsection-item\"><input type=\"text\" placeholder=\"Заголовок\" value=\"" + Sanitize.escapeHtml(s.title || "") + "\" data-section-title=\"" + i + "\"><textarea placeholder=\"Текст\" rows=\"2\" data-section-content=\"" + i + "\">" + Sanitize.escapeHtml(s.content || "") + "</textarea><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-section=\"" + i + "\">−</button></div>";
        }).join("");
        var datesHtml = (p.dates || []).map(function (d, i) {
            return "<div class=\"admin-subsection-item\"><input type=\"text\" placeholder=\"Год\" value=\"" + Sanitize.escapeHtml(d.year || "") + "\" data-date-year=\"" + i + "\"><input type=\"text\" placeholder=\"Событие\" value=\"" + Sanitize.escapeHtml(d.event || "") + "\" data-date-event=\"" + i + "\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-date=\"" + i + "\">−</button></div>";
        }).join("");
        var termsHtml = (p.terms || []).map(function (t, i) {
            return "<div class=\"admin-subsection-item\"><input type=\"text\" placeholder=\"Термин\" value=\"" + Sanitize.escapeHtml(t.term || "") + "\" data-term-term=\"" + i + "\"><input type=\"text\" placeholder=\"Определение\" value=\"" + Sanitize.escapeHtml(t.definition || "") + "\" data-term-def=\"" + i + "\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-term=\"" + i + "\">−</button></div>";
        }).join("");
        var peopleHtml = (p.people || []).map(function (pers, i) {
            return "<div class=\"admin-subsection-item\"><input type=\"text\" placeholder=\"Имя\" value=\"" + Sanitize.escapeHtml(pers.name || "") + "\" data-person-name=\"" + i + "\"><input type=\"text\" placeholder=\"Инфо\" value=\"" + Sanitize.escapeHtml(pers.info || "") + "\" data-person-info=\"" + i + "\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-person=\"" + i + "\">−</button></div>";
        }).join("");
        var quizzesHtml = (p.quizzes || []).map(function (q, i) {
            return "<div class=\"admin-subsection-item\"><input type=\"text\" placeholder=\"Название теста\" value=\"" + Sanitize.escapeHtml(q.title || "") + "\" data-quiz-title=\"" + i + "\"><input type=\"text\" placeholder=\"Файл (quiz-1.json)\" value=\"" + Sanitize.escapeHtml(q.file || "") + "\" data-quiz-file=\"" + i + "\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-quiz=\"" + i + "\">−</button></div>";
        }).join("");

        editorWrap.style.display = "block";
        editorWrap.innerHTML = "<h3>" + (isNew ? "Новый параграф" : "Редактирование") + "</h3>" +
            "<div class=\"admin-form-group\"><label>ID (уникальный)</label><input type=\"text\" id=\"pe-id\" value=\"" + Sanitize.escapeHtml(String(p.id)) + "\" placeholder=\"add-sub-2digit\"></div>" +
            "<div class=\"admin-form-group\"><label>Заголовок</label><input type=\"text\" id=\"pe-title\" value=\"" + Sanitize.escapeHtml(p.title || "") + "\"></div>" +
            "<div class=\"admin-form-group\"><label>Краткое содержание</label><textarea id=\"pe-summary\">" + Sanitize.escapeHtml(p.summary || "") + "</textarea></div>" +
            "<div class=\"admin-subsection\"><h4>Разделы</h4><div id=\"pe-sections\">" + sectionsHtml + "</div><button type=\"button\" class=\"admin-btn-small\" id=\"pe-add-section\">+ Раздел</button></div>" +
            "<div class=\"admin-subsection\"><h4>Даты</h4><div id=\"pe-dates\">" + datesHtml + "</div><button type=\"button\" class=\"admin-btn-small\" id=\"pe-add-date\">+ Дата</button></div>" +
            "<div class=\"admin-subsection\"><h4>Понятия</h4><div id=\"pe-terms\">" + termsHtml + "</div><button type=\"button\" class=\"admin-btn-small\" id=\"pe-add-term\">+ Понятие</button></div>" +
            "<div class=\"admin-subsection\"><h4>Персоны</h4><div id=\"pe-people\">" + peopleHtml + "</div><button type=\"button\" class=\"admin-btn-small\" id=\"pe-add-person\">+ Персона</button></div>" +
            "<div class=\"admin-subsection\"><h4>Тесты по теме</h4><div id=\"pe-quizzes\">" + quizzesHtml + "</div><button type=\"button\" class=\"admin-btn-small\" id=\"pe-add-quiz\">+ Тест</button></div>" +
            "<div class=\"admin-form-actions\"><button type=\"button\" class=\"admin-btn admin-btn--primary\" id=\"pe-save\">Сохранить параграф</button><button type=\"button\" class=\"admin-btn admin-btn--secondary\" id=\"pe-cancel\">Отмена</button></div>";

        function buildParagraphFromForm() {
            var sections = [];
            editorWrap.querySelectorAll("#pe-sections .admin-subsection-item").forEach(function (row) {
                var t = row.querySelector("[data-section-title]");
                var c = row.querySelector("[data-section-content]");
                if (t && c) sections.push({ title: t.value.trim(), content: c.value.trim() });
            });
            var dates = [];
            editorWrap.querySelectorAll("#pe-dates .admin-subsection-item").forEach(function (row) {
                var y = row.querySelector("[data-date-year]");
                var ev = row.querySelector("[data-date-event]");
                if (y && ev) dates.push({ year: y.value.trim(), event: ev.value.trim() });
            });
            var terms = [];
            editorWrap.querySelectorAll("#pe-terms .admin-subsection-item").forEach(function (row) {
                var t = row.querySelector("[data-term-term]");
                var d = row.querySelector("[data-term-def]");
                if (t && d) terms.push({ term: t.value.trim(), definition: d.value.trim() });
            });
            var people = [];
            editorWrap.querySelectorAll("#pe-people .admin-subsection-item").forEach(function (row) {
                var n = row.querySelector("[data-person-name]");
                var i = row.querySelector("[data-person-info]");
                if (n && i) people.push({ name: n.value.trim(), info: i.value.trim() });
            });
            var quizzes = [];
            editorWrap.querySelectorAll("#pe-quizzes .admin-subsection-item").forEach(function (row) {
                var t = row.querySelector("[data-quiz-title]");
                var f = row.querySelector("[data-quiz-file]");
                if (t && f && f.value.trim()) quizzes.push({ title: Sanitize.sanitizeString(t.value, 300), file: Sanitize.sanitizeQuizFileName(f.value) });
            });
            return {
                id: Sanitize.sanitizeId(editorWrap.querySelector("#pe-id").value) || ("p-" + Date.now()),
                title: Sanitize.sanitizeString(editorWrap.querySelector("#pe-title").value, 500),
                summary: Sanitize.sanitizeString(editorWrap.querySelector("#pe-summary").value, 5000),
                sections: sections,
                dates: dates,
                terms: terms,
                people: people,
                examples: p.examples || [],
                quizzes: quizzes
            };
        }

        function addRow(containerId, rowHtml, afterId) {
            var cont = document.getElementById(containerId);
            if (!cont) return;
            var div = document.createElement("div");
            div.className = "admin-subsection-item";
            div.innerHTML = rowHtml;
            cont.appendChild(div);
        }

        document.getElementById("pe-add-section").addEventListener("click", function () {
            addRow("pe-sections", "<input type=\"text\" placeholder=\"Заголовок\" data-section-title=\"-1\"><textarea placeholder=\"Текст\" rows=\"2\" data-section-content=\"-1\"></textarea><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-section=\"-1\">−</button>");
        });
        document.getElementById("pe-add-date").addEventListener("click", function () {
            addRow("pe-dates", "<input type=\"text\" placeholder=\"Год\" data-date-year=\"-1\"><input type=\"text\" placeholder=\"Событие\" data-date-event=\"-1\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-date=\"-1\">−</button>");
        });
        document.getElementById("pe-add-term").addEventListener("click", function () {
            addRow("pe-terms", "<input type=\"text\" placeholder=\"Термин\" data-term-term=\"-1\"><input type=\"text\" placeholder=\"Определение\" data-term-def=\"-1\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-term=\"-1\">−</button>");
        });
        document.getElementById("pe-add-person").addEventListener("click", function () {
            addRow("pe-people", "<input type=\"text\" placeholder=\"Имя\" data-person-name=\"-1\"><input type=\"text\" placeholder=\"Инфо\" data-person-info=\"-1\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-person=\"-1\">−</button>");
        });
        document.getElementById("pe-add-quiz").addEventListener("click", function () {
            addRow("pe-quizzes", "<input type=\"text\" placeholder=\"Название теста\" data-quiz-title=\"-1\"><input type=\"text\" placeholder=\"Файл (quiz-1.json)\" data-quiz-file=\"-1\"><button type=\"button\" class=\"admin-btn-small admin-btn-small--danger\" data-remove-quiz=\"-1\">−</button>");
        });

        editorWrap.addEventListener("click", function (e) {
            if (e.target.getAttribute("data-remove-section") != null) e.target.closest(".admin-subsection-item").remove();
            if (e.target.getAttribute("data-remove-date") != null) e.target.closest(".admin-subsection-item").remove();
            if (e.target.getAttribute("data-remove-term") != null) e.target.closest(".admin-subsection-item").remove();
            if (e.target.getAttribute("data-remove-person") != null) e.target.closest(".admin-subsection-item").remove();
            if (e.target.getAttribute("data-remove-quiz") != null) e.target.closest(".admin-subsection-item").remove();
        });

        document.getElementById("pe-cancel").addEventListener("click", function () {
            editorWrap.style.display = "none";
            editorWrap.innerHTML = "";
            render(document.getElementById("admin-panel"));
        });

        document.getElementById("pe-save").addEventListener("click", function () {
            var built = buildParagraphFromForm();
            if (!built.title.trim()) {
                UI.showError("Заполните заголовок");
                return;
            }
            var data = Store.getData();
            var ids = collectAllParagraphIds(data, index !== null ? path : null, index !== null ? p.id : null);
            if (ids[String(built.id)]) {
                UI.showError("ID параграфа уже используется: " + built.id);
                return;
            }
            var arr = data.paragraphs[path] || [];
            var validated = Sanitize.sanitizeParagraph(built);
            var v = Schema.validateParagraph(validated, {}, path);
            if (!v.valid) {
                UI.showError(v.error);
                return;
            }
            if (index !== null) {
                arr[index] = validated;
            } else {
                arr.push(validated);
            }
            data.paragraphs[path] = arr;
            if (!Store.replaceData(data)) {
                UI.showError("Ошибка применения данных");
                return;
            }
            if (!Store.save()) {
                UI.showError("Ошибка сохранения в localStorage");
                return;
            }
            UI.showSuccess("Параграф сохранён");
            editorWrap.style.display = "none";
            editorWrap.innerHTML = "";
            render(document.getElementById("admin-panel"));
        });
    }

    function showPreview(path, index) {
        var data = Store.getData();
        var arr = data.paragraphs[path] || [];
        var p = arr[index];
        if (!p) return;
        var sectionsHtml = (p.sections && p.sections.length) ? "<h2>Основные разделы</h2>" + p.sections.map(function (s) {
            return "<div class=\"section-block\"><h3>" + Sanitize.escapeHtml(s.title || "") + "</h3><p>" + Sanitize.escapeHtml(s.content || "") + "</p></div>";
        }).join("") : "";
        var datesHtml = (p.dates && p.dates.length) ? "<h2>Важные даты</h2><ul>" + p.dates.map(function (d) {
            return "<li><strong>" + Sanitize.escapeHtml(d.year || "") + "</strong> — " + Sanitize.escapeHtml(d.event || "") + "</li>";
        }).join("") + "</ul>" : "";
        var termsHtml = (p.terms && p.terms.length) ? "<h2>Понятия</h2><ul>" + p.terms.map(function (t) {
            return "<li><strong>" + Sanitize.escapeHtml(t.term || "") + "</strong> — " + Sanitize.escapeHtml(t.definition || "") + "</li>";
        }).join("") + "</ul>" : "";
        var peopleHtml = (p.people && p.people.length) ? "<h2>Исторические личности</h2><ul>" + p.people.map(function (pers) {
            return "<li><strong>" + Sanitize.escapeHtml(pers.name || "") + "</strong> — " + Sanitize.escapeHtml(pers.info || "") + "</li>";
        }).join("") + "</ul>" : "";
        var html = "<div class=\"admin-preview\"><h1>" + Sanitize.escapeHtml(p.title || "") + "</h1><h2>Кратко</h2><p>" + Sanitize.escapeHtml(p.summary || "") + "</p>" + sectionsHtml + datesHtml + termsHtml + peopleHtml + "</div>";
        var editorWrap = document.getElementById("admin-paragraph-editor");
        if (editorWrap) {
            editorWrap.style.display = "block";
            editorWrap.innerHTML = "<h3>Превью</h3>" + html + "<button type=\"button\" class=\"admin-btn admin-btn--secondary\" id=\"pe-preview-close\">Закрыть</button>";
            document.getElementById("pe-preview-close").addEventListener("click", function () {
                editorWrap.style.display = "none";
                editorWrap.innerHTML = "";
            });
        }
    }

    function deleteParagraph(path, index) {
        UI.confirmAction("Удалить этот параграф?", "Удалить параграф").then(function (ok) {
            if (!ok) return;
            var data = Store.getData();
            var arr = (data.paragraphs[path] || []).slice();
            arr.splice(index, 1);
            data.paragraphs[path] = arr;
            if (!Store.replaceData(data)) return;
            if (!Store.save()) {
                UI.showError("Ошибка сохранения в localStorage");
                return;
            }
            UI.showSuccess("Параграф удалён");
            document.getElementById("admin-paragraph-editor").style.display = "none";
            document.getElementById("admin-paragraph-editor").innerHTML = "";
            render(document.getElementById("admin-panel"));
        });
    }

    if (global.Admin) {
        global.Admin.registerPanel("paragraphs", render);
    }
})(typeof window !== "undefined" ? window : this);
