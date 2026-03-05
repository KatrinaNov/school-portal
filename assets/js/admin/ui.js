/**
 * UX: уведомления, подтверждения, предупреждение о несохранённых изменениях.
 */
(function (global) {
    "use strict";

    var NOTIFICATION_DURATION = 3500;
    var notificationTimer = null;

    function showNotification(message, type) {
        type = type || "success";
        var container = document.getElementById("admin-notifications");
        if (!container) return;
        clearTimeout(notificationTimer);
        var el = document.createElement("div");
        el.className = "admin-notification admin-notification--" + type;
        el.setAttribute("role", "alert");
        el.textContent = message;
        container.innerHTML = "";
        container.appendChild(el);
        notificationTimer = setTimeout(function () {
            el.remove();
        }, NOTIFICATION_DURATION);
    }

    function showSuccess(message) {
        showNotification(message || "Изменения сохранены", "success");
    }

    function showError(message) {
        showNotification(message || "Ошибка", "error");
    }

    function showWarning(message) {
        showNotification(message || "Внимание", "warning");
    }

    /**
     * Подтверждение перед действием. Возвращает Promise<boolean>.
     */
    function confirmAction(message, title) {
        title = title || "Подтверждение";
        return new Promise(function (resolve) {
            var result = window.confirm(title + "\n\n" + message);
            resolve(!!result);
        });
    }

    /**
     * Предупреждение при уходе со страницы или при несохранённых изменениях.
     */
    function setupUnloadWarning(getDirtyFn) {
        getDirtyFn = getDirtyFn || function () { return false; };
        window.addEventListener("beforeunload", function (e) {
            if (getDirtyFn()) {
                e.preventDefault();
            }
        });
    }

    global.AdminUI = {
        showNotification: showNotification,
        showSuccess: showSuccess,
        showError: showError,
        showWarning: showWarning,
        confirmAction: confirmAction,
        setupUnloadWarning: setupUnloadWarning
    };
})(typeof window !== "undefined" ? window : this);
