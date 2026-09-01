import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { UIFeedbackProvider } from './context/UIFeedbackContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Cars from './pages/Cars';
import CarDetail from './pages/CarDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import MyBookings from './pages/MyBookings';
import RateBookings from './pages/RateBookings';
import MyFavorites from './pages/MyFavorites';
import Profile from './pages/Profile';
import ConsignmentRegister from './pages/ConsignmentRegister';
import Help from './pages/Help';
import NotFound from './pages/NotFound';

// Admin and consignor pages are only ever reached by those roles, and
// together they're the bulk of the app's code — lazy-loading them keeps
// the public-facing bundle (Home/Cars/Car Detail) small for everyone else.
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const AddCar = lazy(() => import('./pages/admin/AddCar'));
const ManageCars = lazy(() => import('./pages/admin/ManageCars'));
const ManageArchivedCars = lazy(() => import('./pages/admin/ManageArchivedCars'));
const ManageBookings = lazy(() => import('./pages/admin/ManageBookings'));
const BookingsCalendar = lazy(() => import('./pages/admin/BookingsCalendar'));
const ManageClients = lazy(() => import('./pages/admin/ManageClients'));
const ManageConsignments = lazy(() => import('./pages/admin/ManageConsignments'));
const ManageAvailabilityRequests = lazy(() => import('./pages/admin/ManageAvailabilityRequests'));
const RateClients = lazy(() => import('./pages/admin/RateClients'));
const ManageReviews = lazy(() => import('./pages/admin/ManageReviews'));
const ConsignorDashboard = lazy(() => import('./pages/consignor/ConsignorDashboard'));
const AddVehicle = lazy(() => import('./pages/consignor/AddVehicle'));

const PageLoading = () => (
  <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
    Loading...
  </div>
);

function App() {
  return (
    <MotionConfig reducedMotion="user">
    <ThemeProvider>
      <UIFeedbackProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoading />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<><Navbar /><Home /></>} />
            <Route path="/cars" element={<><Navbar /><Cars /></>} />
            <Route path="/cars/:id" element={<><Navbar /><CarDetail /></>} />
            <Route path="/login" element={<><Navbar /><Login /></>} />
            <Route path="/register" element={<><Navbar /><Register /></>} />
            <Route path="/consignment/register" element={<><Navbar /><ConsignmentRegister /></>} />
            <Route path="/help" element={<><Navbar /><Help /></>} />

            {/* Client-only Routes */}
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute allowedRoles={['user']}>
                  <><Navbar /><MyBookings /></>
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard" element={<Navigate to="/my-bookings" replace />} />
            <Route
              path="/my-bookings/rate"
              element={
                <ProtectedRoute allowedRoles={['user']}>
                  <><Navbar /><RateBookings /></>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-favorites"
              element={
                <ProtectedRoute allowedRoles={['user']}>
                  <><Navbar /><MyFavorites /></>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <><Navbar /><Profile /></>
                </ProtectedRoute>
              }
            />

            {/* Consignor-only Routes */}
            <Route
              path="/consignor"
              element={
                <ProtectedRoute allowedRoles={['consignor']}>
                  <><Navbar /><ConsignorDashboard /></>
                </ProtectedRoute>
              }
            />
            <Route
              path="/consignor/add-vehicle"
              element={
                <ProtectedRoute allowedRoles={['consignor']}>
                  <><Navbar /><AddVehicle /></>
                </ProtectedRoute>
              }
            />

            {/* Admin-only Routes (AdminLayout renders its own top bar/sidebar) */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/add-car"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AddCar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manage-cars"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageCars />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/archived-cars"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageArchivedCars />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manage-bookings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/bookings-calendar"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <BookingsCalendar />
                </ProtectedRoute>
              }
            />
              <Route
              path="/admin/manage-clients"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manage-consignments"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageConsignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/availability-requests"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageAvailabilityRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rate-clients"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <RateClients />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manage-reviews"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageReviews />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<><Navbar /><NotFound /></>} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </UIFeedbackProvider>
    </ThemeProvider>
    </MotionConfig>
  );
}

export default App;
