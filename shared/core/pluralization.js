const UNIT_FORMS = {
    hours: {
        one: 'час',
        few: 'часа',
        many: 'часов'
    },
    days: {
        one: 'день',
        few: 'дня',
        many: 'дней'
    },
    weeks: {
        one: 'неделя',
        few: 'недели',
        many: 'недель'
    }
};

export function getRussianUnitText(number, unit) {
    const unitForms = UNIT_FORMS[unit];
    if (!unitForms) {
        return '';
    }

    const lastDigit = number % 10;
    const lastTwoDigits = number % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
        return unitForms.many;
    }

    if (lastDigit === 1) {
        return unitForms.one;
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
        return unitForms.few;
    }

    return unitForms.many;
}
