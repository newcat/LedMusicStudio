export function unitToSeconds(units: number, bpm: number) {
    return (units / 24) * (60 / bpm);
}

export function secondsToUnits(seconds: number, bpm: number) {
    return Math.floor((seconds / 60) * bpm * 24);
}
