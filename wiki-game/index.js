const API_URL = 'https://ru.wikipedia.org/w/api.php';
const WIKI_ORIGIN = 'https://ru.wikipedia.org';
const WIKI_ARTICLE_BASE = `${WIKI_ORIGIN}/wiki/`;
const IMAGE_HOST = 'upload.wikimedia.org';
const TIMER_INTERVAL_MS = 250;
const RANDOM_PAIR_ATTEMPTS = 3;

const STATUSES = Object.freeze({
    LOADING: 'LOADING',
    PLAYING: 'PLAYING',
    FINISHED: 'FINISHED',
    ERROR: 'ERROR'
});

const BLOCKED_NAMESPACE_PREFIXES = new Set([
    'category', 'category talk', 'file', 'file talk', 'gadget', 'gadget definition',
    'gadget definition talk', 'gadget talk', 'help', 'help talk', 'media', 'mediawiki',
    'mediawiki talk', 'module', 'module talk', 'portal', 'portal talk', 'special',
    'talk', 'template', 'template talk', 'timedtext', 'timedtext talk', 'topic',
    'user', 'user talk', 'wikipedia', 'wikipedia talk',
    'категория', 'медиа', 'модуль', 'обсуждение', 'обсуждение mediawiki',
    'обсуждение категории', 'обсуждение модуля', 'обсуждение портала',
    'обсуждение справки', 'обсуждение участника', 'обсуждение файла',
    'обсуждение шаблона', 'обсуждение википедии', 'портал', 'справка',
    'служебная', 'участник', 'файл', 'шаблон', 'википедия'
]);

const REMOVED_CONTENT_SELECTORS = [
    'script', 'style', 'link', 'meta', 'base', 'iframe', 'object', 'embed',
    'form', 'input', 'button', 'textarea', 'select', 'audio', 'video', 'source', 'nav',
    '.mw-editsection', '.mw-indicators', '.mw-jump-link', '.toc',
    '.mw-table-of-contents', '.navbox', '.vertical-navbox', '.sistersitebox',
    '.infobox', '.sidebar', '.portal', '.catlinks', '.mw-normal-catlinks', '.mw-hidden-catlinks',
    '.printfooter', '.mw-authority-control', '.navigation-not-searchable',
    '.mw-cite-backlink'
].join(',');

const dom = {
    targetTitle: document.querySelector('#targetTitle'),
    timer: document.querySelector('#timer'),
    transitionCount: document.querySelector('#transitionCount'),
    revisitCount: document.querySelector('#revisitCount'),
    newGameButton: document.querySelector('#newGameButton'),
    initialState: document.querySelector('#initialState'),
    initialTitle: document.querySelector('#initialTitle'),
    initialMessage: document.querySelector('#initialMessage'),
    loadingDots: document.querySelector('#loadingDots'),
    initialRetryButton: document.querySelector('#initialRetryButton'),
    errorPanel: document.querySelector('#errorPanel'),
    errorMessage: document.querySelector('#errorMessage'),
    retryButton: document.querySelector('#retryButton'),
    articleStage: document.querySelector('#articleStage'),
    currentTitle: document.querySelector('#currentTitle'),
    articleContent: document.querySelector('#articleContent'),
    transitionLoader: document.querySelector('#transitionLoader'),
    resultScreen: document.querySelector('#resultScreen'),
    resultPair: document.querySelector('#resultPair'),
    resultTime: document.querySelector('#resultTime'),
    resultTransitions: document.querySelector('#resultTransitions'),
    resultRevisits: document.querySelector('#resultRevisits'),
    routeList: document.querySelector('#routeList'),
    resultNewGameButton: document.querySelector('#resultNewGameButton')
};

let session = null;
let roundToken = 0;
let requestController = null;
let timerId = null;
let retryAction = null;

function createSession(startPage, targetPage) {
    return {
        startPageId: startPage.pageid,
        startTitle: startPage.title,
        targetPageId: targetPage.pageid,
        targetTitle: targetPage.title,
        currentPageId: null,
        currentTitle: '',
        startedAt: null,
        finishedAt: null,
        visitedPages: [],
        visitedPageIds: new Set(),
        transitionCount: 0,
        revisitCount: 0,
        status: STATUSES.LOADING
    };
}

