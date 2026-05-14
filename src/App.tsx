import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
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
      appearance?: 'always' | 'execute' | 'interaction-only'
      execution?: 'render' | 'execute'
    },
  ) => string
  reset: (widgetId: string) => void
  execute: (widgetId: string) => void
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
  topK: '50',
  minSr: '',
  maxSr: '',
  minBpm: '',
  maxBpm: '',
  minLength: '',
  maxLength: '',
  minAr: '0',
  maxAr: '10',
  minCs: '0',
  maxCs: '10',
  minOd: '0',
  maxOd: '10',
  minHp: '0',
  maxHp: '10',
  status: '',
  excludeSameSet: true,
}

function App() {
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const copyTimeoutRef = useRef<number | null>(null)
  const pendingTurnstileResolveRef = useRef<((token: string) => void) | null>(null)
  const pendingTurnstileRejectRef = useRef<((error: Error) => void) | null>(null)
  const [beatmapInput, setBeatmapInput] = useState('')
  const [topK, setTopK] = useState(defaultFilters.topK)
  const [minSr, setMinSr] = useState(defaultFilters.minSr)
  const [maxSr, setMaxSr] = useState(defaultFilters.maxSr)
  const [minBpm, setMinBpm] = useState(defaultFilters.minBpm)
  const [maxBpm, setMaxBpm] = useState(defaultFilters.maxBpm)
  const [minLength, setMinLength] = useState(defaultFilters.minLength)
  const [maxLength, setMaxLength] = useState(defaultFilters.maxLength)
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
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [, setTurnstileStatus] = useState(
    turnstileSiteKey ? 'waiting' : 'disabled',
  )
  const [isLoading, setIsLoading] = useState(false)
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
        appearance: 'execute',
        execution: 'execute',
        callback: (token) => {
          setTurnstileStatus('ready')
          pendingTurnstileResolveRef.current?.(token)
          pendingTurnstileResolveRef.current = null
          pendingTurnstileRejectRef.current = null
        },
        'expired-callback': () => {
          setTurnstileStatus('expired')
          pendingTurnstileRejectRef.current?.(new Error('Turnstile challenge expired.'))
          pendingTurnstileResolveRef.current = null
          pendingTurnstileRejectRef.current = null
        },
        'error-callback': () => {
          setTurnstileStatus('error')
          pendingTurnstileRejectRef.current?.(new Error('Turnstile verification failed.'))
          pendingTurnstileResolveRef.current = null
          pendingTurnstileRejectRef.current = null
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

  function getTurnstileToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const widgetId = widgetIdRef.current

      if (!window.turnstile || !widgetId) {
        reject(new Error('Turnstile is not ready yet.'))
        return
      }

      pendingTurnstileResolveRef.current = resolve
      pendingTurnstileRejectRef.current = reject
      setTurnstileStatus('checking')

      window.turnstile.execute(widgetId)
    })
  }

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
      setResponse(null)
      return
    }

    setIsLoading(true)
    setError('')
    setResponse(null)

    const filters: Record<string, boolean | number | string | null> = {
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
    const minBpmValue = numericOrNull(minBpm)
    const maxBpmValue = numericOrNull(maxBpm)
    const minLengthValue = numericOrNull(minLength)
    const maxLengthValue = numericOrNull(maxLength)

    if (minBpmValue !== null) {
      filters.min_bpm = minBpmValue
    }
    if (maxBpmValue !== null) {
      filters.max_bpm = maxBpmValue
    }
    if (minLengthValue !== null) {
      filters.min_length = minLengthValue
    }
    if (maxLengthValue !== null) {
      filters.max_length = maxLengthValue
    }

    try {
      let token = ''

      if (turnstileSiteKey) {
        token = await getTurnstileToken()
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['X-Turnstile-Token'] = token
      }

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
        setTurnstileStatus('waiting')
      }
    }
  }

  function resetForm() {
    setBeatmapInput('')
    setTopK(defaultFilters.topK)
    setMinSr(defaultFilters.minSr)
    setMaxSr(defaultFilters.maxSr)
    setMinBpm(defaultFilters.minBpm)
    setMaxBpm(defaultFilters.maxBpm)
    setMinLength(defaultFilters.minLength)
    setMaxLength(defaultFilters.maxLength)
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
    setAdvancedOpen(false)
    setError('')
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

  const submitDisabled = isLoading

  return (
    <main className="app-shell">
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

          <RangeFields label="Star" min={minSr} max={maxSr} setMin={setMinSr} setMax={setMaxSr} />
          <RangeFields
            label="Length"
            min={minLength}
            max={maxLength}
            setMin={setMinLength}
            setMax={setMaxLength}
          />
          <RangeFields label="BPM" min={minBpm} max={maxBpm} setMin={setMinBpm} setMax={setMaxBpm} />

          <label className="field status-field">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Any</option>
              <option value="ranked">Ranked</option>
              <option value="loved">Loved</option>
              <option value="graveyard">Graveyard</option>
            </select>
          </label>

          <label className="field small-field">
            <span>Rows</span>
            <input
              required
              inputMode="numeric"
              pattern="[0-9]*"
              type="text"
              value={topK}
              onChange={(event) => setTopK(event.target.value)}
            />
          </label>

          <button className="ghost-button" type="button" onClick={resetForm}>
            <RefreshIcon />
            <span className="sr-only">Reset</span>
          </button>
          <button className="primary-button" type="submit" disabled={submitDisabled} aria-label="Recommend">
            {isLoading ? <SpinnerIcon /> : <SearchIcon />}
            <span className="sr-only">Recommend</span>
          </button>
        </div>

        <button
          className="advanced-toggle"
          type="button"
          aria-expanded={advancedOpen}
          aria-label={advancedOpen ? 'Hide advanced stats' : 'Show advanced stats'}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          <ChevronIcon open={advancedOpen} />
        </button>

        {advancedOpen ? (
          <div className="advanced-filters">
            <SliderRangeFields label="AR" min={minAr} max={maxAr} setMin={setMinAr} setMax={setMaxAr} />
            <SliderRangeFields label="CS" min={minCs} max={maxCs} setMin={setMinCs} setMax={setMaxCs} />
            <SliderRangeFields label="OD" min={minOd} max={maxOd} setMin={setMinOd} setMax={setMaxOd} />
            <SliderRangeFields label="HP" min={minHp} max={maxHp} setMin={setMinHp} setMax={setMaxHp} />
            <label className="check-field">
              <input
                type="checkbox"
                checked={excludeSameSet}
                onChange={(event) => setExcludeSameSet(event.target.checked)}
              />
              <span>Exclude same set</span>
            </label>
          </div>
        ) : null}

        {turnstileSiteKey ? (
          <div className="turnstile-hidden" ref={turnstileRef} />
        ) : null}
      </form>

      <section className="results-panel">
        {error ? <p className="error-text">{error}</p> : null}

        {response ? (
          <>
            <BeatmapSummary beatmap={response.query.metadata} count={response.count} label="Source map" />
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
        ) : null}
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
        inputMode="decimal"
        type="text"
        value={min}
        onChange={(event) => setMin(event.target.value)}
        placeholder="min"
        aria-label={`${label} minimum`}
      />
      <input
        inputMode="decimal"
        type="text"
        value={max}
        onChange={(event) => setMax(event.target.value)}
        placeholder="max"
        aria-label={`${label} maximum`}
      />
    </div>
  )
}

