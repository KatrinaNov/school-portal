/**
 * Экранирование строки для безопасной вставки в HTML (защита от XSS).
 * @param {string|null|undefined} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (str == null || typeof str !== "string") return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML.replace(/"/g, "&quot;");
}

/**
 * Форматирование текста параграфа: переносы строк, **жирный**, *курсив*.
 * Сначала экранирует HTML, затем применяет разметку (безопасно для вывода в innerHTML).
 * @param {string|null|undefined} str
 * @returns {string}
 */
function formatParagraphText(str) {
    if (str == null || typeof str !== "string") return "";
    var s = escapeHtml(str);
    s = s.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    s = s.replace(/\n/g, "<br>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return s;
}
