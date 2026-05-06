# Navigation Menu Specification - Metabolic Lab

## Role-Based Menu Structure

### ADMIN Role
Full system access with administrative capabilities.

| Menu Item | Navigation Path | Description | Access Scope |
|-----------|----------------|-------------|--------------|
| Dashboard | `/dashboard` | System overview: total athletes, tests, recent activity, system metrics | All data across system |
| Athletes | `/athletes` | Browse and manage all athletes (HUB-linked + local profiles) | All athletes |
| Evaluations | `/evaluations` | View and manage all metabolic tests and evaluations | All tests |
| User Management | `/users` | Import HUB profiles, assign roles (admin/coach/athlete), manage permissions | All users |
| Settings | `/settings` | System configuration, environment variables, app preferences | System-wide |

### COACH Role
Limited to assigned athletes and their data.

| Menu Item | Navigation Path | Description | Access Scope |
|-----------|----------------|-------------|--------------|
| Dashboard | `/dashboard` | Summary of assigned athletes: recent tests, performance trends, alerts | Assigned athletes only |
| Athletes | `/athletes` | View and manage only assigned athletes | Assigned athletes only |
| Evaluations | `/evaluations` | View and create tests for assigned athletes | Tests for assigned athletes |
| Reporting | `/reporting` | Statistics, charts, and analysis for assigned athletes | Assigned athletes data |

### ATHLETE Role
Personal data only.

| Menu Item | Navigation Path | Description | Access Scope |
|-----------|----------------|-------------|--------------|
| Dashboard | `/dashboard` | Personal summary: recent tests, performance overview, personal stats | Own data only |
| My Profile | `/profile` | View and update personal information and anthropometric data | Own profile only |
| My Evaluations | `/my-evaluations` | View own metabolic test results and history | Own tests only |

---

## Menu Implementation Object

```typescript
interface MenuItem {
  label: string;
  path: string;
  icon: string; // Icon component name
  description: string;
  allowedRoles: ('admin' | 'coach' | 'athlete')[];
  scope: string;
}

const NAVIGATION_MENU: MenuItem[] = [
  // ADMIN-ONLY ITEMS
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    description: 'System overview and metrics',
    allowedRoles: ['admin', 'coach', 'athlete'],
    scope: 'admin: all data | coach: assigned athletes | athlete: personal'
  },
  {
    label: 'Athletes',
    path: '/athletes',
    icon: 'Users',
    description: 'Manage athlete profiles',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all athletes | coach: assigned athletes only'
  },
  {
    label: 'Evaluations',
    path: '/evaluations',
    icon: 'Activity',
    description: 'Metabolic tests and evaluations',
    allowedRoles: ['admin', 'coach'],
    scope: 'admin: all tests | coach: tests for assigned athletes'
  },
  {
    label: 'User Management',
    path: '/users',
    icon: 'UserCog',
    description: 'Import HUB profiles and assign roles',
    allowedRoles: ['admin'],
    scope: 'admin: all users and permissions'
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: 'Settings',
    description: 'System configuration',
    allowedRoles: ['admin'],
    scope: 'admin: system-wide settings'
  },

  // COACH-ONLY ITEMS
  {
    label: 'Reporting',
    path: '/reporting',
    icon: 'TrendingUp',
    description: 'Statistics and analysis',
    allowedRoles: ['coach'],
    scope: 'coach: assigned athletes data only'
  },

  // ATHLETE-ONLY ITEMS
  {
    label: 'My Profile',
    path: '/profile',
    icon: 'User',
    description: 'Personal profile and information',
    allowedRoles: ['athlete'],
    scope: 'athlete: own profile only'
  },
  {
    label: 'My Evaluations',
    path: '/my-evaluations',
    icon: 'FileText',
    description: 'Personal test results',
    allowedRoles: ['athlete'],
    scope: 'athlete: own tests only'
  }
];
```

---

## Menu Rendering Logic

