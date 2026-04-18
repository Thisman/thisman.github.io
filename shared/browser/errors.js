export function showError(element, message) {
    if (!element) {
        return;
    }

    element.textContent = message;
    element.style.display = 'block';
}

export function clearError(element) {
    if (!element) {
        return;
    }

    element.textContent = '';
    element.style.display = 'none';
}

export function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
}
