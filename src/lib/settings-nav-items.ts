
export interface SettingsNavItem {
  title: string;
  path: string;
  permission: string;
}

// `path` is portal-relative — prefix with the portal's basePath
// ('/super-admin' or '/dashboard') to get the full route.
export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { title: 'User Management', path: '/users', permission: 'Users:Read' },
  { title: 'User Registration', path: '/users/new', permission: 'Users:Create' },
  { title: 'Role Management', path: '/roles', permission: 'Roles:Read' },
  { title: 'Staff Management', path: '/staff', permission: 'Staff:Read' },
  { title: 'Organization', path: '/organization', permission: 'Organization:Read' },
  { title: 'Homepage Carousel', path: '/homeads', permission: 'Homepage Carousel:Read' },
];
