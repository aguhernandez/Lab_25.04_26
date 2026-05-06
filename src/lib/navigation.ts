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
    labelKey: 'nav.evaluations',
    path: '/evaluations',
    icon: 'Activity',
    description: 'Metabolic tests and evaluations',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all tests | coach: tests for assigned athletes'
  },
  {
    labelKey: 'nav.userManagement',
    path: '/users',
    icon: 'UserCog',
    description: 'Import HUB profiles and assign roles',
    allowedRoles: ['admin'],
    scope: 'admin: all users and permissions'
  },
  {
    labelKey: 'nav.settings',
    path: '/settings',
    icon: 'Settings',
    description: 'System configuration',
    allowedRoles: ['admin'],
    scope: 'admin: system-wide settings'
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
    labelKey: 'nav.anthropometry',
    path: '/anthropometry',
    icon: 'Ruler',
    description: 'ISAK Level 2 anthropometry and body composition',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all data | coach: assigned athletes | athlete: personal'
  },
  {
    labelKey: 'nav.anthropometryDashboard',
    path: '/anthropometry-dashboard',
    icon: 'Ruler',
    description: 'Anthropometry analysis dashboard',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes'
  },
  {
    labelKey: 'nav.environmentalPhysiology',
    path: '/environmental-physiology',
    icon: 'Thermometer',
    description: 'Hydration, heat adaptation, and thermoregulation',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes',
  },
  {
    labelKey: 'nav.labSession',
    path: '/lab',
    icon: 'FlaskConical',
    description: 'Guided metabolic lab workflow',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes',
  },
  {
    labelKey: 'nav.forceVelocity',
    path: '/force-velocity',
    icon: 'Zap',
    description: 'F-V profiling from encoder, video, or manual data',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes',
  },
  {
    labelKey: 'nav.referencePopulations',
    path: '/reference-populations',
    icon: 'BookOpen',
    description: 'Manage VO2max and anthropometry reference populations',
    allowedRoles: ['admin'],
    scope: 'admin: manage custom reference populations',
  },
  {
    labelKey: 'nav.reports',
    path: '/reports',
    icon: 'FileDown',
    description: 'Generate customizable PDF reports',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all athletes | coach: assigned athletes | athlete: personal',
  },
  {
    labelKey: 'nav.simulation',
    path: '/simulation',
    icon: 'TrendingUp',
    description: 'Race and altitude performance simulation',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all athletes | coach: assigned athletes | athlete: personal',
  }
];

export function getMenuForRole(userRole: 'admin' | 'coach' | 'athlete'): MenuItem[] {
  return NAVIGATION_MENU.filter(item => item.allowedRoles.includes(userRole));
}

export function canAccessRoute(userRole: 'admin' | 'coach' | 'athlete', path: string): boolean {
  const menuItem = NAVIGATION_MENU.find(item => item.path === path);
  if (!menuItem) return false;
  return menuItem.allowedRoles.includes(userRole);
}
