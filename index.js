const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const header = document.querySelector('.site-header');
const welcome = document.querySelector('.welcome');
const carousel = document.querySelector('.carousel');
const stage = carousel.querySelector('.carousel-stage');
const cards = [...carousel.querySelectorAll('.game-card')];
const counter = carousel.querySelector('[data-current]');
const status = carousel.querySelector('[data-carousel-status]');
const TYPE_DURATION = 800;
const SWIPE_DISTANCE = 45;
const screens = [...document.querySelectorAll('.screen')];
const sectionLinks = [...document.querySelectorAll('.section-nav a')];
const WHEEL_GESTURE_GAP = 180;
const SCROLL_TOLERANCE = 2;
const SCROLL_TIMEOUT = 1500;
let activeIndex = 0;

let pageScrolling = false;
let pageScrollFrame = 0;
let lastWheelTime = -Infinity;

function scrollOneScreen(direction) {
    if (pageScrolling) return;
    const viewportHeight = document.documentElement.clientHeight;
    const position = window.scrollY;
    let index = screens.length - 1;
    while (index > 0 && screens[index].offsetTop > position + SCROLL_TOLERANCE) index--;
    const screen = screens[index];
    const top = screen.offsetTop;
    const bottom = top + Math.max(0, screen.offsetHeight - viewportHeight);
    let target;
    // On short displays, show the rest of a tall section before leaving it.
    if (direction > 0) {
        target = position < bottom - SCROLL_TOLERANCE
            ? Math.min(position + viewportHeight, bottom)
            : (screens[index + 1]?.offsetTop ?? bottom);
    } else if (position > top + SCROLL_TOLERANCE) {
        target = Math.max(top, position - viewportHeight);
    } else {
        const previous = screens[Math.max(0, index - 1)];
        target = previous.offsetTop + Math.max(0, previous.offsetHeight - viewportHeight);
    }
    scrollPageTo(target);
}

function scrollPageTo(target) {
    cancelAnimationFrame(pageScrollFrame);
    target = Math.min(target, document.documentElement.scrollHeight - document.documentElement.clientHeight);
    if (Math.abs(target - window.scrollY) <= SCROLL_TOLERANCE) {
        window.scrollTo({ top: target, behavior: 'instant' });
        pageScrolling = false;
        return;
    }
    pageScrolling = true;
    const started = performance.now();
    window.scrollTo({ top: target, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    function waitForScroll(now) {
        if (Math.abs(window.scrollY - target) <= SCROLL_TOLERANCE || now - started > SCROLL_TIMEOUT) {
            pageScrolling = false;
        } else pageScrollFrame = requestAnimationFrame(waitForScroll);
    }
    pageScrollFrame = requestAnimationFrame(waitForScroll);
}

function updateSectionNavigation() {
    const midpoint = window.scrollY + document.documentElement.clientHeight / 2;
    let active = 0;
    screens.forEach((screen, index) => { if (screen.offsetTop <= midpoint) active = index; });
    sectionLinks.forEach((link, index) => {
        if (index === active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
    });
}

sectionLinks.forEach((link, index) => {
    link.addEventListener('click', (event) => {
        event.preventDefault();
        scrollPageTo(screens[index].offsetTop);
    });
});

window.addEventListener('wheel', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    const now = performance.now();
    const newGesture = now - lastWheelTime > WHEEL_GESTURE_GAP;
    lastWheelTime = now;
    // The remaining momentum of a trackpad gesture must not skip more screens.
    if (newGesture) scrollOneScreen(Math.sign(event.deltaY));
}, { passive: false });

window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === ' ' && event.target.closest('a, button')) return;
    const direction = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': event.shiftKey ? -1 : 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    if (!event.repeat) scrollOneScreen(direction);
});

let pageTouch = null;
window.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    pageTouch = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY, id: touch.identifier } : null;
}, { passive: true });
window.addEventListener('touchmove', (event) => {
    if (event.touches.length !== 1) { pageTouch = null; return; }
    if (!pageTouch) return;
    const touch = event.touches[0];
    const dx = touch.clientX - pageTouch.x;
    const dy = touch.clientY - pageTouch.y;
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.3) event.preventDefault();
}, { passive: false });
window.addEventListener('touchend', (event) => {
    if (!pageTouch) return;
    const touch = [...event.changedTouches].find(item => item.identifier === pageTouch.id);
    if (!touch) return;
    const dx = touch.clientX - pageTouch.x;
    const dy = pageTouch.y - touch.clientY;
    pageTouch = null;
    if (Math.abs(dy) >= SWIPE_DISTANCE && Math.abs(dy) > Math.abs(dx) * 1.3) scrollOneScreen(Math.sign(dy));
}, { passive: true });
window.addEventListener('touchcancel', () => { pageTouch = null; }, { passive: true });

