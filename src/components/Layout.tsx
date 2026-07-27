import { Outlet } from 'react-router'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

/**
 * Marketing layout (nested-route pattern — renders <Outlet/>).
 * Navbar is fixed at 72px, so this layout owns the top offset for the
 * content slot. Full-bleed hero sections opt out inside the page
 * (e.g. a negative top margin on the hero), not by removing this padding.
 */
export default function Layout() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg-0">
      <Navbar />
      <main className="flex-1 pt-[72px]">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
