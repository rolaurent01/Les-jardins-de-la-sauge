'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Organisations', href: '/admin/organisations' },
  { label: 'Fermes',        href: '/admin/fermes' },
  { label: 'Utilisateurs',  href: '/admin/utilisateurs' },
  { label: 'Logs',          href: '/admin/logs',   disabled: true },
  { label: 'Outils',        href: '/admin/outils', disabled: true },
]

export default function AdminNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname()

  return (
    <nav
      className="flex-shrink-0 flex items-center gap-1 px-6 py-1.5"
      style={{
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#FEFCE8',
      }}
    >
      {TABS.map(tab => {
        const fullHref = `/${orgSlug}${tab.href}`
        const isActive = pathname.startsWith(fullHref)

        if (tab.disabled) {
          return (
            <span
              key={tab.href}
              className="rounded-md"
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#9CA3AF',
                cursor: 'default',
              }}
            >
              {tab.label}
            </span>
          )
        }

        return (
          <Link
            key={tab.href}
            href={fullHref}
            className="rounded-md"
            style={{
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#DC2626' : '#4B5563',
              backgroundColor: isActive ? 'rgba(220, 38, 38, 0.08)' : 'transparent',
              transition: 'all 150ms ease-out',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