function updateHeader() {
    const visible = window.scrollY > 8;
    header.classList.toggle('is-visible', visible);
    header.inert = !visible;
}

// A document timeline: scrolling away never cancels it or starts it again.
function playIntro() {
    if (reducedMotion.matches) return;
    const characters = [];
    document.querySelectorAll('[data-type-line]').forEach((line) => {
        const text = line.textContent;
        line.textContent = '';
        for (const character of text) {
            const span = document.createElement('span');
            span.className = 'typing-character';
            span.textContent = character;
            line.append(span);
            characters.push(span);
        }
    });
    welcome.classList.add('is-typing');
    const start = performance.now();
    let previousCount = -1;
    function tick(now) {
        const elapsed = now - start;
        const count = Math.min(characters.length, Math.floor(elapsed / TYPE_DURATION * characters.length));
        if (count !== previousCount) {
            characters.forEach((character, index) => {
                character.classList.toggle('is-typed', index < count);
                character.classList.toggle('is-cursor', index === count - 1 && count < characters.length);
            });
            previousCount = count;
        }
        if (elapsed < TYPE_DURATION) requestAnimationFrame(tick);
        else {
            welcome.classList.remove('is-typing');
            welcome.classList.add('intro-finished');
        }
    }
    requestAnimationFrame(tick);
}

function showGame(index, announce = true) {
    activeIndex = (index + cards.length) % cards.length;
    cards.forEach((card, cardIndex) => {
        // Wrap distances so the first and last cards are also neighbours.
        let offset = (cardIndex - activeIndex + cards.length) % cards.length;
        if (offset > cards.length / 2) offset -= cards.length;
        const active = offset === 0;
        card.classList.toggle('is-active', active);
        card.classList.toggle('is-previous', offset === -1);
        card.classList.toggle('is-next', offset === 1);
        card.classList.toggle('is-before', offset < -1);
        card.classList.toggle('is-after', offset > 1);
        card.setAttribute('aria-hidden', String(!active));
        card.querySelector('a').tabIndex = active ? 0 : -1;
    });
    counter.textContent = String(activeIndex + 1).padStart(2, '0');
    if (announce) status.textContent = `${cards[activeIndex].querySelector('h3').textContent}, ${activeIndex + 1} из ${cards.length}`;
}

carousel.querySelector('.previous').addEventListener('click', () => showGame(activeIndex - 1));
carousel.querySelector('.next').addEventListener('click', () => showGame(activeIndex + 1));
carousel.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const focusWasOnCard = event.target.closest('.game-card');
    if (event.key === 'Home') showGame(0);
    else if (event.key === 'End') showGame(cards.length - 1);
    else showGame(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
    if (focusWasOnCard) cards[activeIndex].querySelector('a').focus({ preventScroll: true });
});

let pointerStart = null;
let suppressClick = false;
stage.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    suppressClick = false;
});
stage.addEventListener('pointermove', (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    // Leave vertical gestures to the browser; capture only horizontal drags.
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointerup', (event) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.3) {
        showGame(activeIndex + (dx < 0 ? 1 : -1));
        suppressClick = true;
    }
    pointerStart = null;
});
stage.addEventListener('pointercancel', () => { pointerStart = null; });
stage.addEventListener('lostpointercapture', (event) => {
    // Touch initially captures the link. Its bubbled release must not cancel
    // the gesture when capture is transferred from that link to the stage.
    if (event.target === stage) pointerStart = null;
});
stage.addEventListener('dragstart', (event) => event.preventDefault());
stage.addEventListener('click', (event) => {
    if (suppressClick) {
        event.preventDefault();
        suppressClick = false;
        return;
    }
    const card = event.target.closest('.game-card');
    if (!card || card.classList.contains('is-active')) return;
    event.preventDefault();
    showGame(cards.indexOf(card));
});

carousel.inert = true;
carousel.setAttribute('aria-busy', 'true');
document.body.classList.add('landing-ready');
showGame(0, false);
// Commit the initial positions with transitions disabled before revealing them.
document.fonts.ready.then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
        carousel.classList.add('is-ready');
        carousel.inert = false;
        carousel.setAttribute('aria-busy', 'false');
    }));
});
updateHeader();
updateSectionNavigation();
playIntro();
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('pageshow', updateHeader);
window.addEventListener('scroll', updateSectionNavigation, { passive: true });
window.addEventListener('resize', updateSectionNavigation);
window.addEventListener('pageshow', updateSectionNavigation);
