import { Loader, RotateCcw, Search, XCircle } from 'lucide-react'
import type { RefObject } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { defaultFilters, normalizeBeatmapInput } from './filters'
import type { RecommendFormValues } from './filters'
import { RangeFields } from './RangeFields'

type RecommendFormProps = {
  form: UseFormReturn<RecommendFormValues>
  isLoading: boolean
  turnstileEnabled: boolean
  turnstileRef: RefObject<HTMLDivElement | null>
  onSubmit: (values: RecommendFormValues) => Promise<void>
}

export function RecommendForm({ form, isLoading, turnstileEnabled, turnstileRef, onSubmit }: RecommendFormProps) {
  const values = form.watch()
  const beatmapError = form.formState.errors.beatmapInput?.message
  const submitDisabled = isLoading || form.formState.isSubmitting
  const beatmapInput = form.register('beatmapInput')

  function resetForm() {
    form.reset(defaultFilters)
  }

  return (
    <>
      <form className="control-panel" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="primary-controls">
          <label className="field beatmap-field search-field">
            <span className="sr-only">Search</span>
            <span className="input-with-status">
              <span className="search-pill">
                <input
                  required
                  aria-invalid={beatmapError ? 'true' : 'false'}
                  aria-describedby={beatmapError ? 'beatmap-error' : undefined}
                  className={beatmapError ? 'has-field-error' : undefined}
                  {...beatmapInput}
                  onChange={(event) => {
                    form.clearErrors('beatmapInput')
                    beatmapInput.onChange(event)
                  }}
                  onBlur={(event) => {
                    beatmapInput.onBlur(event)
                    form.setValue('beatmapInput', normalizeBeatmapInput(event.target.value), { shouldValidate: false })
                  }}
                  placeholder="1872396 or https://osu.ppy.sh/beatmaps/1872396"
                />
                <button className="primary-button search-button" type="submit" disabled={submitDisabled} aria-label="Recommend">
                  {submitDisabled ? <Loader className="spinner-icon" /> : <Search />}
                  <span className="sr-only">Recommend</span>
                </button>
              </span>
              {beatmapError ? <FieldErrorIcon id="beatmap-error" label="Invalid beatmap ID" /> : null}
            </span>
          </label>

          <div className="filter-controls">
            <RangeFields label="Star" min={values.minSr} max={values.maxSr} setMin={(value) => form.setValue('minSr', value)} setMax={(value) => form.setValue('maxSr', value)} />
            <RangeFields label="Length" min={values.minLength} max={values.maxLength} setMin={(value) => form.setValue('minLength', value)} setMax={(value) => form.setValue('maxLength', value)} />
            <RangeFields label="BPM" min={values.minBpm} max={values.maxBpm} setMin={(value) => form.setValue('minBpm', value)} setMax={(value) => form.setValue('maxBpm', value)} />

            <label className="field status-field">
              <span>Status:</span>
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

            <button className="ghost-button" type="button" onClick={resetForm}>
              <RotateCcw />
              <span className="sr-only">Reset</span>
            </button>
          </div>
        </div>

        {turnstileEnabled ? <div className="turnstile-hidden" ref={turnstileRef} /> : null}
      </form>
    </>
  )
}

function FieldErrorIcon({ id, label }: { id: string; label: string }) {
  return (
    <span className="field-error-icon" tabIndex={0} aria-label={label}>
      <XCircle />
      <span id={id} className="field-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  )
}
