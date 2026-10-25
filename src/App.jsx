import { useCallback, useEffect, useMemo, useState } from 'react'
import Model from 'react-body-highlighter'
import exercises from './data/exercises.json'
import { MUSCLES, IMG_BASE, bodyData, muscleFromSlug, filterExercises, progression, lastSets, suggest, WEIGHT_STEP, stretchSession, stretchSteps, twoSided, HOLD, REST, TENDON_HOLDS, TENDON_LEVELS, TENDON_REST, tendonSteps, planWeek } from './lib.js'

const byId = new Map(exercises.map(e => [e.id, e]))
const EQUIPMENT = [...new Set(exercises.map(e => e.equipment).filter(Boolean))].sort()
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
const today = () => new Date().toISOString().slice(0, 10)
// Manga redraws live in public/manga (tools/manga/generate.py); fall back to the original photo when one is missing.
const photo = path => !path ? {} : ({  // a few exercises (Kettlebell_Halo, ...) have no photo at all
  src: `./manga/${path.replace(/\.\w+$/, '.webp')}`,
  onError: e => { if (!e.currentTarget.src.startsWith(IMG_BASE)) e.currentTarget.src = IMG_BASE + path },
})

function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? initial } catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue]
}

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => { setHash(location.hash); window.scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent)
}

export default function App() {
  const [programs, setPrograms] = useStored('programs', [])
  const [sessions, setSessions] = useStored('sessions', [])
  const [gym, setGym] = useStored('gym', [])
  const [tendonDays, setTendonDays] = useStored('tendonDays', [])
  const [tendonTests, setTendonTests] = useStored('tendonTests', [])
  const [flexDays, setFlexDays] = useStored('flexDays', [])
  const [page, id] = useHash()
  const store = { programs, setPrograms, sessions, setSessions, gym }

  let view
  if (page === 'exercise' && byId.has(id)) view = <ExerciseDetail ex={byId.get(id)} {...store} />
  else if (page === 'programs' && id) view = <ProgramEdit id={id} {...store} />
  else if (page === 'programs') view = <Programs {...store} />
  else if (page === 'workout') view = <Workout id={id} {...store} />
  else if (page === 'history') view = <History {...store} />
  else if (page === 'progress') view = <Progress sessions={sessions} />
  else if (page === 'week') view = <Week sessions={sessions} tendonDays={tendonDays} flexDays={flexDays} />
  else if (page === 'flex' && id) view = <FlexSession zone={id} setFlexDays={setFlexDays} />
  else if (page === 'flex') view = <Flex />
  else if (page === 'tendons' && id === 'session') view = <TendonSession setTendonDays={setTendonDays} />
  else if (page === 'tendons' && id === 'test') view = <WallTest tests={tendonTests} setTests={setTendonTests} />
  else if (page === 'tendons') view = <Tendons tendonDays={tendonDays} tests={tendonTests} />
  else if (page === 'gym') view = <Gym gym={gym} setGym={setGym} />
  else view = <ExerciseList gym={gym} />

  const tab = page === 'workout' ? 'programs' : ['exercise', 'gym', ''].includes(page ?? '') ? '' : page
  return (
    <>
      <header className="top">
        <a href="#/" className="brand">STAMINA</a>
        <nav>
          <a href="#/" className={tab === '' ? 'on' : ''}>Exercises</a>
          <a href="#/week" className={tab === 'week' ? 'on' : ''}>Week</a>
          <a href="#/programs" className={tab === 'programs' ? 'on' : ''}>Programs</a>
          <a href="#/flex" className={tab === 'flex' ? 'on' : ''}>Flexibility</a>
          <a href="#/tendons" className={tab === 'tendons' ? 'on' : ''}>Tendons</a>
          <a href="#/progress" className={tab === 'progress' ? 'on' : ''}>Progress</a>
          <a href="#/history" className={tab === 'history' ? 'on' : ''}>History</a>
        </nav>
      </header>
      <main>{view}</main>
      <footer>Exercise data: <a href="https://github.com/yuhonas/free-exercise-db">free-exercise-db</a> (public domain)</footer>
    </>
  )
}