async function apiRequest(parameters, signal) {
    const query = new URLSearchParams({
        ...parameters,
        format: 'json',
        formatversion: '2',
        origin: '*'
    });
    const response = await fetch(`${API_URL}?${query}`, {
        headers: { Accept: 'application/json' },
        signal
    });

    if (!response.ok) {
        throw new Error(`Wikipedia API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.info || data.error.code || 'Wikipedia API error');
    }

    return data;
}

async function fetchRandomPair(signal) {
    for (let attempt = 0; attempt < RANDOM_PAIR_ATTEMPTS; attempt += 1) {
        const data = await apiRequest({
            action: 'query',
            generator: 'random',
            grnnamespace: '0',
            grnfilterredir: 'nonredirects',
            grnlimit: '2',
            prop: 'info'
        }, signal);
        const pages = data.query?.pages ?? [];

        if (pages.length >= 2 && pages[0].pageid !== pages[1].pageid) {
            return pages.slice(0, 2);
        }
    }

    throw new Error('Wikipedia API did not return two different articles');
}

async function fetchArticle(page, signal) {
    const pageParameter = page.pageid
        ? { pageid: String(page.pageid) }
        : { page: page.title };
    const data = await apiRequest({
        action: 'parse',
        ...pageParameter,
        prop: 'text|displaytitle',
        redirects: '1',
        disableeditsection: '1',
        disabletoc: '1'
    }, signal);
    const parsed = data.parse;

    if (!parsed?.pageid || !parsed.title || typeof parsed.text !== 'string') {
        throw new Error('Wikipedia article is unavailable');
    }

    return {
        pageid: parsed.pageid,
        title: parsed.title,
        html: parsed.text
    };
}

function normalizeArticleTitle(title) {
    return title.replaceAll('_', ' ').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}

function getPlayableTitle(rawHref) {
    if (!rawHref || rawHref.startsWith('#')) {
        return null;
    }

    let url;
    try {
        url = new URL(rawHref, WIKI_ARTICLE_BASE);
    } catch {
        return null;
    }

    if (url.origin !== WIKI_ORIGIN || !url.pathname.startsWith('/wiki/') || url.search) {
        return null;
    }

    let title;
    try {
        title = decodeURIComponent(url.pathname.slice('/wiki/'.length)).replaceAll('_', ' ').trim();
    } catch {
        return null;
    }

    if (!title) {
        return null;
    }

    const namespaceSeparator = title.indexOf(':');
    if (namespaceSeparator !== -1) {
        const prefix = title.slice(0, namespaceSeparator).trim().toLocaleLowerCase('ru');
        if (BLOCKED_NAMESPACE_PREFIXES.has(prefix)) {
            return null;
        }
    }

    return title;
}

function replaceLinkWithText(link) {
    const replacement = document.createElement('span');
    replacement.className = 'wiki-disabled-link';
    replacement.replaceChildren(...link.childNodes);
    link.replaceWith(replacement);
}

function normalizeImage(image) {
    const rawSource = image.getAttribute('src') || image.getAttribute('data-src');

    try {
        const source = new URL(rawSource, WIKI_ORIGIN);
        if (source.protocol !== 'https:' || source.hostname !== IMAGE_HOST) {
            image.remove();
            return;
        }
        image.src = source.href;
    } catch {
        image.remove();
        return;
    }

    image.removeAttribute('srcset');
    image.removeAttribute('data-src');
    image.loading = 'lazy';
    image.decoding = 'async';
}

function prepareArticleHtml(html) {
    const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
    parsedDocument.querySelectorAll(REMOVED_CONTENT_SELECTORS).forEach((element) => element.remove());

    parsedDocument.querySelectorAll('a').forEach((link) => {
        const playableTitle = getPlayableTitle(link.getAttribute('href'));
        const isUnavailable = link.classList.contains('new');

        if (!playableTitle || isUnavailable) {
            replaceLinkWithText(link);
            return;
        }

        link.href = '#';
        link.dataset.wikiTitle = playableTitle;
        link.removeAttribute('target');
        link.removeAttribute('rel');
    });

    parsedDocument.querySelectorAll('img').forEach(normalizeImage);
    parsedDocument.querySelectorAll('*').forEach((element) => {
        [...element.attributes].forEach((attribute) => {
            const name = attribute.name.toLocaleLowerCase();
            if (name.startsWith('on') || name === 'style' || name === 'id' || name === 'srcdoc' || name === 'contenteditable') {
                element.removeAttribute(attribute.name);
            }
        });
    });

    return parsedDocument.body.innerHTML;
}

function renderArticle(article) {
    dom.currentTitle.textContent = article.title;
    dom.articleContent.innerHTML = prepareArticleHtml(article.html);
    document.title = `${article.title} → ${session.targetTitle} · Wiki Path`;
}

function updateHud() {
    dom.targetTitle.textContent = session?.targetTitle ?? 'Выбираем статью…';
    dom.transitionCount.textContent = String(session?.transitionCount ?? 0);
    dom.revisitCount.textContent = String(session?.revisitCount ?? 0);
    updateTimer();
}

function getElapsedTime() {
    if (!session?.startedAt) {
        return 0;
    }
    return Math.max(0, (session.finishedAt ?? Date.now()) - session.startedAt);
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const seconds = totalSeconds % 60;
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    const parts = [minutes, seconds].map((part) => String(part).padStart(2, '0'));

    if (hours > 0) {
        parts.unshift(String(hours).padStart(2, '0'));
    }
    return parts.join(':');
}

function updateTimer() {
    dom.timer.textContent = formatTime(getElapsedTime());
}

function startTimer() {
    stopTimer();
    updateTimer();
    timerId = window.setInterval(updateTimer, TIMER_INTERVAL_MS);
}

function stopTimer() {
    if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
    }
}

function hideError() {
    dom.errorPanel.hidden = true;
    retryAction = null;
}

function showTransitionError(action) {
    retryAction = action;
    dom.errorMessage.textContent = 'Не удалось загрузить статью';
    dom.errorPanel.hidden = false;
}

function showInitialLoading() {
    dom.initialState.hidden = false;
    dom.initialTitle.textContent = 'Строим новый маршрут';
    dom.initialMessage.textContent = 'Выбираем две случайные статьи и готовим стартовую страницу.';
    dom.loadingDots.hidden = false;
    dom.initialRetryButton.hidden = true;
    dom.articleStage.hidden = true;
    dom.resultScreen.hidden = true;
}

function showInitialError() {
    dom.initialState.hidden = false;
    dom.initialTitle.textContent = 'Не удалось создать игру';
    dom.initialMessage.textContent = 'Wikipedia сейчас не ответила. Попробуйте запросить новый маршрут.';
    dom.loadingDots.hidden = true;
    dom.initialRetryButton.hidden = false;
    dom.articleStage.hidden = true;
    dom.resultScreen.hidden = true;
}

function setTransitionLoading(isLoading) {
    dom.articleStage.classList.toggle('is-loading', isLoading);
    dom.articleContent.setAttribute('aria-busy', String(isLoading));
    dom.transitionLoader.hidden = !isLoading;
}

async function startNewGame() {
    const token = ++roundToken;
    requestController?.abort();
    requestController = new AbortController();
    stopTimer();
    session = null;
    hideError();
    setTransitionLoading(false);
    showInitialLoading();
    updateHud();
    dom.newGameButton.disabled = true;
    document.title = 'Wiki Path — игра по Википедии';

    try {
        const [startPage, targetPage] = await fetchRandomPair(requestController.signal);
        if (token !== roundToken) return;

        session = createSession(startPage, targetPage);
        updateHud();
        const startArticle = await fetchArticle({ pageid: startPage.pageid }, requestController.signal);
        if (token !== roundToken) return;

        session.startPageId = startArticle.pageid;
        session.startTitle = startArticle.title;
        session.currentPageId = startArticle.pageid;
        session.currentTitle = startArticle.title;
        session.visitedPages.push({ pageid: startArticle.pageid, title: startArticle.title, revisit: false });
        session.visitedPageIds.add(startArticle.pageid);
        renderArticle(startArticle);

        session.status = STATUSES.PLAYING;
        session.startedAt = Date.now();
        dom.initialState.hidden = true;
        dom.articleStage.hidden = false;
        window.scrollTo({ top: 0, behavior: 'auto' });
        startTimer();
        updateHud();
    } catch (error) {
        if (error.name === 'AbortError' || token !== roundToken) return;
        console.error('Failed to start Wiki Path round:', error);
        if (session) session.status = STATUSES.ERROR;
        showInitialError();
    } finally {
        if (token === roundToken) {
            requestController = null;
            dom.newGameButton.disabled = false;
        }
    }
}

async function navigateToArticle(title) {
    if (!session || session.status !== STATUSES.PLAYING) {
        return;
    }

    if (normalizeArticleTitle(title) === normalizeArticleTitle(session.currentTitle)) {
        return;
    }

    const token = roundToken;
    requestController = new AbortController();
    session.status = STATUSES.LOADING;
    hideError();
    setTransitionLoading(true);

    try {
        const article = await fetchArticle({ title }, requestController.signal);
        if (token !== roundToken) return;

        if (article.pageid === session.currentPageId) {
            session.status = STATUSES.PLAYING;
            return;
        }

        const revisit = session.visitedPageIds.has(article.pageid);
        renderArticle(article);
        session.currentPageId = article.pageid;
        session.currentTitle = article.title;
        session.transitionCount += 1;
        session.revisitCount += revisit ? 1 : 0;
        session.visitedPages.push({ pageid: article.pageid, title: article.title, revisit });
        session.visitedPageIds.add(article.pageid);
        updateHud();
        window.scrollTo({ top: 0, behavior: 'auto' });

        if (article.pageid === session.targetPageId) {
            finishRound();
        } else {
            session.status = STATUSES.PLAYING;
        }
    } catch (error) {
        if (error.name === 'AbortError' || token !== roundToken) return;
        console.error(`Failed to load Wikipedia article "${title}":`, error);
        session.status = STATUSES.PLAYING;
        showTransitionError(() => navigateToArticle(title));
    } finally {
        if (token === roundToken) {
            requestController = null;
            setTransitionLoading(false);
        }
    }
}

function finishRound() {
    session.status = STATUSES.FINISHED;
    session.finishedAt = Date.now();
    stopTimer();
    updateHud();

    dom.resultPair.textContent = `${session.startTitle}  →  ${session.targetTitle}`;
    dom.resultTime.textContent = formatTime(getElapsedTime());
    dom.resultTransitions.textContent = String(session.transitionCount);
    dom.resultRevisits.textContent = String(session.revisitCount);
    dom.routeList.replaceChildren(...session.visitedPages.map((page) => {
        const item = document.createElement('li');
        item.append(document.createTextNode(page.title));
        if (page.revisit) {
            item.classList.add('is-revisit');
            const mark = document.createElement('span');
            mark.className = 'revisit-mark';
            mark.textContent = '↻ повтор';
            item.append(mark);
        }
        return item;
    }));

    dom.articleStage.hidden = true;
    dom.resultScreen.hidden = false;
    document.title = `Победа · ${session.startTitle} → ${session.targetTitle}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

dom.articleContent.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-wiki-title]');
    if (!link) return;
    event.preventDefault();
    navigateToArticle(link.dataset.wikiTitle);
});

dom.retryButton.addEventListener('click', () => {
    const action = retryAction;
    hideError();
    action?.();
});

dom.newGameButton.addEventListener('click', startNewGame);
dom.initialRetryButton.addEventListener('click', startNewGame);
dom.resultNewGameButton.addEventListener('click', startNewGame);

startNewGame();
