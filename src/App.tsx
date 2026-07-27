import { Routes, Route, useLocation } from 'react-router'
import Layout from '@/components/Layout'
import AppShell from '@/components/AppShell'
import Home from '@/pages/Home'
import Pricing from '@/pages/Pricing'
import Faq from '@/pages/Faq'
import Terms from '@/pages/Terms'
import Privacy from '@/pages/Privacy'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/dashboard/Dashboard'
import HockeyDashboard from '@/pages/HockeyDashboard'
import HitRates from '@/pages/HitRates'
import Profiler from '@/pages/Profiler'
import GameCenter from '@/pages/GameCenter'
import EdgeCenter from '@/pages/EdgeCenter'
import Ask from '@/pages/Ask'
import Angles from '@/pages/Angles'

/** Placeholder page — used only for the 404 catch-all. */
function PageStub({ name, note }: { name: string; note?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold text-text-1">{name}</h1>
      <p className="max-w-md text-sm text-text-3">
        {note ?? 'This page is being built — check back shortly.'}
      </p>
    </div>
  )
}

function Stub({ name, note }: { name: string; note?: string }) {
  const location = useLocation()
  return <PageStub key={location.pathname} name={name} note={note} />
}

export default function App() {
  return (
    <Routes>
      {/* Marketing routes — Layout renders <Outlet/> */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="faq" element={<Faq />} />
        <Route path="terms" element={<Terms />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="*" element={<Stub name="Page not found" note="That angle doesn't exist — head back to the slate." />} />
      </Route>

      {/* Auth pages (split-screen, standalone) */}
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />

      {/* App routes — AppShell renders <Outlet/>, auth-gated */}
      <Route element={<AppShell />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="dashboard/hockey" element={<HockeyDashboard />} />
        <Route path="hit-rates" element={<HitRates />} />
        <Route path="profiler" element={<Profiler />} />
        <Route path="gamecenter" element={<GameCenter />} />
        <Route path="edgecenter" element={<EdgeCenter />} />
        <Route path="ask" element={<Ask />} />
        <Route path="angles" element={<Angles />} />
      </Route>
    </Routes>
  )
}
