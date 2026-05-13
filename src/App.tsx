import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type Turnstile = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
      theme?: 'light' | 'dark' | 'auto'
      size?: 'normal' | 'compact' | 'flexible'
    },
  ) => string
  reset: (widgetId: string) => void
}

type BeatmapMetadata = {
  beatmap_id: number
  beatmapset_id: number | null
  artist: string | null
  title: string | null
  creator: string | null
  creator_id?: number | null
  version: string | null
  status: string | null
  stars: number | null
  ar: number | null
  cs: number | null
  accuracy: number | null
  drain: number | null
  bpm: number | null
  total_length: number | null
  url: string | null
  score?: number
}

type RecommendResponse = {
  query: {
    beatmap_id: number
    cache: string
    metadata: BeatmapMetadata
  }
  count: number
  results: BeatmapMetadata[]
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

const defaultFilters = {
  topK: '20',
  minSr: '',
  maxSr: '',
  minAr: '',
  maxAr: '',
  minCs: '',
  maxCs: '',
  minOd: '',
  maxOd: '',
  minHp: '',
  maxHp: '',
  status: '',
  excludeSameSet: true,
}

function App() {
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)
  const [beatmapInput, setBeatmapInput] = useState('')
  const [topK, setTopK] = useState(defaultFilters.topK)
  const [minSr, setMinSr] = useState(defaultFilters.minSr)
  const [maxSr, setMaxSr] = useState(defaultFilters.maxSr)
  const [minAr, setMinAr] = useState(defaultFilters.minAr)
  const [maxAr, setMaxAr] = useState(defaultFilters.maxAr)
  const [minCs, setMinCs] = useState(defaultFilters.minCs)
  const [maxCs, setMaxCs] = useState(defaultFilters.maxCs)
  const [minOd, setMinOd] = useState(defaultFilters.minOd)
  const [maxOd, setMaxOd] = useState(defaultFilters.maxOd)
  const [minHp, setMinHp] = useState(defaultFilters.minHp)
  const [maxHp, setMaxHp] = useState(defaultFilters.maxHp)
  const [status, setStatus] = useState(defaultFilters.status)
  const [excludeSameSet, setExcludeSameSet] = useState(defaultFilters.excludeSameSet)
  const [apiKey, setApiKey] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileStatus, setTurnstileStatus] = useState(
    turnstileSiteKey ? 'waiting' : 'disabled',
  )
  const [isLoading, setIsLoading] = useState(false)
  const [httpStatus, setHttpStatus] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<RecommendResponse | null>(null)
  const [copiedBeatmapId, setCopiedBeatmapId] = useState<number | null>(null)

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileRef.current || widgetIdRef.current) {
      return
    }

    const renderTurnstile = () => {
      if (!window.turnstile || !turnstileRef.current || widgetIdRef.current) {
        return false
      }

      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey,
        theme: 'dark',
        size: 'compact',
        callback: (token) => {
          setTurnstileToken(token)
          setTurnstileStatus('ready')
        },
        'expired-callback': () => {
          setTurnstileToken('')
          setTurnstileStatus('expired')
        },
        'error-callback': () => {
          setTurnstileToken('')
          setTurnstileStatus('error')
        },
      })
      return true
    }

    if (renderTurnstile()) {
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = renderTurnstile
    document.head.appendChild(script)

    return () => {
      script.onload = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  async function submitRecommend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const beatmapId = parseBeatmapId(beatmapInput)
    if (!beatmapId) {
      setError('Enter a beatmap ID or a beatmap link ending in an ID.')
      setHttpStatus(null)
      setResponse(null)
      return
    }

    setIsLoading(true)
    setError('')
    setResponse(null)
    setHttpStatus(null)

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    if (apiKey.trim()) {
      headers['X-API-Key'] = apiKey.trim()
    } else if (turnstileToken) {
      headers['X-Turnstile-Token'] = turnstileToken
    }

    const filters = {
      min_sr: numericOrNull(minSr),
      max_sr: numericOrNull(maxSr),
      min_ar: numericOrNull(minAr),
      max_ar: numericOrNull(maxAr),
      min_cs: numericOrNull(minCs),
      max_cs: numericOrNull(maxCs),
      min_accuracy: numericOrNull(minOd),
      max_accuracy: numericOrNull(maxOd),
      min_drain: numericOrNull(minHp),
      max_drain: numericOrNull(maxHp),
      status: status.trim() || null,
      exclude_same_set: excludeSameSet,
    }

    try {
      const result = await fetch(`${apiUrl}/recommend`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          beatmap_id: beatmapId,
          top_k: Number(topK),
          filters,
        }),
      })
      const text = await result.text()
      const data = text ? JSON.parse(text) : null

      setHttpStatus(result.status)

      if (!result.ok) {
        setError(data?.detail ?? `Request failed with ${result.status}`)
        return
      }

      setResponse(data as RecommendResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setIsLoading(false)
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
        setTurnstileToken('')
        setTurnstileStatus('waiting')
      }
    }
  }

  function resetForm() {
    setBeatmapInput('')
    setTopK(defaultFilters.topK)
    setMinSr(defaultFilters.minSr)
    setMaxSr(defaultFilters.maxSr)
    setMinAr(defaultFilters.minAr)
    setMaxAr(defaultFilters.maxAr)
    setMinCs(defaultFilters.minCs)
    setMaxCs(defaultFilters.maxCs)
    setMinOd(defaultFilters.minOd)
    setMaxOd(defaultFilters.maxOd)
    setMinHp(defaultFilters.minHp)
    setMaxHp(defaultFilters.maxHp)
    setStatus(defaultFilters.status)
    setExcludeSameSet(defaultFilters.excludeSameSet)
    setError('')
    setHttpStatus(null)
    setResponse(null)
    setCopiedBeatmapId(null)
  }

  async function copyBeatmapId(beatmapId: number) {
    await copyText(String(beatmapId))
    setCopiedBeatmapId(beatmapId)
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current)
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedBeatmapId(null)
    }, 1400)
  }

  const turnstileNeeded = Boolean(turnstileSiteKey && !apiKey.trim())
  const submitDisabled = isLoading || (turnstileNeeded && !turnstileToken)

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">bobert</p>
        <h1>osu! beatmap recommendations</h1>
        <p className="hero-copy">
          Find maps that feel structurally similar, tuned with osu! pink and a quiet
          close-to-black workspace.
        </p>
      </section>

      <form className="control-panel" onSubmit={submitRecommend}>
        <div className="primary-controls">
          <label className="field beatmap-field">
            <span>Beatmap</span>
            <input
              required
              value={beatmapInput}
              onChange={(event) => setBeatmapInput(event.target.value)}
              placeholder="1872396 or https://osu.ppy.sh/beatmaps/1872396"
            />
          </label>

          <label className="field small-field">
            <span>Rows</span>
            <input
              required
              min="1"
              max="50"
              type="number"
              value={topK}
              onChange={(event) => setTopK(event.target.value)}
            />
          </label>

          <button className="primary-button" type="submit" disabled={submitDisabled}>
            {isLoading ? 'Searching' : 'Recommend'}
          </button>
          <button className="ghost-button" type="button" onClick={resetForm}>
            Reset
          </button>
        </div>

        <div className="filter-grid">
          <RangeFields label="SR" min={minSr} max={maxSr} setMin={setMinSr} setMax={setMaxSr} />
          <RangeFields label="AR" min={minAr} max={maxAr} setMin={setMinAr} setMax={setMaxAr} />
          <RangeFields label="CS" min={minCs} max={maxCs} setMin={setMinCs} setMax={setMaxCs} />
          <RangeFields label="OD" min={minOd} max={maxOd} setMin={setMinOd} setMax={setMaxOd} />
          <RangeFields label="HP" min={minHp} max={maxHp} setMin={setMinHp} setMax={setMaxHp} />

          <label className="field status-field">
            <span>Status</span>
            <input
              maxLength={32}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              placeholder="ranked, loved, 1, 3"
            />
          </label>

          <label className="field api-key-field">
            <span>API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="optional"
            />
          </label>

          <label className="check-field">
            <input
              type="checkbox"
              checked={excludeSameSet}
              onChange={(event) => setExcludeSameSet(event.target.checked)}
            />
            <span>Exclude same set</span>
          </label>

          {turnstileNeeded ? (
            <div className="turnstile-block">
              <div ref={turnstileRef} />
              <span>Turnstile {turnstileStatus}</span>
            </div>
          ) : null}
        </div>
      </form>

      <section className="results-panel">
        <div className="results-heading">
          <div>
            <p className="eyebrow">results</p>
            <h2>{response ? `${response.count} suggestions` : 'Ready when you are'}</h2>
          </div>
          <div className="status-line">
            {httpStatus ? <span>HTTP {httpStatus}</span> : null}
            {response ? <span>cache {response.query.cache}</span> : null}
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {response ? (
          <>
            <BeatmapSummary beatmap={response.query.metadata} label="Source map" />
            <div className="result-list">
              {response.results.map((beatmap) => (
                <BeatmapRow
                  key={beatmap.beatmap_id}
                  beatmap={beatmap}
                  copied={copiedBeatmapId === beatmap.beatmap_id}
                  onCopy={copyBeatmapId}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <span>Paste a beatmap ID or link, tune the filters, then search.</span>
          </div>
        )}
      </section>
    </main>
  )
}

type RangeFieldsProps = {
  label: string
  min: string
  max: string
  setMin: (value: string) => void
  setMax: (value: string) => void
}

function RangeFields({ label, min, max, setMin, setMax }: RangeFieldsProps) {
  return (
    <div className="range-field">
      <span>{label}</span>
      <input
        min="0"
        step="0.01"
        type="number"
        value={min}
        onChange={(event) => setMin(event.target.value)}
        placeholder="min"
        aria-label={`${label} minimum`}
      />
      <input
        min="0"
        step="0.01"
        type="number"
        value={max}
        onChange={(event) => setMax(event.target.value)}
        placeholder="max"
        aria-label={`${label} maximum`}
      />
    </div>
  )
}

type BeatmapSummaryProps = {
  beatmap: BeatmapMetadata
  label: string
}

function BeatmapSummary({ beatmap, label }: BeatmapSummaryProps) {
  return (
    <article className="source-card">
      <span>{label}</span>
      <a href={beatmapUrl(beatmap)} target="_blank" rel="noreferrer">
        {displayArtist(beatmap)} - {displayTitle(beatmap)}
      </a>
      <small>{beatmap.version ?? 'Unknown difficulty'}</small>
    </article>
  )
}

type BeatmapRowProps = {
  beatmap: BeatmapMetadata
  copied: boolean
  onCopy: (beatmapId: number) => Promise<void>
}

function BeatmapRow({ beatmap, copied, onCopy }: BeatmapRowProps) {
  return (
    <article className="beatmap-row">
      <a className="cover-link" href={beatmapUrl(beatmap)} target="_blank" rel="noreferrer">
        {beatmap.beatmapset_id ? (
          <img
            src={coverUrl(beatmap.beatmapset_id)}
            srcSet={`${coverUrl(beatmap.beatmapset_id)} 1x, ${coverUrl(
              beatmap.beatmapset_id,
              true,
            )} 2x`}
            alt=""
          />
        ) : (
          <span className="cover-placeholder">osu!</span>
        )}
      </a>

      <div className="map-main">
        <div className="title-line">
          <a className="map-title" href={beatmapUrl(beatmap)} target="_blank" rel="noreferrer">
            {displayArtist(beatmap)} - {displayTitle(beatmap)}
          </a>
          {copied ? <span className="copied-pill">Copied ID</span> : null}
        </div>
        <div className="version-line">{beatmap.version ?? 'Unknown difficulty'}</div>
        <div className="meta-line">
          <CreatorLink beatmap={beatmap} />
          <span>{statusLabel(beatmap.status)}</span>
          {beatmap.score !== undefined ? <span>{beatmap.score.toFixed(3)} match</span> : null}
        </div>
      </div>

      <div className="stat-grid">
        <Stat label="Star" value={formatNumber(beatmap.stars, 2)} />
        <Stat label="BPM" value={formatNumber(beatmap.bpm, 0)} />
        <Stat label="Len" value={formatLength(beatmap.total_length)} />
        <Stat label="AR" value={formatNumber(beatmap.ar, 1)} />
        <Stat label="CS" value={formatNumber(beatmap.cs, 1)} />
        <Stat label="OD" value={formatNumber(beatmap.accuracy, 1)} />
        <Stat label="HP" value={formatNumber(beatmap.drain, 1)} />
      </div>

      <div className="row-actions">
        <button type="button" onClick={() => onCopy(beatmap.beatmap_id)}>
          Copy ID
        </button>
        <a href={`osu://b/${beatmap.beatmap_id}`}>Download</a>
      </div>
    </article>
  )
}

type StatProps = {
  label: string
  value: string
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="stat-cell">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function CreatorLink({ beatmap }: { beatmap: BeatmapMetadata }) {
  if (beatmap.creator_id) {
    return (
      <a href={`https://osu.ppy.sh/users/${beatmap.creator_id}`} target="_blank" rel="noreferrer">
        mapped by {beatmap.creator ?? beatmap.creator_id}
      </a>
    )
  }

  return <span>mapped by {beatmap.creator ?? 'unknown'}</span>
}

function parseBeatmapId(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/(\d+)\/?(?:[?#].*)?$/)
  if (!match) {
    return null
  }

  const id = Number(match[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function numericOrNull(value: string): number | null {
  return value === '' ? null : Number(value)
}

async function copyText(value: string) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function beatmapUrl(beatmap: BeatmapMetadata): string {
  return beatmap.url ?? `https://osu.ppy.sh/beatmaps/${beatmap.beatmap_id}`
}

function coverUrl(beatmapsetId: number, twoX = false): string {
  return `https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/list${twoX ? '@2x' : ''}.jpg`
}

function displayArtist(beatmap: BeatmapMetadata): string {
  return beatmap.artist ?? 'Unknown artist'
}

function displayTitle(beatmap: BeatmapMetadata): string {
  return beatmap.title ?? `Beatmap ${beatmap.beatmap_id}`
}

function formatNumber(value: number | null, digits: number): string {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  return value.toFixed(digits).replace(/\.0+$/, '')
}

function formatLength(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }

  const totalSeconds = Math.max(0, Math.round(value))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function statusLabel(value: string | null): string {
  const statuses: Record<string, string> = {
    '-2': 'graveyard',
    '-1': 'wip',
    '0': 'pending',
    '1': 'ranked',
    '2': 'approved',
    '3': 'qualified',
    '4': 'loved',
  }

  if (!value) {
    return 'unknown status'
  }

  return statuses[value] ?? value
}

export default App
