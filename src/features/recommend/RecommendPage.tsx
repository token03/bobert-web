import { useEffect, useState } from 'react'
import { AudioPreviewBar } from '../audio/AudioPreviewBar'
import { useAudioPreview } from '../audio/useAudioPreview'
import { useTurnstile } from '../turnstile/useTurnstile'
import { copyText } from '../../shared/copy'
import type { BeatmapMetadata, RecommendResponse } from '../../shared/types'
import { buildRecommendRequest, defaultFilters } from './filters'
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
  const [isRunning, setIsRunning] = useState(false)
  const turnstile = useTurnstile()
  const recommend = useRecommend()
  const form = useRecommendForm()
  const audio = useAudioPreview({ onError: setError })
  const isLoading = isRunning || recommend.isPending

  useEffect(() => {
    function restoreFromLocation() {
      const values = valuesFromRecommendSearch(window.location.search)

      if (!values) {
        form.reset(defaultFilters)
        setResponse(null)
        setError('')
        return
      }

      form.reset(values)

      const cached = readCachedRecommendation(values)
      if (cached) {
        setResponse(cached.response)
        setError('')
        return
      }

      setResponse(null)
      setError('These recommendations are not cached in this tab anymore. Run the search again to refresh them.')
    }

    restoreFromLocation()
    window.addEventListener('popstate', restoreFromLocation)

    return () => {
      window.removeEventListener('popstate', restoreFromLocation)
    }
  }, [form])

  async function runRecommend(values: RecommendFormValues, historyMode: HistoryMode = 'push') {
    setIsRunning(true)
    setError('')

    const request = buildRecommendRequest(values)

    try {
      const turnstileToken = turnstile.enabled ? await turnstile.getToken() : ''
      const data = await recommend.mutateAsync({ ...request, turnstileToken })
      setResponse(data)
      writeCachedRecommendation(values, data)
      updateRecommendationUrl(values, historyMode)
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

        {response ? (
          <>
            <SourceBeatmapCard beatmap={response.query.metadata} count={response.count} label="Source map" />
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
              <p className="empty-results">No beatmaps found</p>
            )}
          </>
        ) : error ? null : (
          <p className="empty-results">Please provide a beatmap id or link</p>
        )}
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
