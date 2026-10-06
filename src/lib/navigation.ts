export interface MenuItem {
  labelKey: string;
  path: string;
  icon: string;
  description: string;
  allowedRoles: ('admin' | 'coach' | 'athlete')[];
  scope: string;
  section?: string;
}

export const NAVIGATION_MENU: MenuItem[] = [
  {
    labelKey: 'nav.dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    description: 'Overview and metrics',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all data | coach: assigned athletes | athlete: personal'
  },
  {
    labelKey: 'nav.athletes',
    path: '/athletes',
    icon: 'Users',
    description: 'Manage athlete profiles',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes only'
  },
  {
    labelKey: 'nav.physiologyProfile',
    path: '/physiology-profile',
    icon: 'User',
    description: 'Unified athlete physiology profile',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all athletes | coach: assigned athletes | athlete: personal',
    section: 'Profile',
  },
  {
    labelKey: 'nav.anthropometry',
    path: '/anthropometry',
    icon: 'Ruler',
    description: 'ISAK Level 2 anthropometry and body composition',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all data | coach: assigned athletes | athlete: personal',
    section: 'Labs',
  },
  {
    labelKey: 'nav.metabolicLab',
    path: '/lab',
    icon: 'FlaskConical',
    description: 'Metabolic lab testing and analysis',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes',
    section: 'Labs',
  },
  {
    labelKey: 'nav.hydrationHeat',
    path: '/environmental-physiology',
    icon: 'Thermometer',
    description: 'Hydration, heat adaptation, and thermoregulation',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes',
    section: 'Labs',
  },
  {
    labelKey: 'nav.neuromuscularLab',
    path: '/neuromuscular',
    icon: 'Zap',
    description: 'Neuromuscular assessment: F-V profiling, jump, sprint, strength',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes',
    section: 'Labs',
  },
  {
    labelKey: 'nav.biochemicalLab',
    path: '/biochemical',
    icon: 'Droplets',
    description: 'Biochemical markers and blood analysis',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes',
    section: 'Labs',
  },
  {
    labelKey: 'nav.healthFlags',
    path: '/health-flags',
    icon: 'Flame',
    description: 'Cross-laboratory health alerts',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes',
    section: 'Monitoring',
  },
  {
    labelKey: 'nav.reports',
    path: '/reports',
    icon: 'FileDown',
    description: 'Generate customizable PDF reports',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all athletes | coach: assigned athletes | athlete: personal',
    section: 'Management',
  },
  {
    labelKey: 'nav.simulation',
    path: '/simulation',
    icon: 'TrendingUp',
    description: 'Race and altitude performance simulation',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all athletes | coach: assigned athletes | athlete: personal',
    section: 'Management',
  },
  {
    labelKey: 'nav.myProfile',
    path: '/profile',
    icon: 'User',
    description: 'Personal profile and information',
    allowedRoles: ['athlete'],
    scope: 'athlete: own profile only'
  },
  {
    labelKey: 'nav.myEvaluations',
    path: '/my-evaluations',
    icon: 'FileText',
    description: 'Personal test results',
    allowedRoles: ['athlete'],
    scope: 'athlete: own tests only'
  },
  {
    labelKey: 'nav.userManagement',
    path: '/users',
    icon: 'UserCog',
    description: 'Import HUB profiles and assign roles',
    allowedRoles: ['admin'],
    scope: 'admin: all users and permissions',
    section: 'Admin',
  },
  {
    labelKey: 'nav.referencePopulations',
    path: '/reference-populations',
    icon: 'BookOpen',
    description: 'Manage VO2max and anthropometry reference populations',
    allowedRoles: ['admin'],
    scope: 'admin: manage custom reference populations',
    section: 'Admin',
  },
  {
    labelKey: 'nav.settings',
    path: '/settings',
    icon: 'Settings',
    description: 'System configuration',
    allowedRoles: ['admin'],
    scope: 'admin: system-wide settings',
    section: 'Admin',
  },
];

export function getMenuForRole(userRole: 'admin' | 'coach' | 'athlete'): MenuItem[] {
  return NAVIGATION_MENU.filter(item => item.allowedRoles.includes(userRole));
}

export function canAccessRoute(userRole: 'admin' | 'coach' | 'athlete', path: string): boolean {
  const menuItem = NAVIGATION_MENU.find(item => item.path === path);
  if (!menuItem) return false;
  return menuItem.allowedRoles.includes(userRole);
}
