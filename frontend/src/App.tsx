import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Stores from './pages/Stores';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Stock from './pages/Stock';
import Customers from './pages/Customers';
import Invoices from './pages/Invoices';
import StoreSettings from './pages/StoreSettings';
import Vehicles from './pages/Vehicles';
import Mechanics from './pages/Mechanics';
import WorkOrders from './pages/WorkOrders';
import Appointments from './pages/Appointments';
import Garage from './pages/Garage';
import Leads from './pages/Leads';
import Interactions from './pages/Interactions';
import Reminders from './pages/Reminders';
import Billing from './pages/Billing';
import Sales from './pages/Sales';
import Faq from './pages/Faq';
import Pricing from './pages/Pricing';
import AdminOverview from './pages/AdminOverview';
import AdminStores from './pages/AdminStores';
import AdminUsers from './pages/AdminUsers';
import AdminSubscriptions from './pages/AdminSubscriptions';
import AdminPayments from './pages/AdminPayments';
import AdminRoute from './components/AdminRoute';
import AppLayout from './layouts/AppLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
<Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/stores" element={<Stores />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<StoreSettings />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/mechanics" element={<Mechanics />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/garage" element={<Garage />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/interactions" element={<Interactions />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/admin" element={<AdminRoute />}>
            <Route index element={<AdminOverview />} />
            <Route path="stores" element={<AdminStores />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="payments" element={<AdminPayments />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </BrowserRouter>
  );
}

export default App;