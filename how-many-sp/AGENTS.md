# AGENTS.md - Калькулятор сторипоинтов

## Описание приложения

Приложение "Сколько сториков?" позволяет оценить сложность задачи в сторипоинтах на основе трех критериев:
- **Uncertainty** (неопределенность) - насколько хорошо известна задача и её решение
- **Complexity** (сложность) - насколько сложно реализовать задачу при полном понимании
- **Effort** (объем) - сколько обязательных шагов требует решение

## Основные механики

### 1. Матрица оценки
Приложение использует трехмерную матрицу для расчета сторипоинтов:

```javascript
const spMatrix = {
    'low': {
        'low': { 'low': 1, 'medium': 2, 'high': 5 },
        'medium': { 'low': 2, 'medium': 3, 'high': 5 },
        'high': { 'low': 3, 'medium': 5, 'high': 8 }
    },
    'medium': {
        'low': { 'low': 3, 'medium': 5, 'high': 8 },
        'medium': { 'low': 5, 'medium': 5, 'high': 8 },
        'high': { 'low': 5, 'medium': 8, 'high': 13 }
    },
    'high': {
        'low': { 'low': 8, 'medium': 8, 'high': 13 },
        'medium': { 'low': 8, 'medium': 8, 'high': 13 },
        'high': { 'low': 13, 'medium': 13, 'high': 21 }
    }
}
```

### 2. Логика расчета
- Функция `calculateSp(properties)` получает значения трех критериев
- Возвращает соответствующее значение из матрицы: `SP_MATRIX[uncertainty][complexity][effort]`
- При ошибке возвращает -1

### 3. Визуальная обратная связь
- **Цветовая индикация**: зеленый (<5), оранжевый (5–7), красный (≥8) — из `COLORS` в shared/utils.js
- **Текстовые подсказки** для сложных задач (5+, 8+, 13+)
- **Динамическое обновление** при изменении значений

### 4. Пользовательский интерфейс
- Радиокнопки для каждого критерия (low/medium/high) через `.radio-group-*` из common.css
- Мгновенный пересчет при изменении
- Адаптивный дизайн с flexbox

## Структура файлов

```
how-many-sp/
├── index.html      # Основная разметка с формой
├── index.css       # Стили с адаптивным дизайном
├── index.js        # Логика расчета и UI (класс StoryPointsCalculator)
└── AGENTS.md       # Этот файл
```

## Ключевые функции

### `getActualTaskProperties()`
Получает текущие значения из формы:
- Читает выбранные радиокнопки `[name=complexity]`, `[name=effort]`, `[name=uncertainty]`
- Возвращает объект `{ complexity, effort, uncertainty }`

### `calculateSp(properties)`
Выполняет расчет сторипоинтов:
- Обращается к `SP_MATRIX[uncertainty][complexity][effort]`
- Обрабатывает ошибки

### `updateSpValue()`
Обновляет UI:
- Вызывает расчет, обновляет цвет и текст
- Показывает подсказки через `updateSpDescription(sp)` и `updateSpColor(sp)`

## Правила работы

### 1. HTML структура
- Семантическая разметка с описанием критериев
- Радиокнопки с правильными `name` атрибутами
- Контейнеры `#sp-count` для результата и `#sp-description` для подсказки

### 2. CSS стили
- Общие стили из `/shared/common.css`
- Дополнительные стили в `index.css`
- Адаптивная ширина контейнера (650px)

### 3. JavaScript логика
- ES6 модуль с импортом из `../shared/utils.js` (DOMUtils, ErrorUtils, COLORS)
- Класс `StoryPointsCalculator` инкапсулирует всю логику
- Обработчик событий на контейнере формы `#task-properties`

## Зависимости

- **Общие стили**: `/shared/common.css`
- **Общие утилиты**: `../shared/utils.js` (DOMUtils, ErrorUtils, COLORS)
- **Google Fonts**: Roboto, Roboto Condensed
- **Общие ресурсы**: изображения из `/images/`
