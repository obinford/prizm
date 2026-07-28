import { Navigate, Routes, Route, useLocation } from 'react-router'
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
import Profiler from '@/pages/Profiler'
import Angles from '@/pages/Angles'
import Glossary from '@/pages/Glossary'

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
        {/* Gamecenter, Edgecenter and Hit Rates are dashboard tabs now, not
            pages. These redirects keep every existing deep link working —
            "See in Hit Rates →", "EdgeCenter →" and any bookmark. */}
        <Route path="hit-rates" element={<Navigate to="/dashboard?tab=starters&view=hitrates" replace />} />
        <Route path="gamecenter" element={<Navigate to="/dashboard?tab=gamecenter" replace />} />
        <Route path="edgecenter" element={<Navigate to="/dashboard?tab=edgecenter" replace />} />
        <Route path="profiler" element={<Profiler />} />
        {/* Removed: /ask "Ask Prizm" (src/pages/Ask.tsx + src/pages/ask/* +
            src/data/askResponses.ts). It was a keyword-matched canned-answer
            surface serving invented statistics under an AI label, with no
            model behind it — rule 1 violation. Deleted, not redirected. */}
        <Route path="angles" element={<Angles />} />
        <Route path="glossary" element={<Glossary />} />
      </Route>
    </Routes>
  )
}
