import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500 text-sm">Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user?.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}