export type ProjectVisibility = 'public' | 'private' | 'password';

/** Explicitly-stored roles. 'owner' is derived from projects.owner_id and
 * never stored in project_members; 'viewer' is the implicit default for
 * any signed-in user with no row and is also never stored. */
export type StoredProjectRole = 'admin' | 'editor' | 'commenter' | 'viewer';
/** Full effective role, including the two roles that are never stored
 * as a project_members row ('owner' and the default 'viewer'). This is
 * what project_role_for() in the DB returns and what the client works
 * with everywhere permission checks happen. */
export type ProjectRole = 'owner' | StoredProjectRole;

export type PendingChangeStatus = 'pending' | 'approved' | 'rejected';
export type NotificationKind =
  | 'mention'
  | 'reply'
  | 'change_submitted'
  | 'change_approved'
  | 'change_rejected'
  | 'suggestion_submitted';

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          icon_url: string | null;
          owner_id: string;
          visibility: ProjectVisibility;
          password_hash: string | null;
          accent_color: string | null;
          custom_footer: string | null;
          hide_branding: boolean;
          custom_head_snippet: string | null;
          og_image_url: string | null;
          sitemap_excluded: boolean;
          enabled_languages: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          icon_url?: string | null;
          owner_id: string;
          visibility?: ProjectVisibility;
          password_hash?: string | null;
          accent_color?: string | null;
          custom_footer?: string | null;
          hide_branding?: boolean;
          custom_head_snippet?: string | null;
          og_image_url?: string | null;
          sitemap_excluded?: boolean;
          enabled_languages?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          icon_url?: string | null;
          owner_id?: string;
          visibility?: ProjectVisibility;
          password_hash?: string | null;
          accent_color?: string | null;
          custom_footer?: string | null;
          hide_branding?: boolean;
          custom_head_snippet?: string | null;
          og_image_url?: string | null;
          sitemap_excluded?: boolean;
          enabled_languages?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
      sections: {
        Row: {
          id: string;
          project_id: string;
          slug: string;
          title: string;
          content: string;
          position: number;
          hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          slug: string;
          title: string;
          content?: string;
          position: number;
          hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          slug?: string;
          title?: string;
          content?: string;
          position?: number;
          hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      section_revisions: {
        Row: {
          id: string;
          section_id: string;
          title: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          title: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          section_id?: string;
          title?: string;
          content?: string;
          created_at?: string;
        };
      };
      section_comments: {
        Row: {
          id: string;
          section_id: string;
          author_id: string;
          author_name: string;
          body: string;
          resolved: boolean;
          parent_comment_id: string | null;
          mentioned_user_ids: string[];
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          section_id: string;
          author_id: string;
          author_name?: string;
          body: string;
          resolved?: boolean;
          parent_comment_id?: string | null;
          mentioned_user_ids?: string[];
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          section_id?: string;
          author_id?: string;
          author_name?: string;
          body?: string;
          resolved?: boolean;
          parent_comment_id?: string | null;
          mentioned_user_ids?: string[];
          created_at?: string;
          updated_at?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          email: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          email: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          email?: string;
          updated_at?: string;
        };
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role: StoredProjectRole;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          role?: StoredProjectRole;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role?: StoredProjectRole;
          invited_by?: string | null;
          created_at?: string;
        };
      };
      project_invites: {
        Row: {
          id: string;
          project_id: string;
          email: string;
          role: StoredProjectRole;
          invited_by: string;
          token: string;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          email: string;
          role?: StoredProjectRole;
          invited_by: string;
          token: string;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          email?: string;
          role?: StoredProjectRole;
          invited_by?: string;
          token?: string;
          created_at?: string;
          expires_at?: string;
        };
      };
      section_pending_changes: {
        Row: {
          id: string;
          project_id: string;
          section_id: string | null;
          proposed_title: string;
          proposed_content: string;
          proposed_slug: string | null;
          is_new_section: boolean;
          submitted_by: string;
          status: PendingChangeStatus;
          reviewed_by: string | null;
          review_note: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          section_id?: string | null;
          proposed_title: string;
          proposed_content: string;
          proposed_slug?: string | null;
          is_new_section?: boolean;
          submitted_by: string;
          status?: PendingChangeStatus;
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          section_id?: string | null;
          proposed_title?: string;
          proposed_content?: string;
          proposed_slug?: string | null;
          is_new_section?: boolean;
          submitted_by?: string;
          status?: PendingChangeStatus;
          reviewed_by?: string | null;
          review_note?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          kind: NotificationKind;
          actor_id: string | null;
          actor_name: string | null;
          message: string;
          link_path: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          kind: NotificationKind;
          actor_id?: string | null;
          actor_name?: string | null;
          message: string;
          link_path?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          kind?: NotificationKind;
          actor_id?: string | null;
          actor_name?: string | null;
          message?: string;
          link_path?: string | null;
          read?: boolean;
          created_at?: string;
        };
      };
      section_suggestions: {
        Row: {
          id: string;
          section_id: string;
          project_id: string;
          body: string;
          suggester_name: string | null;
          suggester_email: string | null;
          status: PendingChangeStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          project_id: string;
          body: string;
          suggester_name?: string | null;
          suggester_email?: string | null;
          status?: PendingChangeStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          section_id?: string;
          project_id?: string;
          body?: string;
          suggester_name?: string | null;
          suggester_email?: string | null;
          status?: PendingChangeStatus;
          created_at?: string;
        };
      };
    };
  };
}

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
/**
 * The Project shape used throughout the client app. Deliberately omits
 * password_hash -- the client reads projects through the projects_public
 * view (see schema.sql) which doesn't return that column at all, and
 * useProject's update path explicitly re-selects columns rather than
 * '*' for the same reason. This type documents and enforces that at the
 * TypeScript level: nothing in client code can accidentally read
 * project.password_hash and, say, log it or pass it somewhere it
 * shouldn't go, because the type doesn't have the field.
 */
export type Project = Omit<ProjectRow, 'password_hash'>;
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
export type Section = Database['public']['Tables']['sections']['Row'];
export type SectionInsert = Database['public']['Tables']['sections']['Insert'];
export type SectionUpdate = Database['public']['Tables']['sections']['Update'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type SectionRevision = Database['public']['Tables']['section_revisions']['Row'];
export type SectionComment = Database['public']['Tables']['section_comments']['Row'];
export type ProjectMember = Database['public']['Tables']['project_members']['Row'];
export type ProjectMemberInsert = Database['public']['Tables']['project_members']['Insert'];
export type ProjectInvite = Database['public']['Tables']['project_invites']['Row'];
export type ProjectInviteInsert = Database['public']['Tables']['project_invites']['Insert'];
export type SectionPendingChange = Database['public']['Tables']['section_pending_changes']['Row'];
export type SectionPendingChangeInsert = Database['public']['Tables']['section_pending_changes']['Insert'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type SectionSuggestion = Database['public']['Tables']['section_suggestions']['Row'];
export type SectionSuggestionInsert = Database['public']['Tables']['section_suggestions']['Insert'];
