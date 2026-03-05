/**
 * Централизованный state и навигация.
 * Хранит текущий класс/предмет/путь для хлебных крошек и возврата "Назад".
 */
var State = (function () {
    var currentClassId = null;
    var currentSubjectId = null;
    var currentSubjectPath = null;
    var navigationStack = [];

    function setCurrentSubject(classId, subjectId, path) {
        currentClassId = classId;
        currentSubjectId = subjectId;
        currentSubjectPath = path || (typeof CONFIG !== "undefined" && CONFIG.classes[classId] && CONFIG.classes[classId].subjects[subjectId] ? CONFIG.classes[classId].subjects[subjectId].path : null);
    }

    function getCurrentSubject() {
        return {
            classId: currentClassId,
            subjectId: currentSubjectId,
            path: currentSubjectPath
        };
    }

    function navPush(entry) {
        navigationStack.push(entry);
    }

    function navBack() {
        if (navigationStack.length > 1) {
            navigationStack.pop();
            return navigationStack[navigationStack.length - 1];
        }
        return null;
    }

    function getBackAction() {
        if (navigationStack.length <= 1) return null;
        var prev = navigationStack[navigationStack.length - 2];
        return prev ? prev.action : null;
    }

    return {
        setCurrentSubject: setCurrentSubject,
        getCurrentSubject: getCurrentSubject,
        navPush: navPush,
        navBack: navBack,
        getBackAction: getBackAction
    };
})();
