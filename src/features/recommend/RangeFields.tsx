type RangeFieldsProps = {
  label: string
  min: string
  max: string
  setMin: (value: string) => void
  setMax: (value: string) => void
}

export function RangeFields({ label, min, max, setMin, setMax }: RangeFieldsProps) {
  return (
    <div className="range-field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        type="text"
        value={min}
        onChange={(event) => setMin(event.target.value)}
        placeholder="min"
        aria-label={`${label} minimum`}
      />
      <input
        inputMode="decimal"
        type="text"
        value={max}
        onChange={(event) => setMax(event.target.value)}
        placeholder="max"
        aria-label={`${label} maximum`}
      />
    </div>
  )
}