function SliderRangeFields({ label, min, max, setMin, setMax }: RangeFieldsProps) {
  const minValue = sliderValue(min, 0)
  const maxValue = sliderValue(max, 10)
  const left = `${minValue * 10}%`
  const right = `${100 - maxValue * 10}%`

  return (
    <div className="slider-field">
      <div className="slider-top">
        <span>{label}</span>
        <strong>{minValue.toFixed(1)} - {maxValue.toFixed(1)}</strong>
      </div>
      <div className="dual-slider" style={{ '--range-left': left, '--range-right': right } as SliderStyle}>
        <input
          min="0"
          max="10"
          step="0.1"
          type="range"
          value={minValue}
          onChange={(event) => setMin(clampSliderValue(event.target.value, 0, maxValue))}
          aria-label={`${label} minimum`}
        />
        <input
          min="0"
          max="10"
          step="0.1"
          type="range"
          value={maxValue}
          onChange={(event) => setMax(clampSliderValue(event.target.value, minValue, 10))}
          aria-label={`${label} maximum`}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setMin('0')
          setMax('10')
        }}
      >
        Reset
      </button>
    </div>
  )
}

type SliderStyle = CSSProperties & {
  '--range-left': string
  '--range-right': string
}

type BeatmapSummaryProps = {
  beatmap: BeatmapMetadata
  count: number
  label: string
}

