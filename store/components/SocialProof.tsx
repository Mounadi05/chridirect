import { Eye } from 'lucide-react'
import { themeConfig } from '@/lib/themeConfig'

export function SocialProof() {
  return (
    <div
      className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl"
      style={{
        backgroundColor: themeConfig.colors.trust + '15',
        border: `1.5px solid ${themeConfig.colors.trust}40`,
      }}
    >
      <Eye size={15} style={{ color: themeConfig.colors.trust }} />
      <span
        className="text-sm font-medium"
        style={{ color: themeConfig.colors.primary }}
      >
        <span className="font-black" style={{ color: themeConfig.colors.trust }}>
          {themeConfig.socialProof.currentViewers}
        </span>
        {' شخصاً يتصفح هذا المنتج الآن'}
      </span>
    </div>
  )
}
