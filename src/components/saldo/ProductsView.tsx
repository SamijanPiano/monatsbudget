import { useState } from 'react'
import type { SaldoNav } from './navigation'
import { useSaldoStore } from '../../store/saldoStore'
import type { SaldoProduct } from '../../types/saldo'
import { SubHeader } from './SubHeader'
import { CentInput } from '../ui/CentInput'
import { IconList, IconTrash } from '../ui/icons'

/**
 * Produkt-Verwaltung im Schulden-Bereich: alle bekannten Produkte mit ihrem
 * zuletzt gezahlten Preis. Name umbenennen, Preis anpassen, Produkt löschen.
 */
export function ProductsView({ nav }: { nav: SaldoNav }) {
  const products = useSaldoStore((s) => s.products)
  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, 'de'))

  return (
    <div className="sal-view">
      <SubHeader eyebrow="Schulden" title="Produkte" onBack={() => nav.back()} />

      {sorted.length === 0 ? (
        <div className="sal-empty">
          <span className="sal-empty__icon">
            <IconList size={36} />
          </span>
          <h3>Noch keine Produkte</h3>
          <p>Sobald du Artikel erfasst, erscheinen sie hier zum Bearbeiten.</p>
        </div>
      ) : (
        <ul className="sal-product-list">
          {sorted.map((p) => (
            <ProductRow key={p.id} product={p} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ProductRow({ product }: { product: SaldoProduct }) {
  const renameProduct = useSaldoStore((s) => s.renameProduct)
  const setProductPrice = useSaldoStore((s) => s.setProductPrice)
  const removeProduct = useSaldoStore((s) => s.removeProduct)
  const [name, setName] = useState(product.name)

  const commitName = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== product.name) renameProduct(product.id, trimmed)
    else setName(product.name)
  }

  return (
    <li className="sal-card sal-product-row">
      <input
        className="sal-product-name"
        value={name}
        aria-label="Produktname"
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
      />
      <CentInput
        value={product.lastPrice}
        ariaLabel={`Preis ${product.name}`}
        onCommit={(cents) => setProductPrice(product.id, cents)}
      />
      <button
        type="button"
        className="sal-iconbtn sal-product-del"
        aria-label={`${product.name} löschen`}
        onClick={() => {
          if (confirm(`„${product.name}" löschen?`)) removeProduct(product.id)
        }}
      >
        <IconTrash size={16} />
      </button>
    </li>
  )
}
