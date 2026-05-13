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
    },
  ) => string
  reset: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''

function App() {
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [beatmapId, setBeatmapId] = useState('')
  const [topK, setTopK] = useState('20')
  const [minSr, setMinSr] = useState('')
  const [maxSr, setMaxSr] = useState('')
  const [status, setStatus] = useState('')
  const [excludeSameSet, setExcludeSameSet] = useState(true)
  const [apiKey, setApiKey] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileStatus, setTurnstileStatus] = useState(
    turnstileSiteKey ? 'Waiting for Turnstile' : 'No site key configured',
  )
  const [isLoading, setIsLoading] = useState(false)
  const [httpStatus, setHttpStatus] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [response, setResponse] = useState<unknown>(null)

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
        callback: (token) => {
          setTurnstileToken(token)
          setTurnstileStatus('Turnstile ready')
        },
        'expired-callback': () => {
          setTurnstileToken('')
          setTurnstileStatus('Turnstile expired')
        },
        'error-callback': () => {
          setTurnstileToken('')
          setTurnstileStatus('Turnstile error')
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

  async function submitRecommend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
      min_sr: minSr === '' ? null : Number(minSr),
      max_sr: maxSr === '' ? null : Number(maxSr),
      status: status.trim() || null,
      exclude_same_set: excludeSameSet,
    }

    try {
      const result = await fetch(`${apiUrl}/recommend`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          beatmap_id: Number(beatmapId),
          top_k: Number(topK),
          filters,
        }),
      })
      const text = await result.text()
      const data = text ? JSON.parse(text) : null

      setHttpStatus(result.status)
      setResponse(data)

      if (!result.ok) {
        setError(data?.detail ?? `Request failed with ${result.status}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setIsLoading(false)
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current)
        setTurnstileToken('')
        setTurnstileStatus('Waiting for Turnstile')
      }
    }
  }

  return (
    <main className="app-shell">
      <section className="panel intro-panel">
        <p className="eyebrow">bobert API tester</p>
        <h1>Recommend request</h1>
        <p>
          Sends a POST request to <code>{apiUrl}/recommend</code> using your local Vite
          env values.
        </p>
      </section>

      <form className="panel request-form" onSubmit={submitRecommend}>
        <label>
          Beatmap ID
          <input
            required
            min="1"
            type="number"
            value={beatmapId}
            onChange={(event) => setBeatmapId(event.target.value)}
            placeholder="1675877"
          />
        </label>

        <label>
          Top K
          <input
            required
            min="1"
            max="50"
            type="number"
            value={topK}
            onChange={(event) => setTopK(event.target.value)}
          />
        </label>

        <label>
          Min SR
          <input
            min="0"
            step="0.01"
            type="number"
            value={minSr}
            onChange={(event) => setMinSr(event.target.value)}
            placeholder="optional"
          />
        </label>

        <label>
          Max SR
          <input
            min="0"
            step="0.01"
            type="number"
            value={maxSr}
            onChange={(event) => setMaxSr(event.target.value)}
            placeholder="optional"
          />
        </label>

        <label>
          Status
          <input
            maxLength={32}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="ranked, loved, graveyard"
          />
        </label>

        <label>
          API key override
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="optional X-API-Key"
          />
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={excludeSameSet}
            onChange={(event) => setExcludeSameSet(event.target.checked)}
          />
          Exclude same beatmapset
        </label>

        {turnstileSiteKey && !apiKey.trim() ? (
          <div className="turnstile-block">
            <div ref={turnstileRef} />
            <span>{turnstileStatus}</span>
          </div>
        ) : null}

        <button type="submit" disabled={isLoading || (!apiKey.trim() && turnstileSiteKey && !turnstileToken)}>
          {isLoading ? 'Sending...' : 'Send recommend request'}
        </button>
      </form>

      <section className="panel response-panel">
        <div className="response-heading">
          <h2>Response</h2>
          {httpStatus ? <span>HTTP {httpStatus}</span> : null}
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <pre>{response ? JSON.stringify(response, null, 2) : 'No response yet.'}</pre>
      </section>
    </main>
  )
}

export default App