function BeatmapSummary({ beatmap, count, label }: BeatmapSummaryProps) {
  return (
    <article className="source-card">
      <div className="source-main">
        <span>{label}</span>
        <a href={beatmapUrl(beatmap)} target="_blank" rel="noreferrer">
          {displayArtist(beatmap)} - {displayTitle(beatmap)}
        </a>
        <small>{beatmap.version ?? 'Unknown difficulty'}</small>
      </div>
      <strong>{resultsLabel(count)}</strong>
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
            alt=""
          />
        ) : (
          <span className="cover-placeholder">osu!</span>
        )}
      </a>

      <div className="map-content">
        <div className="map-main">
          <div className="title-line">
            <a className="map-title" href={beatmapUrl(beatmap)} target="_blank" rel="noreferrer">
              {displayArtist(beatmap)} - {displayTitle(beatmap)}
            </a>
            {copied ? <span className="copied-pill">Copied ID</span> : null}
          </div>
          <div className="version-line">
            <span>{beatmap.version ?? 'Unknown difficulty'}</span>
          </div>
          <div className="meta-line">
            <CreatorLink beatmap={beatmap} />
            <span className={`status-label ${statusClass(beatmap.status)}`}>{statusLabel(beatmap.status)}</span>
          </div>
          {beatmap.score !== undefined ? <span className="match-pill">{formatMatch(beatmap.score)}</span> : null}
        </div>

        <div className="stat-strip">
          <div className="stat-row stat-row-main">
            <Stat label="Star" value={formatNumber(beatmap.stars, 2)} featured />
            <Stat label="BPM" value={formatNumber(beatmap.bpm, 0)} featured />
            <Stat label="Len" value={formatLength(beatmap.total_length)} featured />
          </div>
          <div className="stat-side">
            <div className="stat-row stat-row-sub">
              <Stat label="AR" value={formatFixedNumber(beatmap.ar, 1)} />
              <Stat label="CS" value={formatFixedNumber(beatmap.cs, 1)} />
              <Stat label="OD" value={formatFixedNumber(beatmap.accuracy, 1)} />
              <Stat label="HP" value={formatFixedNumber(beatmap.drain, 1)} />
            </div>
            <div className="row-actions">
              <button type="button" aria-label="Play preview" title="Play preview">
                <PlayIcon />
              </button>
              <button
                type="button"
                className={copied ? 'copied-action' : ''}
                onClick={() => onCopy(beatmap.beatmap_id)}
                aria-label={copied ? 'Copied beatmap ID' : 'Copy beatmap ID'}
                title={copied ? 'Copied' : 'Copy ID'}
              >
                <CopyIcon />
              </button>
              <a href={`osu://b/${beatmap.beatmap_id}`} aria-label="Download beatmap" title="Download">
                <DownloadIcon />
              </a>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={open ? 'M6.7 15.3 12 10l5.3 5.3 1.4-1.4L12 7.2l-6.7 6.7 1.4 1.4Z' : 'm6.7 8.7-1.4 1.4 6.7 6.7 6.7-6.7-1.4-1.4L12 14 6.7 8.7Z'} />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 7V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2Zm2 0h3a2 2 0 0 1 2 2v5h2V5h-7v2Zm-4 2v10h7V9H6Z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 4h2v8.2l2.9-2.9 1.4 1.4L12 16l-5.3-5.3 1.4-1.4 2.9 2.9V4Zm-5 14h12v2H6v-2Z" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.3L13 11h8V3l-3.3 3.3Z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.5 4a6.5 6.5 0 0 1 5.2 10.4l4 4-1.4 1.4-4-4A6.5 6.5 0 1 1 10.5 4Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="spinner-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10h-2a8 8 0 1 1-8-8V2Z" />
    </svg>
  )
}

type StatProps = {
  featured?: boolean
  label: string
  value: string
}

function Stat({ featured = false, label, value }: StatProps) {
  return (
    <div className={featured ? 'stat-item featured-stat' : 'stat-item'}>
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

  const urlMatch = trimmed.match(/^https?:\/\/[^/?#]+([^?#]*)(?:\?[^#]*)?(#.*)?$/i)
  const searchable = urlMatch ? `${urlMatch[1]}${urlMatch[2] ?? ''}` : trimmed

  const matches = [...searchable.matchAll(/(?:^|[/#])(\d+)(?=$|[/#])/g)]
  if (matches.length === 0) {
    return null
  }

  const id = Number(matches[matches.length - 1][1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function numericOrNull(value: string): number | null {
  if (value.trim() === '') {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function sliderValue(value: string, fallback: number): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clampSliderValue(value: string, min: number, max: number): string {
  const number = Number(value)
  return Math.min(max, Math.max(min, number)).toFixed(1)
}

function resultsLabel(count: number): string {
  return `${count} RESULTS`
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

function formatFixedNumber(value: number | null, digits: number): string {
  if (value === null || Number.isNaN(value)) {
    return '-'
  }
  return value.toFixed(digits)
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

function formatMatch(value: number): string {
  return `${(value * 100).toFixed(2)}%`
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

function statusClass(value: string | null): string {
  const label = statusLabel(value)
  return `status-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export default App
