import { useAuth } from '../contexts/AuthContext';
import AthleteDashboard from './dashboard/AthleteDashboard';
import CoachDashboard from './dashboard/CoachDashboard';
import AdminDashboard from './dashboard/AdminDashboard';
import { Athlete } from '../types';

interface DashboardProps {
  onViewAthlete?: (athlete: Athlete) => void;
}

export default function Dashboard({ onViewAthlete }: DashboardProps) {
  const { profile } = useAuth();
  const role = profile?.role ?? 'coach';

  if (role === 'athlete') return <AthleteDashboard />;
  if (role === 'admin') return <AdminDashboard />;
  return <CoachDashboard onViewAthlete={onViewAthlete} />;
}
