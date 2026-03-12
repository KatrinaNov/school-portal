# Схема данных контента

## Целевой формат: единый `content.json` по предмету (v1)

Файл **`data/<classId>/<subjectId>/content.json`** содержит параграфы и тесты в одном месте. Если он есть, загрузчик использует его вместо `paragraphs.json` и отдельных `quiz-*.json`.

### Корень

| Поле | Тип | Обязательное | Описание |
|------|-----|--------------|----------|
| `version` | number | да | Версия схемы (1). Для миграций и валидации. |
| `meta` | object | нет | Метаданные предмета. |
| `meta.classId` | string | нет | Идентификатор класса. |
| `meta.subjectId` | string | нет | Идентификатор предмета. |
| `meta.title` | string | нет | Название предмета. |
| `meta.updated` | string | нет | Дата обновления (ISO или YYYY-MM-DD). |
| `paragraphs` | array | да | Массив параграфов. |
| `quizzes` | array | да | Массив тестов (полные объекты с вопросами). |

### Параграф, разделы, даты, термины, персоны, тесты

- **paragraphs[]**: id, title, summary, image?, sections[], dates[], terms[], people[], quizzes[] (ссылки: id, title, source?).
- **sections[]**: title, content, image?.
- **dates[]**: id?, year, event, image?.
- **terms[]**: id?, term, definition, image?.
- **people[]**: id?, name, info, image?.
- **paragraph.quizzes[]**: id, title, source? — ссылка на корневой quizzes[].
- **quizzes[]** (корень): id, title, source?, difficulty?, questions[].

### Типы вопросов (questions[])

Поддерживаются типы: **choice**, **input**, **multiple_choice**, **match**, **fill_words**. Во всех типах поле **q** — текст вопроса; опционально **image** — путь к картинке (относительно папки предмета).

| type | Поля | Описание |
|------|------|----------|
| **choice** | q, a[], c, image? | Один правильный вариант. **a** — массив строк или объектов `{ text, image? }`. **c** — индекс правильного (0-based). |
| **input** | q, answer или answers[], image? | Ввод ответа. **answer** (строка) или **answers** (массив допустимых). Проверка без учёта регистра, trim. |
| **multiple_choice** | q, a[], c[], image? | Несколько правильных. **a** — варианты (строка или `{ text, image? }`). **c** — массив индексов правильных. |
| **match** | q, pairs[][] | Сопоставление пар. **pairs** — массив пар `[левое, правое]`. Правая колонка перемешивается при показе. |
| **fill_words** | q, answers[] | Вставка слов по порядку пропусков. **q** — текст с пропусками (обозначаются как ___). **answers** — массив правильных слов (проверка без регистра). |

Общие опциональные поля вопроса: **hint**, **explanation** (подсказка и объяснение при ошибке).

Подробности и примеры — в CONTENT-GUIDE.md и ROADMAP.md, раздел 3.2. Адаптер приводит оба формата (content.json и paragraphs.json + quiz-*.json) к одному виду для приложения.
