import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  size?: number
  color?: string
  className?: string
}

export function StarRating({
  rating,
  size = 16,
  color = '#D4AF37',
  className = '',
}: StarRatingProps) {
  return (
    <div className={`flex gap-1 justify-center ${className}`}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < rating ? color : '#D1D5DB'}
          stroke={i < rating ? color : '#D1D5DB'}
          className="transition-all"
        />
      ))}
    </div>
  )
}
