// Who may open what in the staff console. "admin" is the super admin: every section, and the only one who manages
// staff. The other roles see just their own sections. A person's role is read from their user row on every request,
// so changing it takes effect at once.
// ponytail: a fixed map in code. If the super admin ever needs to edit permissions in the UI, move it to a table.
export const STAFF_ROLES = ["admin", "reviewer", "support", "sales"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Super admin",
  reviewer: "Reviewer",
  support: "Support",
  sales: "Sales",
};

export const SECTIONS = ["overview", "queue", "leads", "support", "users", "listings", "projects", "plans", "pages", "import", "staff"] as const;
export type Section = (typeof SECTIONS)[number];

// "overview" is the dashboard: every role opens it and sees the cards for its own sections.
const ACCESS: Record<StaffRole, readonly Section[]> = {
  admin: SECTIONS,
  reviewer: ["overview", "queue", "listings", "projects", "pages"],
  support: ["overview", "support", "users"],
  sales: ["overview", "leads", "users"],
};

export const SECTION_LABEL: Record<Section, string> = {
  overview: "Dashboard",
  queue: "Review queue",
  leads: "Sales leads",
  support: "Support",
  users: "Clients",
  listings: "Properties",
  projects: "Projects",
  plans: "Plans",
  pages: "Blog and areas",
  import: "Import",
  staff: "Staff",
};

export const sectionsOf = (role: StaffRole) => ACCESS[role];

export const isStaffRole = (role: unknown): role is StaffRole => STAFF_ROLES.includes(role as StaffRole);

export const can = (role: unknown, section: Section) => isStaffRole(role) && ACCESS[role].includes(section);

/** Where each role lands in the console: its dashboard. */
const HOME: Record<StaffRole, string> = { admin: "/admin", reviewer: "/admin", support: "/admin", sales: "/admin" };
export const homeFor = (role: StaffRole) => HOME[role];
