const API_URL = 'https://ru.wikipedia.org/w/api.php';
const WIKI_ORIGIN = 'https://ru.wikipedia.org';
const WIKI_ARTICLE_BASE = `${WIKI_ORIGIN}/wiki/`;
const WIKI_REST_PAGE_URL = `${WIKI_ORIGIN}/w/rest.php/v1/page`;
const TIMER_INTERVAL_MS = 250;
const RANDOM_PAIR_ATTEMPTS = 3;
const RECORDS_STORAGE_KEY = 'wiki-path-records';

const STATUSES = Object.freeze({
    LOADING: 'LOADING',
    PLAYING: 'PLAYING',
    FINISHED: 'FINISHED',
    ERROR: 'ERROR'
});

const ARTICLE_VIEWS = Object.freeze({
    CURRENT: 'CURRENT',
    TARGET: 'TARGET'
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

const dom = {
    targetTitle: document.querySelector('#targetTitle'),
    timer: document.querySelector('#timer'),
    transitionCount: document.querySelector('#transitionCount'),
    revisitCount: document.querySelector('#revisitCount'),
    recordsButton: document.querySelector('#recordsButton'),
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
    currentArticleTab: document.querySelector('#currentArticleTab'),
    targetArticleTab: document.querySelector('#targetArticleTab'),
    articlePanel: document.querySelector('#articlePanel'),
    articleEyebrow: document.querySelector('#articleEyebrow'),
    currentTitle: document.querySelector('#currentTitle'),
    articleContent: document.querySelector('#articleContent'),
    transitionLoader: document.querySelector('#transitionLoader'),
    resultScreen: document.querySelector('#resultScreen'),
    resultPair: document.querySelector('#resultPair'),
    resultTime: document.querySelector('#resultTime'),
    resultTransitions: document.querySelector('#resultTransitions'),
    resultRevisits: document.querySelector('#resultRevisits'),
    routeList: document.querySelector('#routeList'),
    resultNewGameButton: document.querySelector('#resultNewGameButton'),
    recordsModal: document.querySelector('#recordsModal'),
    closeRecordsButton: document.querySelector('#closeRecordsButton'),
    recordsEmpty: document.querySelector('#recordsEmpty'),
    recordsList: document.querySelector('#recordsList')
};

let session = null;
let roundToken = 0;
let requestController = null;
let timerId = null;
let retryAction = null;
let recordsReturnFocus = null;
let articleRenderToken = 0;

function createSession(startPage, targetPage) {
    return {
        startPageId: startPage.pageid,
        startTitle: startPage.title,
        targetPageId: targetPage.pageid,
        targetTitle: targetPage.title,
        currentPageId: null,
        currentTitle: '',
        currentArticle: null,
        targetArticle: null,
        articleView: ARTICLE_VIEWS.CURRENT,
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
    if (!page.title) {
        throw new Error('Wikipedia article title is unavailable');
    }

    const encodedTitle = encodeURIComponent(page.title.replaceAll(' ', '_'));
    const response = await fetch(`${WIKI_REST_PAGE_URL}/${encodedTitle}/html`, {
        headers: { Accept: 'text/html' },
        signal
    });

    if (!response.ok) {
        throw new Error(`Wikipedia REST API returned HTTP ${response.status}`);
    }

    const html = await response.text();
    const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
    const pageId = Number.parseInt(
        parsedDocument.querySelector('meta[property="mw:pageId"]')?.getAttribute('content') ?? '',
        10
    );
    const title = parsedDocument.title.trim();

    if (!Number.isInteger(pageId) || pageId <= 0 || !title || !parsedDocument.body) {
        throw new Error('Wikipedia article is unavailable');
    }

    return {
        pageid: pageId,
        title,
        html
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
    const replacement = link.ownerDocument.createElement('span');
    replacement.className = 'wiki-disabled-link';
    replacement.replaceChildren(...link.childNodes);
    link.replaceWith(replacement);
}

function prepareArticleDocument(html, interactiveLinks = true) {
    const parsedDocument = new DOMParser().parseFromString(html, 'text/html');
    parsedDocument.querySelectorAll('script').forEach((element) => element.remove());
    let base = parsedDocument.querySelector('base');
    if (!base) {
        base = parsedDocument.createElement('base');
        parsedDocument.head.prepend(base);
    }
    base.href = WIKI_ARTICLE_BASE;

    parsedDocument.querySelectorAll('link[href]').forEach((link) => {
        link.href = new URL(link.getAttribute('href'), WIKI_ARTICLE_BASE).href;
    });

    parsedDocument.querySelectorAll('a').forEach((link) => {
        const playableTitle = getPlayableTitle(link.getAttribute('href'));
        const isUnavailable = link.classList.contains('new');

        if (!interactiveLinks || !playableTitle || isUnavailable) {
            replaceLinkWithText(link);
            return;
        }

        link.setAttribute('href', '#');
        link.dataset.wikiTitle = playableTitle;
        link.removeAttribute('target');
        link.removeAttribute('rel');
    });

    return `<!DOCTYPE html>\n${parsedDocument.documentElement.outerHTML}`;
}

function updateArticleFrameHeight() {
    const frameDocument = dom.articleContent.contentDocument;
    if (!frameDocument) return;

    dom.articleContent.style.height = '1px';
    const height = Math.max(
        frameDocument.documentElement?.scrollHeight ?? 0,
        frameDocument.body?.scrollHeight ?? 0,
        frameDocument.body?.offsetHeight ?? 0
    );
    dom.articleContent.style.height = `${Math.max(320, Math.ceil(height))}px`;
}

function bindArticleFrameInteractions(frameDocument) {
    frameDocument.addEventListener('click', (event) => {
        const link = event.target.closest?.('a[data-wiki-title]');
        if (!link) return;
        event.preventDefault();
        navigateToArticle(link.dataset.wikiTitle);
    });

    ['auxclick', 'contextmenu', 'dragstart'].forEach((eventName) => {
        frameDocument.addEventListener(eventName, (event) => {
            if (event.target.closest?.('a[data-wiki-title]')) {
                event.preventDefault();
            }
        });
    });

    frameDocument.addEventListener('mousedown', (event) => {
        if (event.button === 1 && event.target.closest?.('a[data-wiki-title]')) {
            event.preventDefault();
        }
    });
}

function loadArticleFrame(documentHtml, renderToken) {
    return new Promise((resolve) => {
        dom.articleContent.addEventListener('load', () => {
            if (renderToken !== articleRenderToken) {
                resolve(false);
                return;
            }

            const frameDocument = dom.articleContent.contentDocument;
            if (!frameDocument) {
                resolve(false);
                return;
            }

            bindArticleFrameInteractions(frameDocument);
            updateArticleFrameHeight();
            resolve(true);
        }, { once: true });

        dom.articleContent.style.height = '320px';
        dom.articleContent.srcdoc = documentHtml;
    });
}

async function renderArticle(article, view = ARTICLE_VIEWS.CURRENT) {
    const renderToken = ++articleRenderToken;
    const isTarget = view === ARTICLE_VIEWS.TARGET;
    session.articleView = view;
    dom.currentArticleTab.classList.toggle('is-active', !isTarget);
    dom.currentArticleTab.setAttribute('aria-selected', String(!isTarget));
    dom.currentArticleTab.tabIndex = isTarget ? -1 : 0;
    dom.targetArticleTab.classList.toggle('is-active', isTarget);
    dom.targetArticleTab.setAttribute('aria-selected', String(isTarget));
    dom.targetArticleTab.tabIndex = isTarget ? 0 : -1;
    dom.articlePanel.setAttribute('aria-labelledby', isTarget ? 'targetArticleTab' : 'currentArticleTab');
    dom.articleEyebrow.textContent = isTarget ? 'Цель' : 'Текущая статья';
    dom.currentTitle.textContent = article.title;
    dom.articleContent.title = `${isTarget ? 'Цель' : 'Текущая статья'}: ${article.title}`;
    await loadArticleFrame(prepareArticleDocument(article.html, !isTarget), renderToken);
    if (renderToken !== articleRenderToken) return;

    document.title = isTarget
        ? `Цель: ${article.title} · Wiki Path`
        : `${article.title} → ${session.targetTitle} · Wiki Path`;
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

function getRussianCountText(count, forms) {
    const lastTwoDigits = count % 100;
    const lastDigit = count % 10;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return `${count} ${forms[2]}`;
    }
    if (lastDigit === 1) {
        return `${count} ${forms[0]}`;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
        return `${count} ${forms[1]}`;
    }
    return `${count} ${forms[2]}`;
}

function loadRecords() {
    try {
        const storedRecords = JSON.parse(window.localStorage.getItem(RECORDS_STORAGE_KEY) ?? '[]');
        if (!Array.isArray(storedRecords)) {
            return [];
        }

        return storedRecords.filter((record) => (
            typeof record?.startTitle === 'string'
            && typeof record?.targetTitle === 'string'
            && Number.isFinite(record?.elapsedMilliseconds)
            && Number.isFinite(record?.transitionCount)
            && Number.isFinite(record?.revisitCount)
        ));
    } catch (error) {
        console.warn('Failed to load Wiki Path records:', error);
        return [];
    }
}

function saveCompletedRecord() {
    const records = loadRecords();
    records.unshift({
        startTitle: session.startTitle,
        targetTitle: session.targetTitle,
        elapsedMilliseconds: getElapsedTime(),
        transitionCount: session.transitionCount,
        revisitCount: session.revisitCount,
        finishedAt: session.finishedAt
    });

    try {
        window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
        console.warn('Failed to save Wiki Path record:', error);
    }
}

function createRecordItem(record) {
    const item = document.createElement('li');
    const route = document.createElement('span');
    const metrics = document.createElement('span');

    route.className = 'record-route';
    route.textContent = `Старт «${record.startTitle}» — Конец «${record.targetTitle}»`;
    metrics.className = 'record-metrics';
    metrics.textContent = `${formatTime(record.elapsedMilliseconds)}, ${getRussianCountText(record.transitionCount, ['переход', 'перехода', 'переходов'])}, ${getRussianCountText(record.revisitCount, ['повтор', 'повтора', 'повторов'])}`;
    item.append(route, document.createTextNode(': '), metrics);
    return item;
}

function renderRecords() {
    const records = loadRecords();
    dom.recordsList.replaceChildren(...records.map(createRecordItem));
    dom.recordsEmpty.hidden = records.length > 0;
    dom.recordsList.hidden = records.length === 0;
}

function openRecords() {
    renderRecords();
    recordsReturnFocus = document.activeElement;
    dom.recordsModal.hidden = false;
    document.body.classList.add('modal-open');
    dom.closeRecordsButton.focus();
}

function closeRecords() {
    if (dom.recordsModal.hidden) {
        return;
    }

    dom.recordsModal.hidden = true;
    document.body.classList.remove('modal-open');
    recordsReturnFocus?.focus();
    recordsReturnFocus = null;
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
    dom.currentArticleTab.disabled = isLoading;
    dom.targetArticleTab.disabled = isLoading;
}

async function showCurrentArticle() {
    if (!session || session.status !== STATUSES.PLAYING || !session.currentArticle) {
        return;
    }

    hideError();
    await renderArticle(session.currentArticle, ARTICLE_VIEWS.CURRENT);
    window.scrollTo({ top: 0, behavior: 'auto' });
}

async function showTargetArticle() {
    if (!session || session.status !== STATUSES.PLAYING || session.articleView === ARTICLE_VIEWS.TARGET) {
        return;
    }

    if (session.targetArticle) {
        hideError();
        await renderArticle(session.targetArticle, ARTICLE_VIEWS.TARGET);
        window.scrollTo({ top: 0, behavior: 'auto' });
        return;
    }

    const token = roundToken;
    requestController = new AbortController();
    session.status = STATUSES.LOADING;
    hideError();
    setTransitionLoading(true);

    try {
        const article = await fetchArticle({ title: session.targetTitle }, requestController.signal);
        if (token !== roundToken) return;

        session.targetArticle = article;
        session.status = STATUSES.PLAYING;
        await renderArticle(article, ARTICLE_VIEWS.TARGET);
        window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (error) {
        if (error.name === 'AbortError' || token !== roundToken) return;
        console.error(`Failed to load target Wikipedia article "${session.targetTitle}":`, error);
        session.status = STATUSES.PLAYING;
        await renderArticle(session.currentArticle, ARTICLE_VIEWS.CURRENT);
        showTransitionError(showTargetArticle);
    } finally {
        if (token === roundToken) {
            requestController = null;
            setTransitionLoading(false);
        }
    }
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
        const startArticle = await fetchArticle({ title: startPage.title }, requestController.signal);
        if (token !== roundToken) return;

        session.startPageId = startArticle.pageid;
        session.startTitle = startArticle.title;
        session.currentPageId = startArticle.pageid;
        session.currentTitle = startArticle.title;
        session.currentArticle = startArticle;
        session.visitedPages.push({ pageid: startArticle.pageid, title: startArticle.title, revisit: false });
        session.visitedPageIds.add(startArticle.pageid);
        await renderArticle(startArticle, ARTICLE_VIEWS.CURRENT);

        session.status = STATUSES.PLAYING;
        session.startedAt = Date.now();
        dom.initialState.hidden = true;
        dom.articleStage.hidden = false;
        updateArticleFrameHeight();
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
    if (!session || session.status !== STATUSES.PLAYING || session.articleView !== ARTICLE_VIEWS.CURRENT) {
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
        session.currentPageId = article.pageid;
        session.currentTitle = article.title;
        session.currentArticle = article;
        session.transitionCount += 1;
        session.revisitCount += revisit ? 1 : 0;
        session.visitedPages.push({ pageid: article.pageid, title: article.title, revisit });
        session.visitedPageIds.add(article.pageid);
        await renderArticle(article, ARTICLE_VIEWS.CURRENT);
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
    saveCompletedRecord();

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

dom.currentArticleTab.addEventListener('click', showCurrentArticle);
dom.targetArticleTab.addEventListener('click', showTargetArticle);
window.addEventListener('resize', updateArticleFrameHeight);

dom.recordsButton.addEventListener('click', openRecords);
dom.closeRecordsButton.addEventListener('click', closeRecords);
dom.recordsModal.addEventListener('click', (event) => {
    if (event.target === dom.recordsModal) {
        closeRecords();
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dom.recordsModal.hidden) {
        closeRecords();
    }
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
