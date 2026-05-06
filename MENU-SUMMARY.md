# Metabolic Lab - Navigation Menu Summary

## ADMIN Menu
| Menu Item | Path | Icon | Access |
|-----------|------|------|--------|
| Dashboard | `/dashboard` | LayoutDashboard | All system data |
| Athletes | `/athletes` | Users | All athletes (HUB + local) |
| Evaluations | `/evaluations` | Activity | All tests |
| User Management | `/users` | UserCog | All users and roles |
| Settings | `/settings` | Settings | System configuration |

## COACH Menu
| Menu Item | Path | Icon | Access |
|-----------|------|------|--------|
| Dashboard | `/dashboard` | LayoutDashboard | Assigned athletes summary |
| Athletes | `/athletes` | Users | Assigned athletes only |
| Evaluations | `/evaluations` | Activity | Tests for assigned athletes |
| Reporting | `/reporting` | TrendingUp | Statistics for assigned athletes |

## ATHLETE Menu
| Menu Item | Path | Icon | Access |
|-----------|------|------|--------|
| Dashboard | `/dashboard` | LayoutDashboard | Personal summary |
| My Profile | `/profile` | User | Own profile only |
| My Evaluations | `/my-evaluations` | FileText | Own test results |

---

## Quick Reference

**ADMIN sees:** 5 menu items (full system access)
**COACH sees:** 4 menu items (assigned athletes scope)
**ATHLETE sees:** 3 menu items (personal data only)

---

## Implementation Files Created

1. `/src/lib/navigation.ts` - Menu configuration and helper functions
2. `NAVIGATION-MENU-SPEC.md` - Complete technical specification
3. This file - Quick summary reference

---

## Next Steps

To implement this navigation:

1. Import menu structure from `/src/lib/navigation.ts`
2. Create navigation component that filters by user role
3. Add route protection middleware
4. Implement role-based data filtering in each view
5. Test access control for all three roles
