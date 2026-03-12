# Code Review: School Portal

## 0. Текущее состояние (актуально)

- **XSS:** вывод в HTML идёт через `escapeHtml()` (safeHtml.js); обработчики через `addEventListener` и `data-*`, без подстановки кода в разметку.
- **API:** пути в `getParagraphs` и `getQuiz` проверяются (`isPathSafe`): запрещены `..` и абсолютные URL (http(s)://, //).
- **Изображения:** URL картинок в тестах и параграфах проходят через `safeImageSrc`/`imageHtml`: блокируются `javascript:`, неразрешённые `data:` (разрешены только `data:image/...`), пути с `..`.
- **Данные:** загрузка через `Api.getParagraphs`/`Api.getQuiz` с кэшем; поддержка content.json и fallback на paragraphs.json + quiz-*.json; State для текущего класса/предмета (хлебные крошки).
- **Тесты:** типы choice, input, multiple_choice, match, fill_words; валидация в quizEngine; режим проверки с подсветкой правильных/неправильных по типам.
- **Дублирование:** в paragraph.js и quiz.js своя проверка URL изображений (imageHtml / safeImageSrc) — логика согласована, при желании можно вынести в общий util.

Что можно улучшить дальше: единый стек навигации и history API, отмена fetch при быстром переключении, валидация структуры теста (пустой questions) перед стартом, расширение админской санитизации на типы multiple_choice, match, fill_words.

---

## 1. Найденные проблемы (исторические и частично актуальные)

### 1.1 Баги и логические ошибки

| Проблема | Где | Описание |
|----------|-----|----------|
| **Хлебные крошки захардкожены** | `paragraph.js:166-170` | В `openParagraph` всегда выводятся "6 класс" и "История Беларуси" вместо текущих `classId`/`subjectId`. При открытии параграфа из "2 класс → Математика" крошки неверные. |
| **Кнопка "Выйти из теста"** | `quiz.js:90-96` | При `backAction === null` вызывается `renderHome()` — теряется контекст. При выходе из теста, открытого с параграфа, должен быть возврат на параграф (уже передаётся), но при прямом открытии теста нет "предыдущей страницы". Нужна единая навигация (стек/история). |
| **Input: один правильный ответ** | `quiz.js`, JSON | Поддерживается только поле `answer` (строка). Нет поддержки нескольких правильных вариантов (`answers: ["1253", "1253 год"]`). |
| **Переход при неправильном ответе** | `quiz.js` | Для choice при неправильном ответе переход не выполняется; показывается сообщение «Ответ неверный» и при наличии — подсказка/объяснение из полей вопроса. |
| **Нет проверки данных теста** | `quiz.js` | Если `data.questions` пустой или `data.questions[current]` undefined — падение при обращении к `q.q`, `q.a`, `q.c`. |
| **createCustomTest без .catch для Promise.all** | `quiz.js:226-254` | Внутренний `Promise.all(quizPromises)` не имеет `.catch` — при падении одного из fetch ошибка не обрабатывается. |

### 1.2 Дублирование кода

- **Fetch paragraphs.json** вызывается в трёх местах без кэша:
  - `app.js:53` — `renderSubject`
  - `paragraph.js:7` — `loadParagraphs` (функция нигде не вызывается — мёртвый код)
  - `paragraph.js:45` — `openParagraph`
  - `quiz.js:211` — `createCustomTest`
- **Одинаковый рендер ошибки**: "Ошибка загрузки" + кнопка "Главная" повторяется в `paragraph.js`, `quiz.js`, `app.js` с небольшими вариациями.
- **Повторная логика проверки ответа**: `checkChoiceAnswer` и `checkInputAnswer` дублируют идею "locked", подсчёт correct/wrong, вызов `nextStep` — можно свести к `validateAnswer(question, userAnswer)` и единому обработчику результата.

### 1.3 Уязвимости (XSS)

- **innerHTML + неэкранированные данные**: везде используется `innerHTML` с подстановкой `p.title`, `p.summary`, `s.content`, `d.event`, `t.term`, `t.definition`, `person.name`, `person.info`, `q.q`, `q.a`, данные из JSON. Достаточно добавить в `title` строку `<img src=x onerror="alert(1)">` — выполнится код.
- **onclick в разметке**: `onclick="renderClass('${c}')"` и т.п. — при экранировании кавычек в `c` возможен выход из атрибута и XSS. Глобальные функции в `onclick` тоже расширяют поверхность атаки.

### 1.4 Асинхронность и утечки состояния

- **Нет отмены запросов**: при быстром переключении (Класс → Предмет → другой Предмет) предыдущий `fetch` не отменяется; при завершении он может перезаписать уже открытый экран другим предметом.
- **Состояние только в замыканиях**: `current`, `correct`, `wrong`, `locked` живут внутри `startQuiz`. При повторном входе в тест состояние чистое — утечки нет, но нет и единого места хранения (state), что затрудняет "Назад" и восстановление.

### 1.5 Навигация и history

- **Browser history не используется**: все переходы — вызовы `renderHome()`, `renderClass()`, `renderSubject()`, `openParagraph()`. Кнопка "Назад" в браузере не возвращает по шагам приложения.
- **Нет единого стека навигации**: "Выйти из теста" опирается на переданный `backAction`; если кто-то вызовет `loadQuiz(path)` без второго аргумента, выход ведёт на главную, а не на "предыдущую страницу".

### 1.6 Отсутствие данных / undefined

- **paragraph.js**: если `p.sections`, `p.dates`, `p.terms`, `p.people` отсутствуют — проверки `p.sections && p.sections.length` есть; но для `s.content`, `d.event` и т.д. нет защиты от `undefined` при выводе (можно получить "undefined" в тексте).
- **quiz.js**: нет проверок `data.title`, `data.questions`, `q.type`, `q.q`; для input — `data.questions[current].answer` может отсутствовать.
- **app.js**: `CONFIG.classes[classId].subjects` — есть проверка `subject` в `renderSubject`, но при пустом `paragraphs` маппинг даст пустой список (нормально).

### 1.7 Прочее

- **Чекбокс у параграфов без тестов**: в текущем коде чекбокс показывается только при `hasQuiz` (`p.quizzes && p.quizzes.length`), у параграфов без тестов выводится `<small class="no-quiz">Тестов пока нет</small>`. То есть чекбокса у параграфов без тестов уже нет — требование выполнено. (Проверить по коду ещё раз.)
- **Нет индикатора загрузки**: при fetch нет loader'а — пользователь не видит, что идёт загрузка.

---

## 2. Улучшение архитектуры

### 2.1 Разделение слоёв

- **Data layer**: загрузка и кэширование JSON (paragraphs, quiz по пути). Один точка входа: `getParagraphs(path)`, `getQuiz(path)` с кэшем в памяти.
- **State**: централизованный объект (или модуль): `currentClass`, `currentSubject`, `currentSubjectPath`, `currentParagraphId`, `currentQuizPath`, `navigationStack` (массив шагов для "Назад").
- **Render layer**: функции только рисуют разметку, получают данные аргументами; не делают fetch. Использовать безопасную вставку текста (escape HTML или textContent / создание узлов).

### 2.2 Кэширование

- Кэш для `paragraphs.json` по ключу `path`.
- Кэш для `quiz-*.json` по полному пути.
- При возврате "Назад" (например, с параграфа на список тем) — не делать повторный fetch, брать из кэша.

### 2.3 Навигация

- Стек навигации: при каждом переходе пушить `{ type, payload }` (например `{ type: 'subject', classId, subjectId }`). "Выйти из теста" и "Назад" — pop и вызвать render по верхнему элементу стека.
- Опционально: синхронизация с `history.pushState`/`popstate`, чтобы браузерная кнопка "Назад" работала.

---

## 3. Тестовая система

### 3.1 Требования

- **Input**: строгая проверка без учёта регистра, обрезка пробелов (уже есть `normalize`: trim + toLowerCase).
- **Несколько правильных ответов**: в JSON поддерживать `answer` (строка) или `answers` (массив строк); нормализовать и проверять вхождение `userValue` в массив.
- **Не переходить к следующему вопросу при неправильном ответе** — уже так сделано для choice и input.
- **Универсальная проверка**: `validateAnswer(question, userAnswer)` возвращает `true/false`; по типу вопроса вызывать одну и ту же логику подсветки и nextStep/lock.

### 3.2 Поведение при неправильном ответе

- Для choice: подсвечивать только выбранную карточку как wrong; не подсвечивать правильный вариант; выводить сообщение «Ответ неверный» и при наличии в вопросе — подсказку или объяснение (`hint` или `explanation`); не переходить дальше.
- Для input: подсветить поле wrong, вывести то же сообщение с подсказкой/объяснением при наличии; при правильном — correct и через 700 ms nextStep.

---

## 4. Безопасность

- Заменить вставку произвольных строк в HTML через **escape**: функция `escapeHtml(str)`, подставлять в шаблоны только экранированный текст.
- Для динамических обработчиков: не использовать `onclick="..."` с подстановкой строк; вешать обработчики через `addEventListener` на контейнер (делегирование), храня идентификаторы в `data-*`.
- Проверять существование полей перед выводом: опциональный chaining и значения по умолчанию (`s.content ?? ''`).

---

## 5. Производительность

- Кэшировать `paragraphs.json` и файлы тестов (см. Data layer).
- Не делать повторные fetch при возврате "Назад" — рендер из state + кэш.

---

## 6. UX

- **Выйти из теста**: всегда возвращать на предыдущий экран (параграф или список тем), используя стек навигации; не сбрасывать на главную, если есть backAction/стек.
- **Чекбокс**: оставить только у параграфов с тестами (уже так).
- **Loader**: показывать индикатор загрузки при любом fetch; скрывать после прихода ответа или ошибки.
- **Ошибки fetch**: единый обработчик: сообщение + кнопка "Назад" или "Повторить".

---

## 7. Структура проекта и модульность

### 7.1 Предлагаемая файловая структура (ES modules)

```
index.html
assets/
  css/
    main.css
  js/
    main.js              # точка входа, инициализация
    config.js            # CONFIG (или из data.js)
    state.js             # state manager (currentClass, subject, stack, cache)
    api.js               # data layer: getParagraphs(path), getQuiz(path), fetchWithCache
    render/
      safeHtml.js        # escapeHtml, фрагменты разметки
      breadcrumbs.js     # setBreadcrumbs
      home.js            # renderHome
      class.js           # renderClass
      subject.js         # renderSubject
      paragraph.js       # renderParagraph (только рендер), openParagraph (оркестрация)
      quiz.js            # loadQuiz, startQuiz, createCustomTest, validateAnswer
    nav.js               # navigation stack, back()
data/
  ...
```

### 7.2 Зависимости между модулями

- `state` не зависит от UI.
- `api` использует только fetch и state (кэш).
- `render/*` используют `state` (чтение) и `safeHtml`; не вызывают api напрямую из рендера — данные передаёт оркестратор (app/nav).
- `quiz.js` использует `validateAnswer`, `api.getQuiz`, `state.navigationStack` для выхода.

### 7.3 Миграция на ES modules

- Заменить скрипты в `index.html` на один `<script type="module" src="assets/js/main.js">`.
- В `main.js`: `import { initApp } from './app.js'; initApp();` (или разбить на main + app).
- Экспорт из каждого файла: нужные функции и объекты; конфиг и state — отдельные модули. Глобальные переменные (`app`, `breadcrumbs`) убрать: передавать root-элементы в init или получать внутри модуля один раз.

---

## 7.1 Оптимизация и что можно удалить

- **Мёртвый код:** убедиться, что нет неиспользуемых функций (ранее удалён `loadParagraphs` из paragraph.js). При сборке/минификации неиспользуемое отсечётся.
- **Дублирование URL-проверки:** `safeImageSrc` (quiz.js) и `imageHtml` (paragraph.js) — схожая логика; можно вынести в `utils/safeHtml.js` общую функцию `safeImageUrl(value, basePath)` и вызывать из обоих мест.
- **Жёстко заданные строки:** часть сообщений («Ошибка загрузки теста», «Для выбранных параграфов нет тестов» и т.д.) захардкожена в quiz.js и app.js — при интернационализации вынести в объект строк или модуль i18n.
- **Константы:** вынести в один модуль (например, `config.js` или в начало файла) ключ localStorage `school-portal-data`, лимиты вопросов (20, 50), размеры кэша при необходимости.

Удалять без необходимости не рекомендуется: старые форматы (paragraphs.json, отдельные quiz-*.json) сохраняют обратную совместимость.

---

## 8. Итоговая таблица приоритетов

| Приоритет | Что сделать |
|-----------|-------------|
| Высокий | XSS: escapeHtml везде, убрать небезопасный innerHTML для пользовательских данных |
| Высокий | Валидация: validateAnswer, поддержка answers[], проверка наличия data.questions и полей |
| Высокий | Хлебные крошки в openParagraph от текущего класса/предмета (из state или аргументов) |
| Средний | Data layer + кэш, централизованный state |
| Средний | Навигация: стек, "Выйти из теста" = назад по стеку |
| Средний | Loader и обработка ошибок fetch |
| Низкий | История браузера (pushState/popstate) |
| Низкий | Модульная структура и ES modules |

---

## 9. Улучшенные версии функций

### 9.1 Безопасный вывод (защита от XSS)

```javascript
// assets/js/utils/safeHtml.js
function escapeHtml(str) {
    if (str == null || typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/"/g, '&quot;');
}
```

Использование: все данные из JSON перед вставкой в разметку пропускать через `escapeHtml(title)`, `escapeHtml(summary)` и т.д. В onclick не подставлять сырые значения — использовать `data-*` и делегирование.

### 9.2 Универсальная проверка ответа

```javascript
function normalizeAnswer(str) {
    return String(str == null ? '' : str).trim().toLowerCase();
}

function validateAnswer(question, userAnswer) {
    if (!question) return false;
    const normalized = normalizeAnswer(userAnswer);

    if (question.type === 'choice') {
        const correctIndex = question.c;
        if (correctIndex == null || !Array.isArray(question.a)) return false;
        return parseInt(userAnswer, 10) === correctIndex;
    }

    if (question.type === 'input') {
        const answers = question.answers || (question.answer != null ? [question.answer] : []);
        return answers.some(a => normalizeAnswer(a) === normalized);
    }

    return false;
}
```

Поддержка нескольких правильных ответов: в JSON можно задать `"answers": ["1253", "1253 год"]`. Проверка без учёта регистра и с обрезкой пробелов.

### 9.3 Data layer с кэшем

```javascript
// assets/js/api.js
const cache = new Map();

function fetchJson(url) {
    return fetch(url).then(res => {
        if (!res.ok) throw new Error('Ошибка загрузки: ' + res.status);
        return res.json();
    });
}

function getCached(key, fetchFn) {
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    return fetchFn().then(data => {
        cache.set(key, data);
        return data;
    });
}

function getParagraphs(path) {
    return getCached(path + 'paragraphs.json', () => fetchJson(path + 'paragraphs.json'));
}

function getQuiz(fullPath) {
    return getCached(fullPath, () => fetchJson(fullPath));
}
```

### 9.4 Централизованный state и навигация

```javascript
// assets/js/state.js
const state = {
    currentClassId: null,
    currentSubjectId: null,
    currentSubjectPath: null,
    currentParagraphId: null,
    navigationStack: [] // { type: 'home'|'class'|'subject'|'paragraph'|'quiz', payload }
};

function navPush(entry) {
    state.navigationStack.push(entry);
}

function navBack() {
    state.navigationStack.pop();
    return state.navigationStack[state.navigationStack.length - 1];
}

function getCurrentSubject() {
    const c = state.currentClassId, s = state.currentSubjectId;
    return window.CONFIG?.classes?.[c]?.subjects?.[s] ?? null;
}
```

### 9.5 Схема архитектуры

```
┌─────────────────────────────────────────────────────────────┐
│  UI (index.html, #app, #breadcrumbs)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Render layer (renderHome, renderSubject, renderParagraph,   │
│  renderQuizQuestion, renderResult) — только разметка,        │
│  данные аргументами, escapeHtml для текста                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Navigation / Orchestration (openParagraph, loadQuiz,        │
│  createCustomTest, back) — вызывают api, state, render       │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  State (currentClass, currentSubject, path, navigationStack) │
│  API (getParagraphs, getQuiz) + cache                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Config (CONFIG.classes)                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Реализованные изменения (итог)

В проекте внесены следующие изменения.

### Новые файлы

- **`assets/js/utils/safeHtml.js`** — `escapeHtml()` для защиты от XSS.
- **`assets/js/api.js`** — слой данных: `Api.getParagraphs(path)`, `Api.getQuiz(path)` с кэшем в памяти.
- **`assets/js/state.js`** — состояние: `State.setCurrentSubject()`, `State.getCurrentSubject()` для хлебных крошек и контекста.

### Правки в существующих файлах

- **app.js**: загрузка тем через `Api.getParagraphs`, индикатор загрузки `showLoader`, экранирование через `escapeHtml`, клики через `data-*` и `addEventListener` (без `onclick="..."`), хлебные крошки с `data-action`/`data-args` и вызовом `window[action].apply(null, args)`, сохранение контекста в `State.setCurrentSubject`.
- **paragraph.js**: удалён неиспользуемый `loadParagraphs`, загрузка через `Api.getParagraphs`, хлебные крошки из `State.getCurrentSubject()` (класс и предмет берутся из state, а не захардкожены), весь контент параграфа и тестов выводится через `escapeHtml`, кнопки через `data-*` и `addEventListener`.
- **quiz.js**: универсальная проверка `validateAnswer(question, userAnswer)`, поддержка нескольких правильных ответов (`question.answers` или `question.answer`), нормализация ввода (trim + toLowerCase), при неправильном ответе выводится сообщение «Ответ неверный» и при наличии — подсказка/объяснение из полей `hint` или `explanation` вопроса (правильный вариант не подсвечивается); загрузка через `Api.getQuiz` и кэш, `showLoader` при загрузке, обработка пустого теста и ошибок, «Выйти из теста» и «Назад» после результата вызывают переданный `backAction` (возврат на параграф или на список тем).
- **index.html**: подключены `safeHtml.js`, `api.js`, `state.js` перед остальными скриптами.
- **main.css**: стили для `.loader`, `.container--loader`, `.breadcrumb-link`.

### Рекомендуемая файловая структура (следующий шаг — ES modules)

```
index.html
assets/
  css/
    main.css
  js/
    main.js              # точка входа (одна запись в index)
    config.js            # CONFIG
    utils/
      safeHtml.js        # escapeHtml
    api.js               # getParagraphs, getQuiz, кэш
    state.js             # state + навигация
    app.js               # renderHome, renderClass, renderSubject, setBreadcrumbs, showLoader
    paragraph.js         # openParagraph
    quiz.js              # loadQuiz, startQuiz, createCustomTest, validateAnswer, shuffleArray
    nav.js               # (опционально) renderSubjectFromPath и общий back()
data/
  ...
docs/
  CODE_REVIEW.md
```

При переходе на ES modules: один `<script type="module" src="assets/js/main.js">`, в `main.js` — `import` остальных модулей и вызов `renderHome()` или единой функции инициализации.
