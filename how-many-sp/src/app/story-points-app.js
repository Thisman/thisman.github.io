import { calculateStoryPoints, describeStoryPoints, getStoryPointsColor } from '../core/story-points.js';

export function createStoryPointsApp(view) {
    function update(properties = view.readProperties()) {
        const storyPoints = calculateStoryPoints(properties);
        view.render({
            storyPoints,
            description: describeStoryPoints(storyPoints),
            color: getStoryPointsColor(storyPoints)
        });
    }

    function init() {
        view.onChange(update);
        update();
    }

    return {
        init,
        update
    };
}
