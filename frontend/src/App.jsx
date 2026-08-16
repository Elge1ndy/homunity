import { lazy, Suspense, useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Spinner from './components/Spinner.jsx'
import PWAUpdate from './components/PWAUpdate.jsx'
import LicenseModal from './components/LicenseModal.jsx'
import api from './api'

const Login = lazy(() => import('./pages/Login.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Students = lazy(() => import('./pages/Students.jsx'))
const StudentDetails = lazy(() => import('./pages/StudentDetails.jsx'))
const Archived = lazy(() => import('./pages/Archived.jsx'))
const Rooms = lazy(() => import('./pages/Rooms.jsx'))
const Beds = lazy(() => import('./pages/Beds.jsx'))
const Properties = lazy(() => import('./pages/Properties.jsx'))
const PropertyDetails = lazy(() => import('./pages/PropertyDetails.jsx'))
const Payments = lazy(() => import('./pages/Payments.jsx'))
const FinanceDashboard = lazy(() => import('./pages/FinanceDashboard.jsx'))
const Calendar = lazy(() => import('./pages/Calendar.jsx'))
const SummerCourses = lazy(() => import('./pages/SummerCourses.jsx'))
const Bookings = lazy(() => import('./pages/Bookings.jsx'))
const Invoices = lazy(() => import('./pages/Invoices.jsx'))
const Reports = lazy(() => import('./pages/Reports.jsx'))
const Deposits = lazy(() => import('./pages/Deposits.jsx'))
const Housing = lazy(() => import('./pages/Housing.jsx'))
const Notifications = lazy(() => import('./pages/Notifications.jsx'))
const ActivityLog = lazy(() => import('./pages/ActivityLog.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PageSpinner() {
  return (
    <div className="h-full flex items-center justify-center py-20">
      <Spinner />
    </div>
  )
}

export default function App() {
  const [licensed, setLicensed] = useState(false)
  const [checkingLicense, setCheckingLicense] = useState(true)

  useEffect(() => {
    api.get('/license/status').then((r) => {
      setLicensed(r.data.licensed)
      setCheckingLicense(false)
    }).catch(() => setCheckingLicense(false))
  }, [])

  if (checkingLicense) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!licensed) {
    return <LicenseModal onActivated={() => setLicensed(true)} />
  }

  return (
    <>
    <PWAUpdate />
    <Suspense fallback={<PageSpinner />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:id" element={<StudentDetails />} />
        <Route path="archived" element={<Archived />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="beds" element={<Beds />} />
        <Route path="properties" element={<Properties />} />
        <Route path="properties/:id" element={<PropertyDetails />} />
        <Route path="payments" element={<Payments />} />
        <Route path="finance" element={<FinanceDashboard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="summer-courses" element={<SummerCourses />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="reports" element={<Reports />} />
        <Route path="deposits" element={<Deposits />} />
        <Route path="housing" element={<Housing />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    </>
  )
}
