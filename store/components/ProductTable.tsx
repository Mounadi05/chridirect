import { Edit, Trash2, Image as ImageIcon } from 'lucide-react'
import { VariantToggle } from './VariantToggle'
import { ProductFormData } from './EditProductModal'

export interface ProductTableProps {
  products: ProductFormData[]
  onEdit: (product: ProductFormData) => void
  onDelete: (productId: number) => void
  onVariantToggle: (productId: number, variant: string, value: boolean) => void
}

export function ProductTable({
  products,
  onEdit,
  onDelete,
  onVariantToggle,
}: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12 px-6">
        <ImageIcon
          size={48}
          className="mx-auto mb-4 text-gray-400"
          style={{ color: '#003366', opacity: 0.3 }}
        />
        <p className="text-gray-600 font-medium">No products found</p>
        <p className="text-sm text-gray-500 mt-1">
          Click &quot;Add Storefront Product&quot; to create your first product
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
              Image
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
              Display Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
              Visible Colors
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
              ERP ID
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
              {/* Main Image */}
              <td className="px-6 py-4">
                {product.images.length > 0 ? (
                  <img
                    src={product.images[0].preview}
                    alt={product.title}
                    className="w-12 h-12 rounded object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center">
                    <ImageIcon size={20} className="text-gray-400" />
                  </div>
                )}
              </td>

              {/* Display Name */}
              <td className="px-6 py-4">
                <p
                  className="font-semibold text-sm"
                  style={{ color: '#003366' }}
                >
                  {product.title}
                </p>
                <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                  {product.description || 'No description'}
                </p>
              </td>

              {/* Visible Colors/Variants */}
              <td className="px-6 py-4">
                <div className="space-y-2">
                  {Object.entries(product.variants).map(([variant, isVisible]) => (
                    <VariantToggle
                      key={variant}
                      label={variant}
                      isVisible={isVisible}
                      onChange={(value) =>
                        onVariantToggle(product.id, variant, value)
                      }
                    />
                  ))}
                </div>
              </td>

              {/* ERP ID */}
              <td className="px-6 py-4">
                <span
                  className="inline-block px-2 py-1 text-xs font-mono rounded bg-gray-100 text-gray-600"
                  style={{ color: '#666' }}
                >
                  #{product.id}
                </span>
              </td>

              {/* Status */}
              <td className="px-6 py-4">
                <span
                  className={`inline-block px-3 py-1 text-xs font-semibold rounded-full text-white ${
                    product.status === 'published'
                      ? 'bg-emerald-600'
                      : 'bg-amber-500'
                  }`}
                  style={{
                    backgroundColor:
                      product.status === 'published' ? '#008000' : '#D4AF37',
                  }}
                >
                  {product.status === 'published' ? 'Published' : 'Draft'}
                </span>
              </td>

              {/* Actions */}
              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(product)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit product"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Are you sure you want to delete "${product.title}"?`
                        )
                      ) {
                        onDelete(product.id)
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete product"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
