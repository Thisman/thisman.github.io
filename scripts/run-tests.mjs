const testFiles = [
    '../babylon-tower/tests/puzzle.test.js',
    '../gamma-trainer/tests/music-theory.test.js',
    '../how-many-sp/tests/story-points.test.js',
    '../my-valentine/tests/game-state.test.js',
    '../the-maze/tests/core.test.mjs',
    '../tic-tac-toe/tests/board.test.js',
    '../triangular-estimation/tests/pert.test.js'
];

for (const file of testFiles) {
    await import(file);
}
