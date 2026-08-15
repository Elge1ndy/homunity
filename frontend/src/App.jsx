import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Students from './pages/Students.jsx'
import StudentDetails from './pages/StudentDetails.jsx'
import Archived from './pages/Archived.jsx'
import Rooms from './pages/Rooms.jsx'
import Beds from './pages/Beds.jsx'
import Properties from './pages/Properties.jsx'
import PropertyDetails from './pages/PropertyDetails.jsx'
import Payments from './pages/Payments.jsx'
import FinanceDashboard from './pages/FinanceDashboard.jsx'
import Calendar from './pages/Calendar.jsx'
import SummerCourses from './pages/SummerCourses.jsx'
import Bookings from './pages/Bookings.jsx'
import Invoices from './pages/Invoices.jsx'
import Reports from './pages/Reports.jsx'
import Deposits from './pages/Deposits.jsx'
import Housing from './pages/Housing.jsx'
import Notifications from './pages/Notifications.jsx'
import ActivityLog from './pages/ActivityLog.jsx'
import Settings from './pages/Settings.jsx'
import Spinner from './components/Spinner.jsx'
import PWAUpdate from './components/PWAUpdate.jsx'

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

export default function App() {
  return (
    <>
    <PWAUpdate />
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
    </>
  )
}
