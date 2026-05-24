import { useEffect, useRef, useState } from 'react'
import { AudioPreviewBar } from '../audio/AudioPreviewBar'
import { useAudioPreview } from '../audio/useAudioPreview'
import { useTurnstile } from '../turnstile/useTurnstile'
import { fetchDefaultRecommendations } from '../../shared/api'
import { copyText } from '../../shared/copy'
import type { BeatmapMetadata, DefaultRecommendResponse, RecommendResponse } from '../../shared/types'
import { buildRecommendRequest, defaultFilters, normalizeBeatmapInput } from './filters'
import type { RecommendFormValues } from './filters'
import { RecommendForm } from './RecommendForm'
import { readCachedRecommendation, recommendSearchParams, valuesFromRecommendSearch, writeCachedRecommendation } from './recommendHistory'
import { ResultsList } from './ResultsList'
import { SourceBeatmapCard } from './SourceBeatmapCard'
import { useRecommend } from './useRecommend'
import { useRecommendForm } from './useRecommendForm'

type HistoryMode = 'push' | 'replace' | 'none'

export function RecommendPage() {
  const [error, setError] = useState('')
  const [response, setResponse] = useState<RecommendResponse | null>(null)
  const [defaultResponse, setDefaultResponse] = useState<DefaultRecommendResponse | null>(null)
  const [defaultLoading, setDefaultLoading] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const turnstile = useTurnstile()
  const recommend = useRecommend()
  const form = useRecommendForm()
  const audio = useAudioPreview({ onError: setError })
  const defaultRequestId = useRef(0)
  const isLoading = isRunning || recommend.isPending

  useEffect(() => {
    let cancelled = false

    async function loadDefaultRecommendations() {
      const requestId = defaultRequestId.current + 1
      defaultRequestId.current = requestId
      setDefaultLoading(true)

      try {
        const data = await fetchDefaultRecommendations()
        if (!cancelled && defaultRequestId.current === requestId) {
          setDefaultResponse(data)
        }
      } catch (err) {
        if (!cancelled && defaultRequestId.current === requestId) {
          setError(err instanceof Error ? err.message : 'Request failed')
        }
      } finally {
        if (!cancelled && defaultRequestId.current === requestId) {
          setDefaultLoading(false)
        }
      }
    }

    function restoreFromLocation() {
      const values = valuesFromRecommendSearch(window.location.search)

      if (!values) {
        form.reset(defaultFilters)
        setResponse(null)
        setError('')
        void loadDefaultRecommendations()
        return
      }

      form.reset(values)
      defaultRequestId.current += 1
      setDefaultResponse(null)
      setDefaultLoading(false)

      const cached = readCachedRecommendation(values)
      if (cached) {
        setResponse(cached.response)
        setError('')
        return
      }

      setResponse(null)
      form.reset(defaultFilters)
      setError('')
      window.history.replaceState(null, '', window.location.pathname)
      void loadDefaultRecommendations()
    }

    restoreFromLocation()
    window.addEventListener('popstate', restoreFromLocation)

    return () => {
      cancelled = true
      window.removeEventListener('popstate', restoreFromLocation)
    }
  }, [form])

  async function runRecommend(values: RecommendFormValues, historyMode: HistoryMode = 'push') {
    const normalizedValues = {
      ...values,
      beatmapInput: normalizeBeatmapInput(values.beatmapInput),
    }

    form.setValue('beatmapInput', normalizedValues.beatmapInput, { shouldValidate: false })
    setIsRunning(true)
    setError('')

    const request = buildRecommendRequest(normalizedValues)

    try {
      const turnstileToken = turnstile.enabled ? await turnstile.getToken() : ''
      const data = await recommend.mutateAsync({ ...request, turnstileToken })
      setResponse(data)
      writeCachedRecommendation(normalizedValues, data)
      updateRecommendationUrl(normalizedValues, historyMode)
      scrollToPageTop()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setIsRunning(false)
      turnstile.reset()
    }
  }

  async function searchBeatmap(beatmapId: number) {
    const nextValues = { ...defaultFilters, beatmapInput: String(beatmapId) }
    form.reset(nextValues)
    await runRecommend(nextValues)
  }

  const resultBeatmaps = response?.results ?? defaultResponse?.results ?? []
  const showDefaultResults = !response && defaultResponse !== null

  function updateRecommendationUrl(values: RecommendFormValues, historyMode: HistoryMode) {
    if (historyMode === 'none') {
      return
    }

    const search = recommendSearchParams(values)
    const nextUrl = `${window.location.pathname}?${search}`
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (historyMode === 'replace' || currentUrl === nextUrl) {
      window.history.replaceState(null, '', nextUrl)
      return
    }

    window.history.pushState(null, '', nextUrl)
  }

  function scrollToPageTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  async function copyBeatmapId(beatmapId: number) {
    await copyText(String(beatmapId))
  }

  return (
    <main className="app-shell">
      {audio.audioElement}

      <RecommendForm
        form={form}
        isLoading={isLoading}
        turnstileEnabled={turnstile.enabled}
        turnstileRef={turnstile.containerRef}
        onSubmit={runRecommend}
      />

      <section className="results-panel">
        {error ? <p className="error-text">{error}</p> : null}

        <div className="result-list-wrap" aria-busy={isLoading}>
          {response ? (
            <>
              <SourceBeatmapCard beatmap={response.query.metadata} onCopy={copyBeatmapId} />
              {response.results.length > 0 ? (
                <ResultsList
                  beatmaps={response.results}
                  onCopy={copyBeatmapId}
                  onSearch={searchBeatmap}
                  isLoading={isLoading}
                  onPlayPreview={(beatmap: BeatmapMetadata) => audio.playPreview(beatmap)}
                  activePreviewSetId={audio.activeBeatmap?.beatmapset_id ?? null}
                  isPreviewPlaying={audio.isPlaying}
                />
              ) : (
                <p className="empty-results">No results found</p>
              )}
            </>
          ) : showDefaultResults ? (
            resultBeatmaps.length > 0 ? (
              <ResultsList
                beatmaps={resultBeatmaps}
                onCopy={copyBeatmapId}
                onSearch={searchBeatmap}
                isLoading={isLoading}
                onPlayPreview={(beatmap: BeatmapMetadata) => audio.playPreview(beatmap)}
                activePreviewSetId={audio.activeBeatmap?.beatmapset_id ?? null}
                isPreviewPlaying={audio.isPlaying}
              />
            ) : (
              <p className="empty-results">No results found</p>
            )
          ) : defaultLoading ? (
            <p className="empty-results">Loading recommendations</p>
          ) : error ? null : (
            <p className="empty-results">Loading recommendations</p>
          )}
          {isLoading ? <div className="results-loading-overlay" aria-hidden="true" /> : null}
        </div>
      </section>

      {audio.activeBeatmap ? (
        <AudioPreviewBar
          beatmap={audio.activeBeatmap}
          visible={audio.visible}
          isPlaying={audio.isPlaying}
          currentTime={audio.currentTime}
          duration={audio.duration}
          volume={audio.volume}
          muted={audio.muted}
          onTogglePlay={audio.toggleActive}
          onSeek={audio.seek}
          onToggleMuted={audio.toggleMuted}
          onVolumeChange={audio.changeVolume}
          onPointerDown={audio.showTemporarily}
        />
      ) : null}

      <footer className="site-footer">
        <span>
          made by <a href="https://osu.ppy.sh/users/4881051" target="_blank" rel="noreferrer">tkn</a>
        </span>
      </footer>
    </main>
  )
}
