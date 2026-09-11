export class PuzzleGeneration {
    constructor(createWorker = () => new Worker(new URL('./generation-worker.js', import.meta.url), { type: 'module' }), minimumMs = 2000) {
        this.createWorker = createWorker;
        this.minimumMs = minimumMs;
        this.worker = null;
        this.timer = null;
    }

    cancel() {
        this.worker?.terminate();
        clearTimeout(this.timer);
        this.timer = null;
        this.worker = null;
    }

    start(request, onReady, onError) {
        this.cancel();
        const started = performance.now();
        try {
            const worker = this.createWorker();
            this.worker = worker;
            let settled = false;
            const finish = (result, failed) => {
                if (this.worker !== worker || settled) return; // Ignore obsolete and duplicate messages.
                settled = true;
                worker.terminate();
                const publish = () => {
                    if (this.worker !== worker) return;
                    this.cancel();
                    if (failed) onError();
                    else onReady(result);
                };
                const remaining = this.minimumMs - (performance.now() - started);
                if (remaining > 0) this.timer = setTimeout(publish, remaining);
                else publish();
            };
            worker.onmessage = ({ data }) => finish(data.puzzle, data.error || !data.puzzle);
            worker.onerror = event => { event.preventDefault(); finish(null, true); };
            worker.onmessageerror = () => finish(null, true);
            worker.postMessage(request);
        } catch { this.cancel(); onError(); }
    }
}
