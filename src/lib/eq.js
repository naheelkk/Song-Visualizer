export const EQ_BANDS = [
  { freq: 60, label: '60', kind: 'lowshelf' },
  { freq: 170, label: '170', kind: 'peaking' },
  { freq: 350, label: '350', kind: 'peaking' },
  { freq: 1000, label: '1k', kind: 'peaking' },
  { freq: 3500, label: '3.5k', kind: 'peaking' },
  { freq: 12000, label: '12k', kind: 'highshelf' },
];

export const EQ_MIN = -12;
export const EQ_MAX = 12;

export const EQ_PRESETS = [
  { id: 'flat', name: 'Flat', gains: [0, 0, 0, 0, 0, 0] },
  { id: 'bass', name: 'Bass', gains: [8, 6, 2, 0, -1, -1] },
  { id: 'vocal', name: 'Vocal', gains: [-3, 0, 4, 5, 2, -1] },
  { id: 'electronic', name: 'Electronic', gains: [6, 3, -1, 1, 3, 5] },
  { id: 'rock', name: 'Rock', gains: [5, 2, -2, 0, 3, 4] },
  { id: 'lofi', name: 'Lo-Fi', gains: [4, 2, 0, -3, -5, -8] },
  { id: 'night', name: 'Night', gains: [-2, -1, 1, 2, 0, -3] },
];

export const FLAT_GAINS = [...EQ_PRESETS[0].gains];

export function defaultEq() {
  return { enabled: true, preset: 'flat', gains: [...FLAT_GAINS] };
}
