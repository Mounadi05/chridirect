import { themeConfig } from '@/lib/themeConfig'

export function WaveSeparator() {
  return (
    <div className="relative w-full h-20 overflow-hidden">
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        <path
          d="M0,40 Q300,0 600,40 T1200,40 L1200,120 L0,120 Z"
          fill={themeConfig.colors.white}
        />
      </svg>
    </div>
  )
}
