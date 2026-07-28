export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          owner_id?: string;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          section_id: string;
          author_id: string;
          author_name?: string;
          body: string;
          resolved?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          section_id?: string;
          author_id?: string;
          author_name?: string;
          body?: string;
          resolved?: boolean;
          created_at?: string;
        };
      };
    };
  };
}

export type Project = Database['public']['Tables']['projects']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type Section = Database['public']['Tables']['sections']['Row'];
export type SectionInsert = Database['public']['Tables']['sections']['Insert'];
export type SectionUpdate = Database['public']['Tables']['sections']['Update'];
export type SectionRevision = Database['public']['Tables']['section_revisions']['Row'];
export type SectionComment = Database['public']['Tables']['section_comments']['Row'];
