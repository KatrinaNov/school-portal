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
