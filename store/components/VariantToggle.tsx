export interface VariantToggleProps {
  label: string
  isVisible: boolean
  onChange: (value: boolean) => void
}

export function VariantToggle({ label, isVisible, onChange }: VariantToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(!isVisible)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isVisible ? 'bg-emerald-600' : 'bg-gray-300'
        }`}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isVisible ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </div>
  )
}
