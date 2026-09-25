// Staff roles from least to most access: Tutor < Coordinator < Admin < Super Admin.
// Coordinators and up manage the workspace; Admins and up manage logins below their own role.
export const ROLE_RANK = { tutor: 0, coordinator: 1, admin: 2, superadmin: 3 };
export const ROLE_LABELS = { tutor: "Tutor", coordinator: "Coordinator", admin: "Admin", superadmin: "Super Admin" };
const rank = (role) => ROLE_RANK[role] ?? -1;
export const canManage = (session) => rank(session?.role) >= ROLE_RANK.coordinator;
export const canManageLogins = (session) => rank(session?.role) >= ROLE_RANK.admin;
// Roles this person may assign in the staff list: their own and below (Super Admin: all).
export const assignableRoles = (session) => Object.keys(ROLE_RANK).filter((role) => session?.role === "superadmin" || rank(role) <= rank(session?.role));
export const roleLabel = (role) => ROLE_LABELS[role] || "Tutor";
