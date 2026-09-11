export const DIFFICULTIES = [
    { id: 'intro', label: 'Intro', gridSize: 5, clues: 24 },
    { id: 'easy', label: 'Easy', gridSize: 6, clues: 42 },
    { id: 'normal', label: 'Normal', gridSize: 7, clues: 50 },
    { id: 'hard', label: 'Hard', gridSize: 8, clues: 56 },
    { id: 'expert', label: 'Expert', gridSize: 9, clues: 40 },
    { id: 'extreme', label: 'Extreme', gridSize: 9, clues: 32 }
];
export const getDifficulty = id => DIFFICULTIES.find(item => item.id === id);

// Strategy-based MVP filters, not a calibrated measure of a person's skill.
export function matchesDifficulty(id, metrics) {
    if (!metrics.solved) return false;
    const chain = metrics.longestDependencyChain;
    switch (id) {
        case 'intro': return metrics.singlesSolved && chain <= 4;
        case 'easy': return metrics.singlesSolved && chain <= 5;
        case 'normal': return metrics.pairsSolved && (!metrics.singlesSolved || chain >= 6);
        case 'hard': return !metrics.singlesSolved && metrics.logicSolved && (chain >= 12 || metrics.contradictionEliminations > 0);
        case 'expert': return !metrics.singlesSolved && (chain >= 25 || metrics.contradictionEliminations > 0 || metrics.branchCount > 0);
        case 'extreme': return !metrics.singlesSolved && (chain >= 35 || metrics.contradictionEliminations >= 3 || metrics.branchCount > 0);
        default: return false;
    }
}
