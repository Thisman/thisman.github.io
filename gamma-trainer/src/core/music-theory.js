export const NOTE_NAMES = ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си'];

export const MODE_STEPS = {
    ionian: [2, 2, 1, 2, 2, 2, 1],
    dorian: [2, 1, 2, 2, 2, 1, 2],
    phrygian: [1, 2, 2, 2, 1, 2, 2],
    lydian: [2, 2, 2, 1, 2, 2, 1],
    mixolydian: [2, 2, 1, 2, 2, 1, 2],
    aeolian: [2, 1, 2, 2, 1, 2, 2],
    locrian: [1, 2, 2, 1, 2, 2, 2]
};

export const MODES = [
    { id: 'ionian', name: 'Ионийский (мажорный)', idx: 1 },
    { id: 'dorian', name: 'Дорийский', idx: 2 },
    { id: 'phrygian', name: 'Фригийский', idx: 3 },
    { id: 'lydian', name: 'Лидийский', idx: 4 },
    { id: 'mixolydian', name: 'Миксолидийский', idx: 5 },
    { id: 'aeolian', name: 'Эолийский (минорный)', idx: 6 },
    { id: 'locrian', name: 'Локрийский', idx: 7 }
];

export const CHARACTERISTIC_DEGREES = {
    ionian: [],
    dorian: [5],
    phrygian: [1],
    lydian: [3],
    mixolydian: [6],
    aeolian: [5],
    locrian: [4]
};

export const ROMAN_DEGREES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export function buildScale(tonicIndex, modeId) {
    const steps = MODE_STEPS[modeId];
    const notes = [tonicIndex];
    let current = tonicIndex;

    for (let index = 0; index < 6; index += 1) {
        current = (current + steps[index]) % 12;
        notes.push(current);
    }

    return notes;
}

export function triadQuality(root, third, fifth) {
    const interval = (left, right) => (right - left + 12) % 12;
    const thirdInterval = interval(root, third);
    const fifthInterval = interval(root, fifth);

    if (thirdInterval === 4 && fifthInterval === 7) {
        return 'major';
    }

    if (thirdInterval === 3 && fifthInterval === 7) {
        return 'minor';
    }

    if (thirdInterval === 3 && fifthInterval === 6) {
        return 'dim';
    }

    if (thirdInterval === 4 && fifthInterval === 8) {
        return 'aug';
    }

    return 'other';
}

export function getModeMeta(modeId) {
    return MODES.find((mode) => mode.id === modeId);
}

export function createScalePresentation(tonicIndex, modeId) {
    const meta = getModeMeta(modeId);
    const scale = buildScale(tonicIndex, modeId);
    const characteristicSet = new Set(CHARACTERISTIC_DEGREES[modeId] || []);

    const parentMajorIndex = (8 - meta.idx) % 7;
    const relativeMinorIndex = (parentMajorIndex + 5) % 7;
    const parentMajorPitch = scale[parentMajorIndex];
    const relativeMinorPitch = scale[relativeMinorIndex];

    return scale.map((pitch, index) => {
        const third = scale[(index + 2) % 7];
        const fifth = scale[(index + 4) % 7];
        const quality = triadQuality(pitch, third, fifth);
        let degree = ROMAN_DEGREES[index];

        if (quality === 'minor') {
            degree = degree.toLowerCase();
        } else if (quality === 'dim') {
            degree = `${degree.toLowerCase()}°`;
        } else if (quality === 'aug') {
            degree = `${degree}+`;
        }

        return {
            pitch,
            note: NOTE_NAMES[pitch],
            degree,
            quality,
            isCharacteristic: characteristicSet.has(index),
            isParentMajor: pitch === parentMajorPitch,
            isParentMinor: pitch === relativeMinorPitch
        };
    });
}
