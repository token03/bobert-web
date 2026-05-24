import { Clock, Copy, Download, Metronome, Star } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { displayArtist, displayTitle, formatFixedNumber, formatLength, formatNumber, statusClass, statusLabel } from '../../shared/format'
import type { BeatmapMetadata } from '../../shared/types'
import { Stat } from '../../shared/ui/Stat'
import { beatmapUrl, cardCoverUrl, userUrl } from '../../shared/urls'

type SourceBeatmapCardProps = {
  beatmap: BeatmapMetadata
  count: number
  onCopy: (beatmapId: number) => Promise<void>
}

export function SourceBeatmapCard({ beatmap, count, onCopy }: SourceBeatmapCardProps) {
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
    <article className="source-card clickable-card" role="link" tabIndex={0} onClick={openBeatmap} onKeyDown={handleCardKeyDown}>
      <div className="source-cover" aria-hidden="true">
        {beatmap.beatmapset_id ? <img src={cardCoverUrl(beatmap.beatmapset_id)} alt="" /> : <span className="cover-placeholder">osu!</span>}
      </div>

      <div className="source-content">
        <div className="source-main">
          <div className="source-heading">
            <div className="source-copy">
              <div className="title-line">
                <span className="map-title">{displayTitle(beatmap)}</span>
              </div>
              <div className="artist-line">by {displayArtist(beatmap)}</div>
              <div className="version-line">
                <span>{beatmap.version ?? 'Unknown difficulty'}</span>
              </div>
            </div>
          </div>
          <div className="match-line source-match-line">
            <strong className="source-results">{formatResults(count)}</strong>
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

function formatResults(count: number) {
  return `${count} ${count === 1 ? 'RESULT' : 'RESULTS'}`
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
