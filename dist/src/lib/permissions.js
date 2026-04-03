"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_PERMISSIONS_SET = exports.FLAT_PERMISSIONS = exports.PERMISSIONS_GROUPS = void 0;
exports.isValidPermission = isValidPermission;
exports.getPermissionsGroups = getPermissionsGroups;
// Central source of truth for permission definitions.
exports.PERMISSIONS_GROUPS = {
    Dashboard: ['Create', 'Read', 'Update', 'Delete'],
    'Scan QR': ['Create', 'Read', 'Update', 'Delete'],
    Events: ['Create', 'Read', 'Update', 'Delete'],
    Reports: ['Create', 'Read', 'Update', 'Delete'],
    'User Registration': ['Create', 'Read', 'Update', 'Delete'],
    'User Management': ['Create', 'Read', 'Update', 'Delete'],
    'Role Management': ['Create', 'Read', 'Update', 'Delete'],
    'Staff Management': ['Create', 'Read', 'Update', 'Delete'],
};
exports.FLAT_PERMISSIONS = Object.entries(exports.PERMISSIONS_GROUPS).flatMap(([cat, actions]) => actions.map(a => `${cat}:${a}`));
exports.VALID_PERMISSIONS_SET = new Set(exports.FLAT_PERMISSIONS);
function isValidPermission(perm) {
    return exports.VALID_PERMISSIONS_SET.has(perm);
}
function getPermissionsGroups() {
    return exports.PERMISSIONS_GROUPS;
}
