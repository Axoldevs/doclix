import type { ProjectRole } from '@/types/database';

// Single source of truth for the role -> capability matrix described in
// product discussions as:
//
//                 Owner  Admin  Editor  Commenter  Viewer
//   View            x      x      x        x         x
//   Comment         x      x      x        x
//   Edit docs       x      x      x
//   Delete docs     x      x      x
//   Submit review   x      x      x
//   Publish         x      x
//   Manage members  x      x
//   Project settings x     x
//   Delete project   x
//
// "Edit docs" for an Editor means proposing a change (section_pending_
// changes), not writing `sections` directly -- see canPublish. Every
// other surface in the app should import from here rather than
// re-deriving role checks inline, so the matrix only needs to change in
// one place.

const ROLE_RANK: Record<ProjectRole, number> = {
  viewer: 0,
  commenter: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export function roleAtLeast(role: ProjectRole, min: ProjectRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Anyone signed in or not can view a public project's docs -- this only
 * governs the *team* view distinction (e.g. seeing hidden sections). */
export function canView(_role: ProjectRole): boolean {
  return true;
}

export function canComment(role: ProjectRole): boolean {
  return roleAtLeast(role, 'commenter');
}

/** Can create/edit/delete/organize documentation. For an Editor this
 * means through the review queue (section_pending_changes); for Owner/
 * Admin it means direct writes to `sections`. Both are gated the same
 * way in the UI -- the editor surface itself decides propose-vs-publish
 * based on canPublish(). */
export function canEditDocs(role: ProjectRole): boolean {
  return roleAtLeast(role, 'editor');
}

export function canDeleteDocs(role: ProjectRole): boolean {
  return roleAtLeast(role, 'editor');
}

export function canSubmitForReview(role: ProjectRole): boolean {
  return roleAtLeast(role, 'editor');
}

export function canPublish(role: ProjectRole): boolean {
  return roleAtLeast(role, 'admin');
}

export function canReview(role: ProjectRole): boolean {
  return roleAtLeast(role, 'admin');
}

export function canManageMembers(role: ProjectRole): boolean {
  return roleAtLeast(role, 'admin');
}

export function canManageProjectSettings(role: ProjectRole): boolean {
  return roleAtLeast(role, 'admin');
}

export function canDeleteProject(role: ProjectRole): boolean {
  return role === 'owner';
}

export function canTransferOwnership(role: ProjectRole): boolean {
  return role === 'owner';
}

/** Only the owner can grant/edit an admin-level role -- mirrors the
 * project_members RLS policy so the UI never offers an action the
 * database would reject. */
export function canGrantAdminRole(role: ProjectRole): boolean {
  return role === 'owner';
}

export function isTeamMember(role: ProjectRole): boolean {
  return role !== 'viewer';
}

export const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  commenter: 'Commenter',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  owner: 'Full control, including billing, ownership transfer, and deleting the project.',
  admin: 'Everything except dangerous ownership/billing actions.',
  editor: 'Can create, edit, and organize documentation, and submit it for review. Cannot publish.',
  commenter: 'Can read documentation and comment. Cannot modify pages.',
  viewer: 'Read-only access to the project.',
};

/** Roles that can be assigned to a team member. Owner is excluded --
 * ownership changes hands via transfer, not a role grant. */
export const ASSIGNABLE_ROLES: Exclude<ProjectRole, 'owner'>[] = [
  'admin',
  'editor',
  'commenter',
  'viewer',
];
