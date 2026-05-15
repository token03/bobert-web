import { ChevronDown, ChevronUp, Loader, RotateCcw, Search } from 'lucide-react'
import { useState } from 'react'
import type { RefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { defaultFilters } from './filters'
import type { RecommendFormValues } from './filters'
import { RangeFields } from './RangeFields'
import { SliderRangeFields } from './SliderRangeFields'

type RecommendFormProps = {
  form: UseFormReturn<RecommendFormValues>
  isLoading: boolean
  turnstileEnabled: boolean
  turnstileRef: RefObject<HTMLDivElement | null>
  onSubmit: (values: RecommendFormValues) => Promise<void>
}

export function RecommendForm({ form, isLoading, turnstileEnabled, turnstileRef, onSubmit }: RecommendFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const values = form.watch()
  const error = form.formState.errors.beatmapInput?.message ?? form.formState.errors.topK?.message
  const submitDisabled = isLoading || form.formState.isSubmitting

  function resetForm() {
    form.reset(defaultFilters)
    setAdvancedOpen(false)
  }

  return (
    <>
      {error ? <p className="error-text">{error}</p> : null}
      <form className="control-panel" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="primary-controls">
          <label className="field beatmap-field">
            <span>Beatmap</span>
            <input
              required
              {...form.register('beatmapInput')}
              placeholder="1872396 or https://osu.ppy.sh/beatmaps/1872396"
            />
          </label>

          <RangeFields label="Star" min={values.minSr} max={values.maxSr} setMin={(value) => form.setValue('minSr', value)} setMax={(value) => form.setValue('maxSr', value)} />
          <RangeFields label="Length" min={values.minLength} max={values.maxLength} setMin={(value) => form.setValue('minLength', value)} setMax={(value) => form.setValue('maxLength', value)} />
          <RangeFields label="BPM" min={values.minBpm} max={values.maxBpm} setMin={(value) => form.setValue('minBpm', value)} setMax={(value) => form.setValue('maxBpm', value)} />

          <label className="field status-field">
            <span>Status</span>
            <select {...form.register('status')}>
              <option value="">Any</option>
              <option value="-2">Graveyard</option>
              <option value="-1">WIP</option>
              <option value="0">Pending</option>
              <option value="1">Ranked</option>
              <option value="2">Approved</option>
              <option value="3">Qualified</option>
              <option value="4">Loved</option>
            </select>
          </label>

          <label className="field small-field">
            <span>Rows</span>
            <input required inputMode="numeric" pattern="[0-9]*" type="text" {...form.register('topK')} />
          </label>

          <div className="form-actions">
            <button className="ghost-button" type="button" onClick={resetForm}>
              <RotateCcw />
              <span className="sr-only">Reset</span>
            </button>
            <button className="primary-button" type="submit" disabled={submitDisabled} aria-label="Recommend">
              {submitDisabled ? <Loader className="spinner-icon" /> : <Search />}
              <span className="sr-only">Recommend</span>
            </button>
          </div>
        </div>

        <button
          className="advanced-toggle"
          type="button"
          aria-expanded={advancedOpen}
          aria-label={advancedOpen ? 'Hide advanced stats' : 'Show advanced stats'}
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          {advancedOpen ? <ChevronUp /> : <ChevronDown />}
        </button>

        {advancedOpen ? (
          <div className="advanced-filters">
            <SliderRangeFields label="AR" min={values.minAr} max={values.maxAr} setMin={(value) => form.setValue('minAr', value)} setMax={(value) => form.setValue('maxAr', value)} />
            <SliderRangeFields label="CS" min={values.minCs} max={values.maxCs} setMin={(value) => form.setValue('minCs', value)} setMax={(value) => form.setValue('maxCs', value)} />
            <SliderRangeFields label="OD" min={values.minOd} max={values.maxOd} setMin={(value) => form.setValue('minOd', value)} setMax={(value) => form.setValue('maxOd', value)} />
            <SliderRangeFields label="HP" min={values.minHp} max={values.maxHp} setMin={(value) => form.setValue('minHp', value)} setMax={(value) => form.setValue('maxHp', value)} />
            <label className="check-field">
              <input type="checkbox" {...form.register('excludeSameSet')} />
              <span>Exclude same set</span>
            </label>
          </div>
        ) : null}

        {turnstileEnabled ? <div className="turnstile-hidden" ref={turnstileRef} /> : null}
      </form>
    </>
  )
}