```typescript
/**
 * Filter menu items based on user role
 */
function getMenuForRole(userRole: 'admin' | 'coach' | 'athlete'): MenuItem[] {
  return NAVIGATION_MENU.filter(item => item.allowedRoles.includes(userRole));
}

/**
 * Example usage:
 */
// Admin sees: Dashboard, Athletes, Evaluations, User Management, Settings
const adminMenu = getMenuForRole('admin');

// Coach sees: Dashboard, Athletes, Evaluations, Reporting
const coachMenu = getMenuForRole('coach');

// Athlete sees: Dashboard, My Profile, My Evaluations
const athleteMenu = getMenuForRole('athlete');
```

---

## Page Access Control Matrix

| Page/Route | Admin | Coach | Athlete | Data Scope |
|------------|-------|-------|---------|------------|
| `/dashboard` | ✅ | ✅ | ✅ | Admin: all / Coach: assigned / Athlete: personal |
| `/athletes` | ✅ | ✅ | ❌ | Admin: all / Coach: assigned only |
| `/athletes/:id` | ✅ | ✅* | ✅* | *Coach: if assigned / *Athlete: if own ID |
| `/evaluations` | ✅ | ✅ | ❌ | Admin: all / Coach: assigned athletes |
| `/evaluations/:id` | ✅ | ✅* | ✅* | *Coach: if athlete assigned / *Athlete: if own test |
| `/users` | ✅ | ❌ | ❌ | Admin only |
| `/settings` | ✅ | ❌ | ❌ | Admin only |
| `/reporting` | ✅ | ✅ | ❌ | Admin: all / Coach: assigned athletes |
| `/profile` | ✅* | ✅* | ✅ | *Admin/Coach: own profile / Athlete: own profile |
| `/my-evaluations` | ❌ | ❌ | ✅ | Athlete: own tests only |

---

## Submenu Structure (Optional)

If you want to organize Athletes into subcategories:

### ADMIN - Athletes Menu
```typescript
{
  label: 'Athletes',
  path: '/athletes',
  icon: 'Users',
  allowedRoles: ['admin'],
  submenu: [
    {
      label: 'All Athletes',
      path: '/athletes',
      description: 'View all athlete profiles'
    },
    {
      label: 'HUB Athletes',
      path: '/athletes?source=hub',
      description: 'Athletes synced from HUB'
    },
    {
      label: 'Local Athletes',
      path: '/athletes?source=local',
      description: 'Athletes created locally'
    }
  ]
}
```

---

## Security Enforcement

### Database-Level (RLS Policies)
```sql
-- Athletes table: COACH can only see assigned athletes
CREATE POLICY "Coaches can view assigned athletes"
  ON athletes FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'admin' OR
    (auth.jwt()->>'role' = 'coach' AND id IN (
      SELECT athlete_id FROM athlete_assignments WHERE coach_id = auth.uid()
    )) OR
    (auth.jwt()->>'role' = 'athlete' AND id = auth.uid())
  );

-- Tests table: Similar scoping
CREATE POLICY "Role-based test access"
  ON tests FOR SELECT
  TO authenticated
  USING (
    auth.jwt()->>'role' = 'admin' OR
    (auth.jwt()->>'role' = 'coach' AND athlete_id IN (
      SELECT athlete_id FROM athlete_assignments WHERE coach_id = auth.uid()
    )) OR
    (auth.jwt()->>'role' = 'athlete' AND athlete_id = auth.uid())
  );
```

### Frontend Route Protection
```typescript
// Route guard component
function ProtectedRoute({
  allowedRoles,
  children
}: {
  allowedRoles: ('admin' | 'coach' | 'athlete')[],
  children: React.ReactNode
}) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
}

// Usage in routes
<ProtectedRoute allowedRoles={['admin']}>
  <UserManagement />
</ProtectedRoute>
```

---

## Navigation Component Example

```typescript
function Navigation() {
  const { user } = useAuth();
  const menuItems = getMenuForRole(user.role);

  return (
    <nav className="navigation">
      {menuItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className="nav-item"
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
```

---

## Key Rules Summary

1. ✅ Menu items are filtered by role automatically
2. ✅ Each role has clear, distinct menu access
3. ✅ No duplicate functionality between menus
4. ✅ Dashboard adapts content based on role
5. ✅ Security enforced at database AND frontend levels
6. ✅ "Metabolic Lab" appears as header/logo only, not menu item
7. ✅ Athlete-specific naming: "My Profile", "My Evaluations"
8. ✅ All menu items map to real functional pages
