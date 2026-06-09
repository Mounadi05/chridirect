import { X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { ImageUploader, ImageUploadItem } from './ImageUploader'
import { VariantToggle } from './VariantToggle'

export interface ProductFormData {
  id: number
  title: string
  description: string
  images: ImageUploadItem[]
  variants: {
    [key: string]: boolean
  }
  status: 'published' | 'draft'
}

export interface EditProductModalProps {
  isOpen: boolean
  product: ProductFormData | null
  onClose: () => void
  onSave: (product: ProductFormData) => void
}

export function EditProductModal({
  isOpen,
  product,
  onClose,
  onSave,
}: EditProductModalProps) {
  const [formData, setFormData] = useState<ProductFormData>({
    id: 0,
    title: '',
    description: '',
    images: [],
    variants: {
      Black: true,
      Silver: true,
      Gold: true,
    },
    status: 'published',
  })

  useEffect(() => {
    if (product) {
      setFormData(product)
    } else {
      setFormData({
        id: Date.now(),
        title: '',
        description: '',
        images: [],
        variants: {
          Black: true,
          Silver: true,
          Gold: true,
        },
        status: 'published',
      })
    }
  }, [product, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-gray-200 bg-white">
          <h2
            className="text-xl font-bold"
            style={{ color: '#003366' }}
          >
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Marketing Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Marketing Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Power Max 4X1 + Support"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0"
              style={{ color: '#003366' }}
              required
            />
          </div>

          {/* Rich Text Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter product description for the landing page..."
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-0 resize-none"
              style={{ color: '#003366' }}
            />
            <p className="text-xs text-gray-500 mt-1">
              This text will be displayed on the public landing page
            </p>
          </div>

          {/* Media Gallery Uploader */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Product Images
            </label>
            <ImageUploader
              images={formData.images}
              onImagesChange={(images) =>
                setFormData({ ...formData, images })
              }
              maxImages={5}
            />
            <p className="text-xs text-gray-500 mt-2">
              Upload up to 5 images. The first image will be used as the main
              thumbnail.
            </p>
          </div>

          {/* Variant Visibility Toggles */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Variant Visibility
            </label>
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              {Object.entries(formData.variants).map(([variant, isVisible]) => (
                <VariantToggle
                  key={variant}
                  label={variant}
                  isVisible={isVisible}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      variants: {
                        ...formData.variants,
                        [variant]: value,
                      },
                    })
                  }
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Toggle variants ON/OFF to control their visibility on the live storefront
            </p>
          </div>

          {/* Status Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Publication Status
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="published"
                  checked={formData.status === 'published'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'published' | 'draft',
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">
                  Published
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={formData.status === 'draft'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      status: e.target.value as 'published' | 'draft',
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-700">Draft</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#008000' }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
