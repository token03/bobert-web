import { Clock, Copy, Download, Metronome, Pause, Play, Search, Star } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { displayArtist, displayTitle, formatFixedNumber, formatLength, formatMatch, formatNumber, statusClass, statusLabel } from '../../shared/format'
import { Stat } from '../../shared/ui/Stat'
import type { BeatmapMetadata } from '../../shared/types'
import { beatmapUrl, coverUrl, userUrl } from '../../shared/urls'

type BeatmapCardProps = {
  beatmap: BeatmapMetadata
  onCopy: (beatmapId: number) => Promise<void>
  onSearch: (beatmapId: number) => Promise<void>
  isLoading: boolean
  onPlayPreview: (beatmap: BeatmapMetadata) => Promise<void>
  activePreviewSetId: number | null
  isPreviewPlaying: boolean
}

export function BeatmapCard({ beatmap, onCopy, onSearch, isLoading, onPlayPreview, activePreviewSetId, isPreviewPlaying }: BeatmapCardProps) {
  const hasPreview = beatmap.beatmapset_id !== null
  const isActivePreview = hasPreview && activePreviewSetId === beatmap.beatmapset_id
  const isCoverActive = isActivePreview && isPreviewPlaying
  const openBeatmap = () => window.open(beatmapUrl(beatmap), '_blank', 'noreferrer')
  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openBeatmap()
    }
  }

  return (
    <article className="beatmap-row clickable-card" role="link" tabIndex={0} onClick={openBeatmap} onKeyDown={handleCardKeyDown}>
      <button
        className={isCoverActive ? 'cover-preview is-audio-active' : 'cover-preview'}
        type="button"
        disabled={!hasPreview}
        onClick={(event) => {
          event.stopPropagation()
          onPlayPreview(beatmap)
        }}
        aria-label={hasPreview ? (isCoverActive ? 'Pause preview' : 'Play preview') : 'No preview available'}
        title={hasPreview ? (isCoverActive ? 'Pause preview' : 'Play preview') : 'No preview available'}
      >
        {beatmap.beatmapset_id ? (
          <img src={coverUrl(beatmap.beatmapset_id)} alt="" />
        ) : (
          <span className="cover-placeholder">osu!</span>
        )}
        {hasPreview ? (
          <span className="cover-play-overlay" aria-hidden="true">
            <span className="cover-play-button">
              {isCoverActive ? <Pause className="filled-icon" /> : <Play className="filled-icon" />}
            </span>
          </span>
        ) : null}
      </button>

      <div className="map-content">
        <div className="map-main">
          <div className="title-line">
            <span className="map-title">{displayTitle(beatmap)}</span>
          </div>
          <div className="artist-line">by {displayArtist(beatmap)}</div>
          <div className="version-line">
            <span>{beatmap.version ?? 'Unknown difficulty'}</span>
          </div>
          <div className="match-line">
            {beatmap.score !== undefined ? <span className="match-pill">{formatMatch(beatmap.score)}</span> : null}
            <span className={`status-label ${statusClass(beatmap.status)}`}>{statusLabel(beatmap.status)}</span>
            <CreatorLink beatmap={beatmap} />
          </div>
        </div>

        <div className="stat-strip">
          <div className="stat-row stat-row-main">
            <Stat label={<Star aria-label="Star" />} value={formatNumber(beatmap.stars, 2)} featured />
            <Stat label={<Metronome aria-label="BPM" />} value={formatNumber(beatmap.bpm, 0)} featured />
            <Stat label={<Clock aria-label="Length" />} value={formatLength(beatmap.total_length)} featured />
          </div>
          <div className="stat-side">
            <div className="stat-row stat-row-sub">
              <Stat label="AR" value={formatFixedNumber(beatmap.ar, 1)} />
              <Stat label="CS" value={formatFixedNumber(beatmap.cs, 1)} />
              <Stat label="OD" value={formatFixedNumber(beatmap.accuracy, 1)} />
              <Stat label="HP" value={formatFixedNumber(beatmap.drain, 1)} />
            </div>
            <div className="row-actions" onClick={(event) => event.stopPropagation()}>
              <button type="button" disabled={isLoading} onClick={(event) => handleActionClick(event, () => onSearch(beatmap.beatmap_id))} aria-label="Search similar" title="Search similar">
                <Search />
              </button>
              <button type="button" onClick={(event) => handleActionClick(event, () => onCopy(beatmap.beatmap_id))} aria-label="Copy beatmap ID" title="Copy ID">
                <Copy />
              </button>
              <button type="button" onClick={(event) => handleActionClick(event, () => window.location.assign(`osu://b/${beatmap.beatmap_id}`))} aria-label="Open beatmap in osu!" title="Open in osu!">
                <Download />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function handleActionClick(event: MouseEvent<HTMLButtonElement>, action: () => void | Promise<void>) {
  event.stopPropagation()
  action()
}

function CreatorLink({ beatmap }: { beatmap: BeatmapMetadata }) {
  const creatorName = beatmap.creator ?? beatmap.user_id ?? 'unknown'

  if (beatmap.user_id) {
    return (
      <span>
        mapped by{' '}
        <a className="mapper-link" href={userUrl(beatmap.user_id)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
          {creatorName}
        </a>
      </span>
    )
  }

  return <span>mapped by {creatorName}</span>
}
