(function initAnalytics() {
    if (window.ym) {
        return;
    }

    const scriptUrl = 'https://mc.yandex.ru/metrika/tag.js?id=107098559';
    const existing = Array.from(document.scripts).find((script) => script.src === scriptUrl);
    if (!existing) {
        const script = document.createElement('script');
        script.async = true;
        script.src = scriptUrl;
        const firstScript = document.getElementsByTagName('script')[0];
        if (firstScript?.parentNode) {
            firstScript.parentNode.insertBefore(script, firstScript);
        } else {
            document.head.appendChild(script);
        }
    }

    window.ym = window.ym || function ymProxy() {
        (window.ym.a = window.ym.a || []).push(arguments);
    };
    window.ym.l = Number(new Date());
    window.ym(107098559, 'init', {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: 'dataLayer',
        referrer: document.referrer,
        url: location.href,
        accurateTrackBounce: true,
        trackLinks: true
    });
})();
