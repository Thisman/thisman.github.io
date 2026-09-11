<div align="center">

# ✦ Vibe & Code

**Небольшие веб‑приложения, сделанные с душой.**
Чистый HTML, CSS и JavaScript — без фреймворков, без сборщиков, без лишнего.

[![Live](https://img.shields.io/badge/🌐_Live-thisman.github.io-5a7896?style=for-the-badge)](https://thisman.github.io)
[![Stars](https://img.shields.io/github/stars/Thisman/thisman.github.io?style=for-the-badge&color=5a8a70)](https://github.com/Thisman/thisman.github.io/stargazers)
[![Forks](https://img.shields.io/github/forks/Thisman/thisman.github.io?style=for-the-badge&color=b88040)](https://github.com/Thisman/thisman.github.io/network)

</div>

---

## 📋 Планирование

<table>
<tr>
<td width="50%" valign="top">

### 🎯 Сколько сториков?
**[→ Открыть](https://thisman.github.io/how-many-sp)**

Устал угадывать сторипоинты на планинге? Этот калькулятор делает оценку воспроизводимой.

Выбери три параметра — **неопределённость**, **сложность**, **объём** — и получи ответ по матрице: от 1 до 21.

`Uncertainty × Complexity × Effort → SP`

</td>
<td width="50%" valign="top">

### 📐 Треугольная оценка
**[→ Открыть](https://thisman.github.io/triangular-estimation)**

Классический метод PERT в одном экране.

Введи оптимистичную, реалистичную и пессимистичную оценки — получи взвешенный результат по формуле:

`⌈(O + 4R + P) / 6⌉`

</td>
</tr>
</table>

---

## 🎵 Музыка

<table>
<tr>
<td width="50%" valign="top">

### 🎸 Тренажёр гамм
**[→ Открыть](https://thisman.github.io/gamma-trainer)**

Для тех, кто хочет понять музыкальную теорию, а не просто заучить паттерны.

Выбери лад — увидишь ступени, трезвучия и родственные тональности. Удобно для гитаристов и всех, кто разбирается в гармонии.

`Лады · Гаммы · Трезвучия · Тональности`

</td>
<td width="50%" valign="top">
</td>
</tr>
</table>

---

## 🎮 Игры

### ◉ Edgoku
**[→ Открыть](https://thisman.github.io/edge-coloring/)**

Раскрасьте рёбра сетки четырьмя цветами так, чтобы у каждой вершины цвета различались. Сложности задают размер и число защищённых подсказок: Intro — 5×5/24, Easy — 6×6/42, Normal — 7×7/50, Hard — 8×8/56, Expert — 9×9/40, Extreme — 9×9/32. Каждый пазл имеет единственное решение; подсказки не образуют полностью открытых квадратов. Генерация отменяется новым кликом по табу и показывает лоадер минимум 2 секунды без сдвигов интерфейса. Цвет растекается от клика за 0,3 секунды и заполняет сектора вершин. Правый клик выбирает следующий цвет и красит ребро под указателем. Подсветка конфликтов, таймер, шесть палитр и сохранение текущей партии. Числовых уровней нет.

`Vanilla JavaScript · SVG · Без сборки · localStorage`

<table>
<tr>
<td width="50%" valign="top">

### 🏛️ Вавилонская башня
**[→ Открыть](https://thisman.github.io/babylon-tower)**

3D‑головоломка прямо в браузере. Пятиугольная призма, фишки, слои — верти, скользи, решай.

Сделано на Three.js, но запускается без установки чего‑либо.

`Three.js · 3D · Puzzle`

</td>
<td width="50%" valign="top">

### ❌ Swap‑Tac‑Toe
**[→ Открыть](https://thisman.github.io/tic-tac-toe)**

Крестики‑нолики, но с твистом: когда поле заполнено — можно **свапнуть** любую свою фишку.

Режим против компьютера с ИИ-ботом. Простые правила, неочевидная глубина.

`2-player · vs AI · Swap mechanic`

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🌀 Dual Grid Puzzle
**[→ Открыть](https://thisman.github.io/the-maze)**

Управляй **двумя объектами одновременно** — одним движением. Доведи оба до цели.

Уровни генерируются процедурно. Самый технически насыщенный проект коллекции.

`ES6 Modules · CLI tools · Tests`

</td>
<td width="50%" valign="top">

### ✳ Lightstep — Тише света
**[→ Открыть](https://thisman.github.io/lightstep)**

Перепрыгивай световые волны и доберись до выхода с процедурного 3D-острова. 12 форм поля, 16 ускоряющихся паттернов, исчезающие красные клетки и новый уровень сразу после победы.

`Three.js · WASD + Space · Без сборки`

</td>
</tr>
</table>

---

## 🛠️ Стек

```
HTML · CSS · Vanilla JavaScript
```

Никаких фреймворков. Никаких сборщиков. Каждое приложение — автономный `index.html`.

Внешние зависимости только там, где без них не обойтись:
- **Three.js** — в `babylon-tower` и `lightstep` для 3D‑рендеринга
- **Font Awesome** — в `the-maze` для иконок

Общая дизайн‑система живёт в `shared/common.css` — тёплая, матовая палитра с [`--bg: #f6f2ea`](./shared/common.css).

---

<div align="center">

Сделано с удовольствием · [thisman.github.io](https://thisman.github.io)

</div>