function BodyMap({ primary, secondary, onClick }) {
  const data = bodyData(primary, secondary)
  const colors = ['#8fa832', '#d4ff3a', '#d4ff3a']
  return (
    <div className="bodymap">
      {['anterior', 'posterior'].map(type => (
        <Model key={type} type={type} data={data} highlightedColors={colors} bodyColor="#3a3d44"
          onClick={onClick && (m => onClick(m.muscle))} style={{ width: '100%' }} />
      ))}
    </div>
  )
}

const label = s => s.replace(/\b\w/g, c => c.toUpperCase())

function ExerciseList({ gym }) {
  const [filters, setFilters] = useStored('filters', { q: '', muscle: '', equipment: '' })
  const results = useMemo(() => filterExercises(exercises, filters, gym), [filters, gym])
  const set = patch => setFilters({ ...filters, ...patch })

  return (
    <div className="split">
      <aside className="panel">
        <input type="search" placeholder="Search exercises…" value={filters.q} onChange={e => set({ q: e.target.value })} aria-label="Search" />
        <select value={filters.muscle} onChange={e => set({ muscle: e.target.value })} aria-label="Muscle">
          <option value="">All muscles</option>
          {MUSCLES.map(m => <option key={m} value={m}>{label(m)}</option>)}
        </select>
        <select value={filters.equipment} onChange={e => set({ equipment: e.target.value })} aria-label="Equipment">
          <option value="">All equipment</option>
          {EQUIPMENT.map(m => <option key={m} value={m}>{label(m)}</option>)}
        </select>
        <a href="#/gym" className="gym-link">{gym.length ? `My gym · ${gym.length} equipment type${gym.length > 1 ? "s" : ""} · edit` : 'Set up my gym equipment →'}</a>
        <p className="hint">Tap a muscle to filter</p>
        <BodyMap primary={filters.muscle ? [filters.muscle] : []}
          onClick={slug => { const m = muscleFromSlug(slug); set({ muscle: m === filters.muscle ? '' : m }) }} />
      </aside>
      <section>
        <p className="count">{results.length} exercises</p>
        <ul className="grid">
          {results.map(e => (
            <li key={e.id}>
              <a href={`#/exercise/${e.id}`} className="card">
                <img {...photo(e.images[0])} alt="" loading="lazy" />
                <strong>{e.name}</strong>
                <span>{e.primaryMuscles.map(label).join(', ')} · {e.equipment ?? 'none'}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function ExerciseDetail({ ex, programs, setPrograms, sessions }) {
  const [target, setTarget] = useState(programs[0]?.id ?? '')
  const [added, setAdded] = useState('')
  const { unit, points } = progression(sessions, ex.id)

  function addToProgram() {
    let pid = target
    if (!pid) {
      pid = newId()
      setPrograms([...programs, { id: pid, name: 'My program', items: [{ exId: ex.id, sets: 3, reps: 10 }] }])
    } else {
      setPrograms(programs.map(p => p.id === pid ? { ...p, items: [...p.items, { exId: ex.id, sets: 3, reps: 10 }] } : p))
    }
    setTarget(pid)
    setAdded(pid)
  }

  return (
    <article className="detail">
      <a href="#/" className="back">← Exercises</a>
      <h1>{ex.name}</h1>
      <p className="tags">{[ex.level, ex.category, ex.equipment, ex.mechanic, ex.force].filter(Boolean).map(t => <span key={t}>{t}</span>)}</p>
      <div className="split">
        <div>
          <div className="photos">{ex.images.map(i => <img key={i} {...photo(i)} alt={ex.name} />)}</div>
          <h2>Instructions</h2>
          <ol>{ex.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
        <aside className="panel">
          <BodyMap primary={ex.primaryMuscles} secondary={ex.secondaryMuscles} />
          <p><i className="dot primary" /> Primary: {ex.primaryMuscles.map(label).join(', ')}</p>
          {ex.secondaryMuscles.length > 0 && <p><i className="dot secondary" /> Secondary: {ex.secondaryMuscles.map(label).join(', ')}</p>}
          <div className="row">
            <select value={target} onChange={e => setTarget(e.target.value)} aria-label="Program">
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="">+ New program</option>
            </select>
            <button onClick={addToProgram}>Add</button>
          </div>
          {added && <p className="ok">Added. <a href={`#/programs/${added}`}>Open program →</a></p>}
          {points.length > 0 && <><h2>Progress</h2><Chart points={points} unit={unit} /></>}
        </aside>
      </div>
    </article>
  )
}

function Chart({ points, unit }) {
  const w = 300, h = 120, pad = 24
  const ws = points.map(p => p.value)
  const min = Math.min(...ws), max = Math.max(...ws)
  const x = i => pad + (points.length === 1 ? (w - 2 * pad) / 2 : i * (w - 2 * pad) / (points.length - 1))
  const y = v => h - pad - (max === min ? (h - 2 * pad) / 2 : (v - min) * (h - 2 * pad) / (max - min))
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart" role="img" aria-label={`Best set from ${min} to ${max} ${unit}`}>
      <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="3"><title>{p.date}: {p.value} {unit}</title></circle>)}
      <text x={pad} y={h - 4}>{points[0].date}</text>
      <text x={w - pad} y={h - 4} textAnchor="end">{points.at(-1).date}</text>
      <text x={4} y={12}>{min === max ? max : `${min} → ${max}`} {unit}</text>
    </svg>
  )
}

function Programs({ programs, setPrograms }) {
  const [name, setName] = useState('')
  function create(e) {
    e.preventDefault()
    const id = newId()
    setPrograms([...programs, { id, name: name.trim() || 'My program', items: [] }])
    location.hash = `#/programs/${id}`
  }
  return (
    <div className="narrow">
      <h1>Programs</h1>
      <form onSubmit={create} className="row">
        <input placeholder="New program name" value={name} onChange={e => setName(e.target.value)} aria-label="Program name" />
        <button>Create</button>
      </form>
      {programs.length === 0 && <p className="hint">No program yet. Create one, or add exercises from an exercise page.</p>}
      <ul className="list">
        {programs.map(p => (
          <li key={p.id}>
            <a href={`#/programs/${p.id}`}><strong>{p.name}</strong><span>{p.items.length} exercises</span></a>
            <a href={`#/workout/${p.id}`} className="btn">Start</a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProgramEdit({ id, programs, setPrograms, gym }) {
  const program = programs.find(p => p.id === id)
  const [q, setQ] = useState('')
  if (!program) return <p className="narrow">Program not found. <a href="#/programs">Back</a></p>

  const update = patch => setPrograms(programs.map(p => p.id === id ? { ...p, ...patch } : p))
  const setItem = (i, patch) => update({ items: program.items.map((it, j) => j === i ? { ...it, ...patch } : it) })
  const move = (i, d) => {
    const items = [...program.items]
    ;[items[i], items[i + d]] = [items[i + d], items[i]]
    update({ items })
  }
  const matches = q.trim() ? filterExercises(exercises, { q }, gym).slice(0, 8) : []
  const muscles = program.items.map(it => byId.get(it.exId))

  return (
    <div className="split">
      <section>
        <a href="#/programs" className="back">← Programs</a>
        <input className="title" value={program.name} onChange={e => update({ name: e.target.value })} aria-label="Program name" />
        <ol className="items">
          {program.items.map((it, i) => (
            <li key={i}>
              <a href={`#/exercise/${it.exId}`}>{byId.get(it.exId)?.name ?? it.exId}</a>
              <label>Sets <input type="number" min="1" value={it.sets} onChange={e => setItem(i, { sets: +e.target.value })} /></label>
              <label>Reps <input type="number" min="1" value={it.reps} onChange={e => setItem(i, { reps: +e.target.value })} /></label>
              <span className="tools">
                <button className="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                <button className="ghost" disabled={i === program.items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                <button className="ghost" onClick={() => update({ items: program.items.filter((_, j) => j !== i) })} aria-label="Remove">✕</button>
              </span>
            </li>
          ))}
        </ol>
        <input type="search" placeholder="Add an exercise…" value={q} onChange={e => setQ(e.target.value)} aria-label="Add an exercise" />
        <ul className="matches">
          {matches.map(e => (
            <li key={e.id}><button className="ghost" onClick={() => { update({ items: [...program.items, { exId: e.id, sets: 3, reps: 10 }] }); setQ('') }}>
              + {e.name} <span>{e.primaryMuscles.map(label).join(', ')}</span></button></li>
          ))}
        </ul>
        <div className="row">
          <a href={`#/workout/${id}`} className="btn">Start workout</a>
          <button className="danger" onClick={() => {
            if (confirm(`Delete “${program.name}”?`)) { setPrograms(programs.filter(p => p.id !== id)); location.hash = '#/programs' }
          }}>Delete program</button>
        </div>
      </section>
      <aside className="panel">
        <h2>Muscles worked</h2>
        <BodyMap primary={muscles.flatMap(e => e?.primaryMuscles ?? [])} secondary={muscles.flatMap(e => e?.secondaryMuscles ?? [])} />
      </aside>
    </div>
  )
}

function Workout({ id, programs, sessions, setSessions }) {
  const program = programs.find(p => p.id === id)
  // The draft lives in localStorage so a refresh mid-workout loses nothing.
  const [draft, setDraft] = useStored('draft', null)
  const active = draft?.programId === id ? draft : null

  useEffect(() => {
    if (!program || active) return
    setDraft({
      programId: id, date: today(),
      entries: program.items.map(it => {
        const s = suggest(lastSets(sessions, it.exId), it.reps)
        return {
          exId: it.exId, hint: hint(s, it.reps), up: !!s?.up,
          sets: Array.from({ length: it.sets }, () => ({ reps: s?.reps ?? it.reps, weight: s?.weight || '', done: false })),
        }
      }),
    })
  }, [id, program, active])

  if (!program) return <p className="narrow">Program not found. <a href="#/programs">Back</a></p>
  if (!active) return null

  const setSet = (ei, si, patch) => setDraft({
    ...active, entries: active.entries.map((e, i) => i !== ei ? e : { ...e, sets: e.sets.map((s, j) => j === si ? { ...s, ...patch } : s) }),
  })
  const addSet = ei => setDraft({
    ...active, entries: active.entries.map((e, i) => i !== ei ? e : { ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { reps: 10, weight: '' }), done: false }] }),
  })

  function finish() {
    const entries = active.entries
      .map(e => ({ exId: e.exId, sets: e.sets.filter(s => s.done).map(({ reps, weight }) => ({ reps: +reps || 0, weight: +weight || 0 })) }))
      .filter(e => e.sets.length)
    if (!entries.length && !confirm('No set is ticked as done. Discard this workout?')) return
    if (entries.length) setSessions([...sessions, { id: newId(), programName: program.name, date: active.date, entries }])
    setDraft(null)
    location.hash = entries.length ? '#/history' : '#/programs'
  }

  return (
    <div className="narrow">
      <h1>{program.name}</h1>
      <label className="date">Date <input type="date" value={active.date} onChange={e => setDraft({ ...active, date: e.target.value })} /></label>
      {active.entries.map((e, ei) => (
        <section key={ei} className="exercise-log">
          <h2><a href={`#/exercise/${e.exId}`}>{byId.get(e.exId)?.name}</a></h2>
          {e.hint && <p className={e.up ? 'suggest up' : 'suggest'}>{e.hint}</p>}
          <table>
            <thead><tr><th>Set</th><th>Reps</th><th>kg</th><th>Done</th></tr></thead>
            <tbody>
              {e.sets.map((s, si) => (
                <tr key={si} className={s.done ? 'done' : ''}>
                  <td>{si + 1}</td>
                  <td><input type="number" min="0" inputMode="numeric" value={s.reps} onChange={x => setSet(ei, si, { reps: x.target.value })} aria-label="Reps" /></td>
                  <td><input type="number" min="0" step="0.5" inputMode="decimal" value={s.weight} onChange={x => setSet(ei, si, { weight: x.target.value })} aria-label="Weight in kg" /></td>
                  <td><input type="checkbox" checked={s.done} onChange={x => setSet(ei, si, { done: x.target.checked })} aria-label="Done" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="ghost" onClick={() => addSet(ei)}>+ Set</button>
        </section>
      ))}
      <div className="row">
        <button onClick={finish}>Finish workout</button>
        <button className="ghost" onClick={() => { if (confirm('Discard this workout?')) { setDraft(null); location.hash = '#/programs' } }}>Discard</button>
      </div>
    </div>
  )
}

function hint(s, target) {
  if (!s) return null
  if (s.up === 'weight') return `↑ ${s.weight} kg (+${WEIGHT_STEP}): every set reached ${target} reps last time.`
  if (s.up === 'reps') return `↑ ${s.reps} reps: every set reached the target last time.`
  return s.weight
    ? `Stay at ${s.weight} kg until every set reaches ${target} reps, then the weight goes up.`
    : `Aim for ${target} reps on every set, then the reps go up.`
}

function Progress({ sessions }) {
  const recentFirst = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  const ids = [...new Set(recentFirst.flatMap(s => s.entries.map(e => e.exId)))]
  return (
    <div className="narrow">
      <h1>Progress</h1>
      {ids.length === 0 && <p className="hint">Log a workout to see your progress here.</p>}
      <div className="charts">
        {ids.map(id => {
          const { unit, points } = progression(sessions, id)
          const first = points[0].value, last = points.at(-1).value, diff = +(last - first).toFixed(2)
          return (
            <section key={id} className="chart-card">
              <a href={`#/exercise/${id}`}>{byId.get(id)?.name ?? id}</a>
              <p className="big">{last} {unit} {diff !== 0 && <span className={diff > 0 ? 'up' : 'down'}>{diff > 0 ? '+' : ''}{diff} {unit}</span>}</p>
              <Chart points={points} unit={unit} />
              <p className="hint">{points.length} session{points.length > 1 ? 's' : ''} · best set per session</p>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function Gym({ gym, setGym }) {
  const toggle = eq => setGym(gym.includes(eq) ? gym.filter(x => x !== eq) : [...gym, eq])
  const count = filterExercises(exercises, {}, gym).length
  return (
    <div className="narrow">
      <a href="#/" className="back">← Exercises</a>
      <h1>My gym</h1>
      <p className="hint">Tick the equipment your gym has. Exercises that need anything else are hidden from the list and the program builder. Bodyweight exercises are always shown.</p>
      <div className="checks">
        {EQUIPMENT.filter(eq => eq !== 'body only').map(eq => (
          <label key={eq} className="check"><input type="checkbox" checked={gym.includes(eq)} onChange={() => toggle(eq)} /> {label(eq)}</label>
        ))}
      </div>
      <div className="row">
        <button className="ghost" onClick={() => setGym([])} disabled={!gym.length}>Show all exercises</button>
        <span className="hint">{count} exercises available</span>
      </div>
    </div>
  )
}

function History({ sessions, setSessions }) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <div className="narrow">
      <h1>History</h1>
      {sorted.length === 0 && <p className="hint">No workout logged yet. Start one from a program.</p>}
      <ul className="history">
        {sorted.map(s => (
          <li key={s.id}>
            <header>
              <strong>{s.date}</strong> <span>{s.programName}</span>
              <button className="ghost" onClick={() => confirm('Delete this workout?') && setSessions(sessions.filter(x => x.id !== s.id))} aria-label="Delete workout">✕</button>
            </header>
            <ul>
              {s.entries.map((e, i) => (
                <li key={i}><a href={`#/exercise/${e.exId}`}>{byId.get(e.exId)?.name ?? e.exId}</a>
                  <span>{e.sets.map(x => x.weight ? `${x.reps}×${x.weight}kg` : `${x.reps} reps`).join(' · ')}</span></li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}

const ZONE_LABELS = { full: 'Full body', hips: 'Hips', hamstrings: 'Hamstrings', legs: 'Quads & calves', back: 'Back', shoulders: 'Shoulders & chest', neck: 'Neck', roller: 'Foam roller' }
const Dots = ({ n }) => <span className="dots" aria-label={`Level ${n} of 3`}>{[1, 2, 3].map(i => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
const mins = list => Math.max(1, Math.round(stretchSteps(list).length * (HOLD + REST) / 60))

function Flex() {
  const [level, setLevel] = useStored('flexLevel', 1)
  return (
    <div className="soft narrow">
      <h1>Flexibility</h1>
      <div className="levels" role="radiogroup" aria-label="Difficulty">
        {[1, 2, 3].map(n => (
          <button key={n} role="radio" aria-checked={level === n} className={level === n ? 'on' : ''} onClick={() => setLevel(n)}>
            <Dots n={n} /> {['Beginner', 'Intermediate', 'Advanced'][n - 1]}
          </button>
        ))}
      </div>
      <ul className="zones">
        {Object.keys(ZONE_LABELS).map(z => {
          const list = stretchSession(exercises, z, level)
          return (
            <li key={z}><a href={`#/flex/${z}`} className={z === 'full' ? 'zone full' : 'zone'}>
              {list[0] && <img {...photo(list[0].images[0])} alt="" loading="lazy" />}
              <strong>{ZONE_LABELS[z]}</strong>
              <span>{list.length} stretches · ~{mins(list)} min</span>
            </a></li>
          )
        })}
      </ul>
    </div>
  )
}

function beep(ctx, freq = 880) {
  navigator.vibrate?.(150)
  if (!ctx) return
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.frequency.value = freq
  g.gain.setValueAtTime(0.2, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
  o.connect(g).connect(ctx.destination)
  o.start(); o.stop(ctx.currentTime + 0.3)
}

// Timed hold player shared by Flexibility and Tendons. steps: [{ key, name, img, side, how, hold }].
// run: null = not started; phase 'rest' shows the upcoming step before its hold.
function Player({ steps, rest, back, backLabel, holdLabel, intro, onDone }) {
  const [run, setRun] = useState(null)
  const [ctx, setCtx] = useState(null)

  useEffect(() => {
    if (!run || run.paused || run.done) return
    const t = setTimeout(() => {
      if (run.left > 1) return setRun({ ...run, left: run.left - 1 })
      if (run.phase === 'rest') { beep(ctx); return setRun({ ...run, phase: 'hold', left: steps[run.i].hold }) }
      beep(ctx, 660)
      if (run.i + 1 < steps.length) return setRun({ ...run, i: run.i + 1, phase: 'rest', left: rest })
      onDone?.()
      setRun({ ...run, done: true })
    }, 1000)
    return () => clearTimeout(t)
  }, [run, ctx, steps, rest, onDone])

  function start() {
    // Audio must be created from a user gesture on mobile.
    setCtx(c => c ?? new (window.AudioContext || window.webkitAudioContext)())
    setRun({ i: 0, phase: 'rest', left: rest, paused: false, done: false })
  }

  if (!run) return <>{intro}<button className="big" onClick={start}>Start</button></>

  if (run.done) return (
    <div className="player">
      <h1>Well done!</h1>
      <p className="hint">{steps.length} holds · ~{Math.round(steps.reduce((n, s) => n + s.hold + rest, 0) / 60)} min</p>
      <a href={back} className="btn big">{backLabel}</a>
    </div>
  )

  const { name, img, side, how } = steps[run.i], total = run.phase === 'hold' ? steps[run.i].hold : rest
  const r = 54, c = 2 * Math.PI * r
  return (
    <div className="player">
      <a href={back} className="back">← Quit</a>
      <p className="hint">{run.i + 1} / {steps.length} · {side && `${side} · `}{run.phase === 'rest' ? 'Get ready' : holdLabel}</p>
      <div className="illu"><img key={img} {...photo(img)} alt={name} /></div>
      <h2>{name}</h2>
      <svg viewBox="0 0 120 120" className={`ring ${run.phase}`} role="timer" aria-label={`${run.left} seconds left`}>
        <circle cx="60" cy="60" r={r} className="track" />
        <circle cx="60" cy="60" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - run.left / total)} />
        <text x="60" y="70" textAnchor="middle">{run.left}</text>
      </svg>
      <div className="row center">
        <button className="ghost" onClick={() => setRun({ ...run, paused: !run.paused })}>{run.paused ? 'Resume' : 'Pause'}</button>
        <button className="ghost" onClick={() => setRun({ ...run, left: 1 })}>Skip →</button>
      </div>
      <details><summary>How to</summary><ol>{how.map((t, i) => <li key={i}>{t}</li>)}</ol></details>
    </div>
  )
}

function FlexSession({ zone, setFlexDays }) {
  const [level] = useStored('flexLevel', 1)
  const list = useMemo(() => stretchSession(exercises, zone, level), [zone, level])
  const steps = useMemo(() => stretchSteps(list).map(({ ex, side }) =>
    ({ key: ex.id, name: ex.name, img: ex.images[0], side, how: ex.instructions, hold: HOLD })), [list])
  const done = useCallback(() => setFlexDays(d => d.at(-1) === today() ? d : [...d, today()]), [setFlexDays])
  if (!ZONE_LABELS[zone] || !list.length) return <p className="soft narrow">No stretches here. <a href="#/flex">Back</a></p>
  return (
    <div className="soft narrow">
      <Player steps={steps} rest={REST} back="#/flex" backLabel="Back to zones" holdLabel={zone === 'roller' ? 'Roll slowly' : 'Hold'} onDone={done} intro={<>
        <a href="#/flex" className="back">← Flexibility</a>
        <h1>{ZONE_LABELS[zone]}</h1>
        <p className="hint"><Dots n={level} /> {list.length} stretches · {HOLD}s each · ~{mins(list)} min</p>
        <ol className="stretch-list">
          {list.map(e => <li key={e.id}><img {...photo(e.images[0])} alt="" loading="lazy" /><span>{e.name}{twoSided(e) && <small> · both sides</small>}</span></li>)}
        </ol>
      </>} />
    </div>
  )
}

const tendonMins = level => Math.round(tendonSteps(level).reduce((n, s) => n + s.hold + TENDON_REST, 0) / 60)
const daysSince = date => Math.round((new Date(today()) - new Date(date)) / 864e5)

function Tendons({ tendonDays, tests }) {
  const [level, setLevel] = useStored('tendonLevel', 1)
  const last = tendonDays.at(-1), since = last && daysSince(last)
  return (
    <div className="tendon narrow">
      <h1>Tendons</h1>
      <p className="hint">Long, heavy holds make tendons stiffer and stronger; short pulses do not. 2–3 sessions a week, never two days in a row.</p>
      <div className="levels" role="radiogroup" aria-label="Difficulty">
        {[1, 2, 3].map(n => (
          <button key={n} role="radio" aria-checked={level === n} className={level === n ? 'on' : ''} onClick={() => setLevel(n)}>
            <Dots n={n} /> {TENDON_LEVELS[n].hold}s{n === 3 ? ' + load' : ''}
          </button>
        ))}
      </div>
      <a href="#/tendons/session" className="btn big">Start session · ~{tendonMins(level)} min</a>
      {last && <p className={since < 1 ? 'warn' : 'hint'}>Last session: {last}{since < 1 ? ' — rest at least one day before the next one.' : ''}</p>}
      <ul className="stretch-list">
        {TENDON_HOLDS.map(h => <li key={h.id}><img {...photo(h.img)} alt="" loading="lazy" /><span><strong>{h.name}</strong><small> · {h.tendon}{h.sides ? ' · each side' : ''}</small></span></li>)}
      </ul>
      <section className="chart-card">
        <strong>Wall-sit test</strong>
        <p className="hint">Hold a wall sit as long as you can, once every 2–4 weeks, to see your tendons progress.</p>
        {tests.length > 0 && <Chart points={tests.map(t => ({ date: t.date, value: t.seconds }))} unit="s" />}
        <a href="#/tendons/test" className="btn">Take the test</a>
      </section>
      <p className="hint">Breathe through every hold: holds raise blood pressure. Stop on sharp joint pain. With high blood pressure, a heart condition or a joint injury, ask a doctor first. Use a solid bar and a solid wall.</p>
    </div>
  )
}

function TendonSession({ setTendonDays }) {
  const [level] = useStored('tendonLevel', 1)
  const { load } = TENDON_LEVELS[level] ?? TENDON_LEVELS[1]
  const steps = useMemo(() => tendonSteps(level).map(({ h, side, hold }) =>
    ({ key: h.id, name: h.name, img: h.img, side, how: [...h.how, load], hold })), [level, load])
  const done = useCallback(() => setTendonDays(d => d.at(-1) === today() ? d : [...d, today()]), [setTendonDays])
  return (
    <div className="tendon narrow">
      <Player steps={steps} rest={TENDON_REST} back="#/tendons" backLabel="Back to tendons" holdLabel="Hold hard" onDone={done} intro={<>
        <a href="#/tendons" className="back">← Tendons</a>
        <h1>Tendon session</h1>
        <p className="hint"><Dots n={level} /> {steps.length} holds · {steps[0].hold}s each · ~{tendonMins(level)} min · {load}</p>
      </>} />
    </div>
  )
}

function WallTest({ tests, setTests }) {
  const [start, setStart] = useState(null)
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!start) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [start])
  const secs = start ? Math.floor((now - start) / 1000) : 0
  function stop() {
    setTests([...tests, { date: today(), seconds: secs }])
    location.hash = '#/tendons'
  }
  return (
    <div className="tendon narrow player">
      <a href="#/tendons" className="back">← Tendons</a>
      <h1>Wall-sit test</h1>
      <p className="hint">Knees at 90°, back flat on the wall. Start the clock, hold as long as you can with good form, then stop.</p>
      <p className="clock" role="timer">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</p>
      {start
        ? <button className="big" onClick={stop} disabled={secs < 1}>Stop and save</button>
        : <button className="big" onClick={() => { setStart(Date.now()); setNow(Date.now()) }}>Start</button>}
      {tests.length > 0 && <p className="hint">Best so far: {Math.max(...tests.map(t => t.seconds))} s</p>}
    </div>
  )
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function Week({ sessions, tendonDays, flexDays }) {
  const days = planWeek(today(), { lifts: sessions.map(s => s.date), tendons: tendonDays, flex: flexDays })
  const mark = done => done ? '✓ ' : ''
  return (
    <div className="narrow">
      <h1>This week</h1>
      <p className="hint">Lifting, running, tendons and stretching without overload. Missed a session? It moves to a free day: never legs the day before a run, tendons never two days in a row.</p>
      <ul className="week">
        {days.map((d, i) => (
          <li key={d.date} className={d.date === today() ? 'today' : d.past ? 'past' : ''}>
            <strong>{DAY_NAMES[i]} <small>{d.date.slice(5)}</small></strong>
            {d.lift && <a href="#/programs" className={d.lift.done ? 'done' : ''}>{mark(d.lift.done)}{d.lift.name}</a>}
            {d.run && !d.past && <span>{d.run}</span>}
            {d.tendons && <a href="#/tendons/session" className={d.tendons === 'done' ? 'done' : ''}>{mark(d.tendons === 'done')}Tendons · 10 min{d.tendons === 'todo' && (d.lift || d.run) ? ', before' : ''}</a>}
            {(!d.past || d.flex.done) && <a href={`#/flex/${d.flex.zone}`} className={d.flex.done ? 'done' : ''}>{mark(d.flex.done)}Stretch · {ZONE_LABELS[d.flex.zone]}{d.lift || d.run ? ', after' : ''}</a>}
            {!d.past && !d.lift && !d.run && <span>Rest</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
