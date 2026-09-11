import { generatePuzzle } from './generator.js';

self.onmessage = ({ data }) => {
    try { self.postMessage({ puzzle: generatePuzzle(data) }); }
    catch { self.postMessage({ error: true }); }
};
