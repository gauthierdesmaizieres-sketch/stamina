// free-exercise-db muscle -> react-body-highlighter muscle slugs
export const MUSCLE_MAP = {
  abdominals: ['abs', 'obliques'],
  abductors: ['abductors'],
  adductors: ['adductor'],
  biceps: ['biceps'],
  calves: ['calves', 'left-soleus', 'right-soleus'],
  chest: ['chest'],
  forearms: ['forearm'],
  glutes: ['gluteal'],
  hamstrings: ['hamstring'],
  lats: ['upper-back'],
  'lower back': ['lower-back'],
  'middle back': ['upper-back'],
  neck: ['neck'],
  quadriceps: ['quadriceps'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  traps: ['trapezius'],
  triceps: ['triceps'],
}
export const MUSCLES = Object.keys(MUSCLE_MAP)

export const IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'

const slugs = muscles => [...new Set(muscles.flatMap(m => MUSCLE_MAP[m] ?? []))]

// Body-map data: primary muscles weigh 2 (strong colour), secondary 1 (light colour).
export function bodyData(primary, secondary = []) {
  return [
    { name: 'primary', muscles: slugs(primary), frequency: 2 },
    { name: 'secondary', muscles: slugs(secondary).filter(s => !slugs(primary).includes(s)), frequency: 1 },
  ]
}

export const muscleFromSlug = slug => MUSCLES.find(m => MUSCLE_MAP[m].includes(slug)) ?? ''

// Exercises with no equipment (or bodyweight) are always doable; an empty gym means "show everything".
export const inGym = (e, gym = []) => !gym.length || !e.equipment || e.equipment === 'body only' || gym.includes(e.equipment)

export function filterExercises(list, { q = '', muscle = '', equipment = '' }, gym = []) {
  const s = q.trim().toLowerCase()
  return list.filter(e =>
    (!s || e.name.toLowerCase().includes(s)) &&
    (!muscle || e.primaryMuscles.includes(muscle)) &&
    (!equipment || e.equipment === equipment) &&
    inGym(e, gym))
}

// Best set per session for one exercise, oldest first: heaviest weight, or most reps when done bodyweight.
export function progression(sessions, exId) {
  const done = sessions
    .map(s => ({ date: s.date, sets: s.entries.find(e => e.exId === exId)?.sets ?? [] }))
    .filter(p => p.sets.length)
    .sort((a, b) => a.date.localeCompare(b.date))
  const unit = done.some(p => p.sets.some(x => x.weight > 0)) ? 'kg' : 'reps'
  const points = done.map(({ date, sets }) => ({ date, value: Math.max(...sets.map(x => (unit === 'kg' ? x.weight : x.reps) || 0)) }))
  return { unit, points }
}

export const WEIGHT_STEP = 2.5 // kg, the smallest jump most gyms allow (two 1.25 kg plates)

// Double progression: once every set reached the target reps, add weight (or one rep when bodyweight);
// otherwise keep the weight and aim for the target again.
export function suggest(last, targetReps) {
  if (!last?.length) return null
  const weight = Math.max(...last.map(s => s.weight || 0))
  const reps = Math.max(...last.map(s => s.reps || 0))
  if (!last.every(s => s.reps >= targetReps)) return { weight, reps: targetReps, up: null }
  return weight > 0 ? { weight: weight + WEIGHT_STEP, reps: targetReps, up: 'weight' } : { weight: 0, reps: reps + 1, up: 'reps' }
}

// Sets from the most recent session containing this exercise, to prefill a new workout.
export function lastSets(sessions, exId) {
  const s = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).find(s => s.entries.some(e => e.exId === exId))
  return s?.entries.find(e => e.exId === exId).sets
}

// Flexibility module: body zones -> dataset muscles. 'full' mixes every zone.
export const STRETCH_ZONES = {
  hips: ['glutes', 'adductors', 'abductors'],
  hamstrings: ['hamstrings'],
  legs: ['quadriceps', 'calves'],
  back: ['lower back', 'middle back', 'lats', 'abdominals'],
  shoulders: ['shoulders', 'chest', 'biceps', 'triceps', 'forearms'],
  neck: ['neck', 'traps'],
}
export const HOLD = 30, REST = 10 // seconds
const LEVELS = { beginner: 1, intermediate: 2, expert: 3 }
// One-sided stretches, detected from the dataset's instructions ("repeat on the other side", ...).
const TWO_SIDES = /other side|each side|opposite side|switch sides|other leg|other arm|both sides|repeat with the other|repeat on the other/i
export const twoSided = e => TWO_SIDES.test(e.instructions.join(' '))
// Player steps: one-sided stretches are held once per side.
export const stretchSteps = list => list.flatMap(e => twoSided(e) ? [{ ex: e, side: 'Left side' }, { ex: e, side: 'Right side' }] : [{ ex: e }])

