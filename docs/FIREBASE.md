# Firebase (Auth + Firestore) — настройка и миграция

Документ описывает, как настроить Firebase для School Portal, не ломая гостевой режим.

## 1) Что уже есть в проекте

- Vite сборка:
  - `npm run dev` — локальный dev server
  - `npm run build` — сборка в `dist/`
- Firebase Web SDK:
  - `src/firebase.js` — `auth`, `db`
  - `src/auth.js` — вход Google / email + регистрация
- Гостевой режим:
  - без авторизации приложение продолжает работать на JSON (`data/**`).
- Статистика студента:
  - после завершения теста у залогиненных сохраняется попытка в `users/{uid}/quizAttempts/*`
  - страница `#/me` показывает результаты
- Админка:
  - `dist/admin.html` — админ панель (отдельная страница)
  - CRUD в UI как раньше (localStorage), плюс:
    - «Загрузить из Firebase»
    - «Синхронизировать в Firebase»
    - вкладка «Студенты»

## 2) Настройка Firebase Console

### 2.1 Создать проект

Firebase Console → Create project.

### 2.2 Добавить Web App

Project settings → **Your apps** → Web (`</>`) → скопировать конфиг в `src/firebase.js`.

### 2.3 Включить Auth providers

Authentication → Sign-in method:
- Email/Password → Enable
- Google → Enable

### 2.4 Authorized domains (GitHub Pages)

Authentication → Settings → Authorized domains:
- добавить `YOUR_USERNAME.github.io`

### 2.5 Создать Firestore

Firestore Database → Create database.

## 3) Firestore Security Rules

В репозитории есть пример:
- `firebase/firestore.rules`

Правила:
- контент (`classes`, `subjects`, `paragraphs`, `quizzes`) читается публично (гостевой режим возможен)
- запись контента — только для админа (проверка: существует документ `admins/{uid}`)
- статистика — пользователь пишет только в свой `users/{uid}/quizAttempts/*`

### Как назначить админа

Самый простой способ без серверной части:
1) Войдите на сайте под своим аккаунтом.
2) В Firebase Console → Firestore → создать документ:
   - коллекция: `admins`
   - doc id: ваш `uid`
   - поля: `createdAt` (Timestamp) опционально

После этого админка (`admin.html`) будет доступна.

## 4) Миграция данных из JSON в Firestore

В проекте есть скрипт:
- `scripts/migrate-to-firestore.mjs`

Он читает:
- `data/**/content.json` (целевой формат, если есть)
- иначе `data/**/paragraphs.json` + `quiz-*.json` (legacy)
и пишет в коллекции:
- `classes`, `subjects`, `paragraphs`, `quizzes`

Перед миграцией рекомендуется привести контент к единому формату (и пройти проверки):

```bash
npm run unify:data
npm run validate:data
```

### Требования

Нужен service account JSON (локально, НЕ коммитить):
1) Firebase Console → Project settings → Service accounts → Generate new private key
2) Сохранить файл, например `C:/secrets/firebase-sa.json`

### Запуск

PowerShell:

```powershell
$env:FIREBASE_SERVICE_ACCOUNT=\"C:\\secrets\\firebase-sa.json\"
$env:FIREBASE_PROJECT_ID=\"YOUR_PROJECT_ID\"
npm run migrate:firestore
```

## 5) GitHub Pages (как деплоить)

GitHub Pages раздаёт статику, поэтому деплоим **`dist/`** после `npm run build`.

Рекомендуемый вариант:
- GitHub Actions → build → publish `dist/` в Pages.

Важно:
- GitHub Pages не даёт удобно управлять HTTP заголовками (CSP/COOP/COEP). Для Auth это не критично.

## 6) Firestore indexes

В репозитории есть пример индекса:
- `firebase/firestore.indexes.json`

Он нужен, если будете сортировать `quizAttempts` по `finishedAt` (страница профиля и админка).

