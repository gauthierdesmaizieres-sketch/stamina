import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MUSCLE_MAP, bodyData, filterExercises, progression, lastSets, muscleFromSlug, suggest, stretchSession, stretchSteps, STRETCH_ZONES, HOLD, REST, TENDON_HOLDS, TENDON_LEVELS, TENDON_REST, tendonSteps } from './lib.js'

const exercises = JSON.parse(readFileSync(new URL('./data/exercises.json', import.meta.url)))

test('every muscle in the dataset is mapped', () => {
  const used = new Set(exercises.flatMap(e => [...e.primaryMuscles, ...e.secondaryMuscles]))
  for (const m of used) assert.ok(MUSCLE_MAP[m], m)
})

test('filter by muscle, equipment and text', () => {
  const r = filterExercises(exercises, { q: 'bench', muscle: 'chest', equipment: 'barbell' })
  assert.ok(r.length > 0)
  assert.ok(r.every(e => e.primaryMuscles.includes('chest') && e.equipment === 'barbell' && /bench/i.test(e.name)))
})

test('body data keeps secondary out of primary', () => {
  const [p, s] = bodyData(['lats', 'middle back'], ['middle back', 'biceps'])
  assert.deepEqual(p.muscles, ['upper-back'])
  assert.deepEqual(s.muscles, ['biceps'])
  assert.equal(muscleFromSlug('upper-back'), 'lats')
})

test('progression and last sets', () => {
  const sessions = [
    { date: '2026-02-01', entries: [{ exId: 'a', sets: [{ reps: 5, weight: 60 }, { reps: 5, weight: 65 }] }] },
    { date: '2026-01-01', entries: [{ exId: 'a', sets: [{ reps: 5, weight: 50 }] }] },
    { date: '2026-03-01', entries: [{ exId: 'b', sets: [{ reps: 5, weight: 10 }] }] },
  ]
  assert.deepEqual(progression(sessions, 'a'), { unit: 'kg', points: [{ date: '2026-01-01', value: 50 }, { date: '2026-02-01', value: 65 }] })
  assert.deepEqual(progression([{ date: '2026-01-01', entries: [{ exId: 'p', sets: [{ reps: 8, weight: 0 }, { reps: 6, weight: 0 }] }] }], 'p'),
    { unit: 'reps', points: [{ date: '2026-01-01', value: 8 }] })
  assert.equal(lastSets(sessions, 'a')[1].weight, 65)
  assert.equal(lastSets(sessions, 'z'), undefined)
})

test('gym filter keeps bodyweight and no-equipment exercises', () => {
  const r = filterExercises(exercises, {}, ['dumbbell'])
  assert.ok(r.length > 0)
  assert.ok(r.every(e => !e.equipment || ['dumbbell', 'body only'].includes(e.equipment)))
  assert.equal(filterExercises(exercises, {}, []).length, exercises.length)
})

test('suggest: double progression', () => {
  assert.equal(suggest(undefined, 10), null)
  assert.deepEqual(suggest([{ reps: 10, weight: 60 }, { reps: 10, weight: 60 }], 10), { weight: 62.5, reps: 10, up: 'weight' })
  assert.deepEqual(suggest([{ reps: 10, weight: 60 }, { reps: 8, weight: 60 }], 10), { weight: 60, reps: 10, up: null })
  assert.deepEqual(suggest([{ reps: 12, weight: 0 }, { reps: 10, weight: 0 }], 10), { weight: 0, reps: 13, up: 'reps' })
})

test('stretch sessions: right zone, level cap, length', () => {
  for (const zone of Object.keys(STRETCH_ZONES)) {
    const s = stretchSession(exercises, zone, 1)
    assert.ok(s.length > 0, zone)
    assert.ok(s.every(e => e.category === 'stretching' && e.level === 'beginner'), zone)
    assert.ok(s.every(e => e.primaryMuscles.some(m => STRETCH_ZONES[zone].includes(m))), zone)
  }
  const full = stretchSession(exercises, 'full', 3)
  const secs = stretchSteps(full).length * (HOLD + REST)
  assert.ok(secs > 480 && secs <= 600, secs)
  assert.ok(stretchSteps(stretchSession(exercises, 'hips', 1)).length * (HOLD + REST) <= 300)
  assert.equal(new Set(full).size, full.length)
  assert.equal(stretchSession(exercises, 'hamstrings', 3)[0].level, 'expert')
  const roller = stretchSession(exercises, 'roller', 1)
  assert.ok(roller.length >= 7 && stretchSteps(roller).length * (HOLD + REST) <= 600)
  assert.ok(roller.every(e => e.equipment === 'foam roll'))
})

test('tendon sessions: every hold each round, both sides, longer holds by level', () => {
  const one = tendonSteps(1), three = tendonSteps(3)
  const perRound = TENDON_HOLDS.reduce((n, h) => n + (h.sides ? 2 : 1), 0)
  assert.equal(one.length, perRound * TENDON_LEVELS[1].rounds)
  assert.equal(one.filter(s => s.h.id === 'calf').length, 2 * TENDON_LEVELS[1].rounds)
  assert.ok(one.every(s => s.hold === 30) && three.every(s => s.hold === 45))
  assert.deepEqual(tendonSteps(9), one)
  const min = one.length * (30 + TENDON_REST) / 60
  assert.ok(min >= 8 && min <= 16, `level 1 lasts ${min} min`)
})
