import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { SetupNotice } from './components/SetupNotice'
import { isSupabaseConfigured } from './lib/supabase'
import { JoinPage } from './pages/JoinPage'
import { LoginPage } from './pages/LoginPage'
import { TripPage } from './pages/TripPage'
import { TripsPage } from './pages/TripsPage'

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <TripsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/trips/:tripId"
              element={
                <RequireAuth>
                  <TripPage />
                </RequireAuth>
              }
            />
            <Route
              path="/join/:token"
              element={
                <RequireAuth>
                  <JoinPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
