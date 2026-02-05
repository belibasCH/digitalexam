import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useAuthInitialized } from '../../services/auth/authSlice';
import { Center, Loader } from '@mantine/core';

export const ProtectedRoutes = () => {
  const user = useAuth();
  const initialized = useAuthInitialized();
  const location = useLocation();

  if (!initialized) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
