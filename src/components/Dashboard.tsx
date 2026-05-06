import { useAuth } from '../contexts/AuthContext';
import AthleteDashboard from './dashboard/AthleteDashboard';
import CoachDashboard from './dashboard/CoachDashboard';
import AdminDashboard from './dashboard/AdminDashboard';

export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'coach';

  if (role === 'athlete') return <AthleteDashboard />;
  if (role === 'admin') return <AdminDashboard />;
  return <CoachDashboard />;
}
