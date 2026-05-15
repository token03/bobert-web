import { displayArtist, displayTitle, resultsLabel } from '../../shared/format'
import type { BeatmapMetadata } from '../../shared/types'
import { beatmapUrl } from '../../shared/urls'

type SourceBeatmapCardProps = {
  beatmap: BeatmapMetadata
  count: number
  label: string
}

export function SourceBeatmapCard({ beatmap, count, label }: SourceBeatmapCardProps) {
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
