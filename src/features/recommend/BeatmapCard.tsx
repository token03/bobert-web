import clsx from 'clsx'
import { Clock, Copy, Download, Metronome, Pause, Play, Search, Star } from 'lucide-react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { displayArtist, displayTitle, formatFixedNumber, formatLength, formatMatch, formatNumber, statusClass, statusLabel } from '../../shared/format'
import { Stat } from '../../shared/ui/Stat'
import type { BeatmapMetadata } from '../../shared/types'
import { beatmapUrl, cardCoverUrl, coverUrl, userUrl } from '../../shared/urls'

type ResultBeatmapCardProps = {
  variant?: 'result'
  beatmap: BeatmapMetadata
  onCopy: (beatmapId: number) => Promise<void>
  onSearch: (beatmapId: number) => Promise<void>
  isLoading: boolean
  onPlayPreview: (beatmap: BeatmapMetadata) => Promise<void>
  activePreviewSetId: number | null
  isPreviewPlaying: boolean
}

type SourceBeatmapCardProps = {
  variant: 'source'
  beatmap: BeatmapMetadata
  onCopy: (beatmapId: number) => Promise<void>
}

type BeatmapCardProps = ResultBeatmapCardProps | SourceBeatmapCardProps

type BeatmapCardAction = {
  label: string
  title: string
  icon: ReactNode
  disabled?: boolean
  action: () => void | Promise<void>
}

export function BeatmapCard(props: BeatmapCardProps) {
  const { beatmap, onCopy } = props
  const isSource = props.variant === 'source'
  const hasPreview = beatmap.beatmapset_id !== null
  const isActivePreview = !isSource && hasPreview && props.activePreviewSetId === beatmap.beatmapset_id
  const isCoverActive = isActivePreview && props.isPreviewPlaying
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

  const actions: BeatmapCardAction[] = [
    ...(isSource
      ? []
      : [
          {
            label: 'Search similar',
            title: 'Search similar',
            icon: <Search />,
            disabled: props.isLoading,
            action: () => props.onSearch(beatmap.beatmap_id),
          },
        ]),
    {
      label: 'Copy beatmap ID',
      title: 'Copy ID',
      icon: <Copy />,
      action: () => onCopy(beatmap.beatmap_id),
    },
    {
      label: 'Open beatmap in osu!',
      title: 'Open in osu!',
      icon: <Download />,
      action: () => window.location.assign(`osu://b/${beatmap.beatmap_id}`),
    },
  ]

  return (
    <article className={clsx('media-card', isSource ? 'source-card' : 'beatmap-row', 'clickable-card')} role="link" tabIndex={0} onClick={openBeatmap} onKeyDown={handleCardKeyDown}>
      {isSource ? (
        <div className="media-card__media source-cover" aria-hidden="true">
          {beatmap.beatmapset_id ? <img src={cardCoverUrl(beatmap.beatmapset_id)} alt="" /> : <span className="cover-placeholder">osu!</span>}
        </div>
      ) : (
        <button
          className={clsx('media-card__media', 'cover-preview', isCoverActive && 'is-audio-active')}
          type="button"
          disabled={!hasPreview}
          onClick={(event) => {
            event.stopPropagation()
            props.onPlayPreview(beatmap)
          }}
          aria-label={hasPreview ? (isCoverActive ? 'Pause preview' : 'Play preview') : 'No preview available'}
          title={hasPreview ? (isCoverActive ? 'Pause preview' : 'Play preview') : 'No preview available'}
        >
          {beatmap.beatmapset_id ? <img src={coverUrl(beatmap.beatmapset_id)} alt="" /> : <span className="cover-placeholder">osu!</span>}
          {hasPreview ? (
            <span className="cover-play-overlay" aria-hidden="true">
              <span className="cover-play-button">{isCoverActive ? <Pause className="filled-icon" /> : <Play className="filled-icon" />}</span>
            </span>
          ) : null}
        </button>
      )}

      <div className={clsx('media-card__body', isSource ? 'source-content' : 'map-content')}>
        <BeatmapCardDetails beatmap={beatmap} showMatch={!isSource} />
        <BeatmapCardStats beatmap={beatmap} actions={actions} showSourceSeparator={isSource} />
      </div>
    </article>
  )
}

function handleActionClick(event: MouseEvent<HTMLButtonElement>, action: () => void | Promise<void>) {
  event.stopPropagation()
  action()
}

function BeatmapCardDetails({ beatmap, showMatch }: { beatmap: BeatmapMetadata; showMatch: boolean }) {
  return (
    <div className={showMatch ? 'map-main' : 'source-main'}>
      <div className={showMatch ? undefined : 'source-heading'}>
        <div className={showMatch ? undefined : 'source-copy'}>
          <div className="title-line">
            <span className="map-title">{displayTitle(beatmap)}</span>
          </div>
          <div className="artist-line">by {displayArtist(beatmap)}</div>
          <div className="version-line">
            <span>{beatmap.version ?? 'Unknown difficulty'}</span>
          </div>
          {showMatch ? (
            <div className="match-line">
              {beatmap.score !== undefined ? <span className="badge badge--match match-pill">{formatMatch(beatmap.score)}</span> : null}
              <span className={clsx('badge', 'badge--status', statusClass(beatmap.status), 'status-label')}>{statusLabel(beatmap.status)}</span>
              <CreatorLink beatmap={beatmap} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function BeatmapCardStats({ beatmap, actions, showSourceSeparator }: { beatmap: BeatmapMetadata; actions: BeatmapCardAction[]; showSourceSeparator: boolean }) {
  return (
    <div className="stat-strip">
      <div className="stat-row stat-row-main">
        <Stat label={<Star aria-label="Star" strokeWidth={3} />} value={formatNumber(beatmap.stars, 2)} featured />
        <Stat label={<Metronome aria-label="BPM" strokeWidth={3} />} value={formatNumber(beatmap.bpm, 0)} featured />
        <Stat label={<Clock aria-label="Length" strokeWidth={3} />} value={formatLength(beatmap.total_length)} featured />
      </div>
      <div className="stat-side">
        {showSourceSeparator ? <div className="source-stat-separator" aria-hidden="true" /> : null}
        <div className="stat-row stat-row-sub">
          <Stat label="AR" value={formatFixedNumber(beatmap.ar, 1)} />
          <Stat label="CS" value={formatFixedNumber(beatmap.cs, 1)} />
          <Stat label="OD" value={formatFixedNumber(beatmap.accuracy, 1)} />
          <Stat label="HP" value={formatFixedNumber(beatmap.drain, 1)} />
        </div>
        <div className="row-actions" onClick={(event) => event.stopPropagation()}>
          {actions.map((action) => (
            <button className="button button--bare row-action-button" key={action.label} type="button" disabled={action.disabled} onClick={(event) => handleActionClick(event, action.action)} aria-label={action.label} title={action.title}>
              {action.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
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
