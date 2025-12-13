import { useApp } from '../context/AppContext'

export function Footer() {
  const { t } = useApp()

  return (
    <footer className="bg-white border-t mt-12 py-6">
      <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
        <p>WHS Safety Compliance Navigator - {t.footer.disclaimer}</p>
        <p className="mt-1">{t.footer.advice}</p>
      </div>
    </footer>
  )
}

export default Footer
