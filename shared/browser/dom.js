export function getElement(selector, fallback = null, root = document) {
    const element = root.querySelector(selector);
    if (!element && fallback) {
        console.warn(`Element not found: ${selector}. ${fallback}`);
    }
    return element;
}

export function getElements(selector, root = document) {
    return root.querySelectorAll(selector);
}

export function addEventListener(selector, event, handler, root = document) {
    const element = getElement(selector, null, root);
    if (element) {
        element.addEventListener(event, handler);
    }
}
