import type { KeyboardEvent } from 'react'
import { displayArtist, displayTitle, resultsLabel } from '../../shared/format'
import type { BeatmapMetadata } from '../../shared/types'
import { beatmapUrl, coverUrl } from '../../shared/urls'

type SourceBeatmapCardProps = {
  beatmap: BeatmapMetadata
  count: number
  label: string
}

export function SourceBeatmapCard({ beatmap, count, label }: SourceBeatmapCardProps) {
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
        {beatmap.beatmapset_id ? <img src={coverUrl(beatmap.beatmapset_id)} alt="" /> : <span className="cover-placeholder">osu!</span>}
      </div>
      <div className="source-main">
        <span>{label}</span>
        <strong className="source-title">
          {displayArtist(beatmap)} - {displayTitle(beatmap)}
        </strong>
        <small>{beatmap.version ?? 'Unknown difficulty'}</small>
      </div>
      <strong className="source-results">{resultsLabel(count)}</strong>
    </article>
  )
}
