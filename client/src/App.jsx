import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Cars from './pages/Cars';
import CarDetail from './pages/CarDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import MyBookings from './pages/MyBookings';
import AdminDashboard from './pages/admin/Dashboard';
import AddCar from './pages/admin/AddCar';
import ManageCars from './pages/admin/ManageCars';
import ManageBookings from './pages/admin/ManageBookings';
import ManageClients from './pages/admin/ManageClients';
import ClientDashboard from './pages/Dashboard';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<><Navbar /><Home /></>} />
            <Route path="/cars" element={<><Navbar /><Cars /></>} />
            <Route path="/cars/:id" element={<><Navbar /><CarDetail /></>} />
            <Route path="/login" element={<><Navbar /><Login /></>} />
            <Route path="/register" element={<><Navbar /><Register /></>} />

            {/* Client-only Routes */}
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute allowedRoles={['user']}>
                  <><Navbar /><MyBookings /></>
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['user']}>
                  <><Navbar /><ClientDashboard /></>
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
              path="/admin/manage-clients"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageClients />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