// Stretches for a zone at difficulty 1-3: the chosen level first, then easier ones, filling up to 5 min (10 for full body).
// 'roller' is the foam-roller massage session (~10 min), whatever the level: only 3 are beginner.
export function stretchSession(list, zone, level) {
  const isStretch = e => e.category === 'stretching' && e.equipment !== 'foam roll' && LEVELS[e.level] <= level
  const pick = muscles => list.filter(e => isStretch(e) && e.primaryMuscles.some(m => muscles.includes(m)))
    .sort((a, b) => LEVELS[b.level] - LEVELS[a.level])
  const budget = zone === 'full' || zone === 'roller' ? 600 : 300
  let used = 0
  const fits = e => { const s = (HOLD + REST) * (twoSided(e) ? 2 : 1); return used + s <= budget && (used += s) }
  if (zone === 'roller') return list.filter(e => e.category === 'stretching' && e.equipment === 'foam roll').filter(fits)
  if (zone !== 'full') return pick(STRETCH_ZONES[zone] ?? []).filter(fits)
  // Round-robin over zones so full body is not all hamstrings.
  const pools = Object.values(STRETCH_ZONES).map(pick), out = []
  for (let i = 0; pools.some(p => p[i]); i++)
    for (const p of pools) if (p[i] && !out.includes(p[i]) && fits(p[i])) out.push(p[i])
  return out
}

// Tendon module: long heavy isometric holds (Kubo 2001: 20 s+ holds at ~70% effort stiffen tendons, 1 s pulses do not).
// img: a dataset photo of a close pose (no wall-sit photo exists, the squat is the nearest).
export const TENDON_HOLDS = [
  { id: 'wall', name: 'Wall sit', tendon: 'Knees (patellar tendon)', img: 'Bodyweight_Squat/1.jpg',
    how: ['Back flat against a wall, slide down until your knees are bent at about 90°.', 'Knees over the ankles, weight in the heels.', 'Push your back into the wall and hold.'] },
  { id: 'calf', name: 'Single-leg calf hold', tendon: 'Achilles', img: 'Standing_Dumbbell_Calf_Raise/1.jpg', sides: true,
    how: ['Stand on one foot on the edge of a step, a hand on the wall for balance.', 'Rise onto the ball of the foot, then lower halfway and hold there.', 'Keep the knee straight and the ankle still.'] },
  { id: 'hang', name: 'Dead hang', tendon: 'Elbows, forearms and fingers', img: 'Pullups/0.jpg',
    how: ['Hang from a solid bar, hands shoulder-width, arms straight.', 'Pull the shoulders slightly down, away from the ears.', 'Too hard? Keep your feet on a box and take part of your weight.'] },
  { id: 'push', name: 'Wall press', tendon: 'Shoulders, chest and triceps', img: 'Incline_Push-Up/0.jpg',
    how: ['Hands on a wall or a door frame, arms half bent, like the middle of a push-up.', 'Push as hard as you can without moving: the wall does not move, you do not move.', 'Body straight, abs tight, keep breathing.'] },
  { id: 'bridge', name: 'Single-leg bridge hold', tendon: 'Hamstrings and glutes', img: 'Single_Leg_Glute_Bridge/1.jpg', sides: true,
    how: ['Lie on your back, one foot flat on the floor, the other leg straight in the air.', 'Push through the heel and lift the hips until the body is straight from knee to shoulder.', 'Hold the hips level.'] },
]
// Difficulty: longer holds, then added load. Circuit, so the short rest falls on a different tendon each time.
export const TENDON_LEVELS = {
  1: { hold: 30, rounds: 2, load: 'Bodyweight only, effort hard but clean.' },
  2: { hold: 45, rounds: 2, load: 'Bodyweight, longer holds.' },
  3: { hold: 45, rounds: 2, load: 'Add load: a backpack with books (wall sit, calf), a weight on the hips (bridge), a slow pull-up start (hang).' },
}
export const TENDON_REST = 20 // seconds

// Player steps for a tendon session: every round goes through all holds, one-sided holds once per side.
export function tendonSteps(level) {
  const { hold, rounds } = TENDON_LEVELS[level] ?? TENDON_LEVELS[1]
  const round = TENDON_HOLDS.flatMap(h => h.sides ? [{ h, side: 'Left side' }, { h, side: 'Right side' }] : [{ h }])
  return Array.from({ length: rounds }, () => round).flat().map(s => ({ ...s, hold }))
}
