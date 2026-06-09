import { Upload, X } from 'lucide-react'
import { useState } from 'react'

export interface ImageUploadItem {
  id: string
  file?: File
  preview: string
  name: string
}

export interface ImageUploaderProps {
  images: ImageUploadItem[]
  onImagesChange: (images: ImageUploadItem[]) => void
  maxImages?: number
}

export function ImageUploader({
  images,
  onImagesChange,
  maxImages = 5,
}: ImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith('image/')
    )

    addImages(files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addImages(Array.from(e.target.files))
    }
  }

  const addImages = (files: File[]) => {
    const newImages = files
      .slice(0, maxImages - images.length)
      .map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
      }))

    onImagesChange([...images, ...newImages])
  }

  const removeImage = (id: string) => {
    onImagesChange(images.filter((img) => img.id !== id))
  }

  const canAddMore = images.length < maxImages

  return (
    <div className="space-y-4">
      {canAddMore && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-emerald-600 bg-emerald-50'
              : 'border-navy-blue bg-gray-50'
          }`}
          style={{
            borderColor: dragActive ? '#008000' : '#003366',
            backgroundColor: dragActive ? '#f0fdf4' : '#f9fafb',
          }}
        >
          <Upload
            className="mx-auto mb-3 text-gray-400"
            size={32}
            style={{ color: dragActive ? '#008000' : '#003366' }}
          />
          <p className="text-sm font-medium text-gray-700 mb-1">
            Drag and drop your images here
          </p>
          <p className="text-xs text-gray-500 mb-3">
            or click to browse ({images.length}/{maxImages})
          </p>
          <label className="inline-block">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              disabled={!canAddMore}
              className="hidden"
            />
            <span
              className="inline-block px-4 py-2 rounded font-medium text-white cursor-pointer hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#008000' }}
            >
              Select Files
            </span>
          </label>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image, index) => (
            <div key={image.id} className="relative group">
              <img
                src={image.preview}
                alt={`Upload preview ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={() => removeImage(image.id)}
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
              {index === 0 && (
                <span
                  className="absolute top-1 left-1 px-2 py-1 text-xs font-semibold text-white rounded"
                  style={{ backgroundColor: '#008000' }}
                >
                  Main
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
