# Vibe & Code

Набор небольших веб‑приложений на чистом HTML, CSS и JavaScript.

## Планирование

- [how-many-sp](./how-many-sp) — калькулятор сторипоинтов по трём критериям: неопределённость, сложность, объём.
- [triangular-estimation](./triangular-estimation) — оценка задачи по методу PERT: три точки, итог по формуле `(O + 4R + P) / 6`.

## Музыка

- [gamma-trainer](./gamma-trainer) — тренажёр ладов и гамм: ступени, трезвучия, родственные тональности.

## Игры

- [babylon-tower](./babylon-tower) — 3D‑головоломка на пятиугольной призме: скользи фишки, вращай слои (Three.js).
- [tic-tac-toe](./tic-tac-toe) — Swap‑Tac‑Toe: крестики‑нолики с механикой swap и режимом против компьютера.
- [drop-it-not](./drop-it-not) — mobile-first игра на реакцию: следи за траекторией шара, жди цель и нажимай в окно попадания.
- [the-maze](./the-maze) — Dual Grid Puzzle: управляй двумя объектами одновременно и достигни цели за нужное число шагов.

## Стек

Vanilla HTML / CSS / JavaScript. Без сборщиков и фреймворков.
Внешние зависимости только там, где без них не обойтись: Three.js в `babylon-tower`, Font Awesome в `the-maze`.

Каждое приложение автономно и открывается напрямую через `index.html`. Общие стили — `styles/common.css`.
