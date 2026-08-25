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
import ManageConsignments from './pages/admin/ManageConsignments';
import ClientDashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ConsignmentRegister from './pages/ConsignmentRegister';
import ConsignorDashboard from './pages/consignor/ConsignorDashboard';
import AddVehicle from './pages/consignor/AddVehicle';

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
            <Route path="/consignment/register" element={<><Navbar /><ConsignmentRegister /></>} />

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
              path="/admin/manage-bookings"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ManageBookings />
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
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
