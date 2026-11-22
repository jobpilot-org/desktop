export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      ai_api_keys: {
        Row: {
          created_at: string;
          secret_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          secret_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          secret_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          applied_at: string;
          archived_at: string | null;
          company: string;
          created_at: string;
          id: string;
          job_description: string | null;
          job_url: string | null;
          location: string;
          next_step: string | null;
          priority: string;
          role: string;
          salary_max: number | null;
          salary_min: number | null;
          source: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          work_mode: string | null;
        };
        ComputedFields: never;
        Insert: {
          applied_at: string;
          archived_at?: string | null;
          company: string;
          created_at?: string;
          id?: string;
          job_description?: string | null;
          job_url?: string | null;
          location: string;
          next_step?: string | null;
          priority?: string;
          role: string;
          salary_max?: number | null;
          salary_min?: number | null;
          source?: string | null;
          status: string;
          updated_at?: string;
          user_id?: string;
          work_mode?: string | null;
        };
        Update: {
          applied_at?: string;
          archived_at?: string | null;
          company?: string;
          created_at?: string;
          id?: string;
          job_description?: string | null;
          job_url?: string | null;
          location?: string;
          next_step?: string | null;
          priority?: string;
          role?: string;
          salary_max?: number | null;
          salary_min?: number | null;
          source?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          work_mode?: string | null;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          application_id: string;
          created_at: string;
          id: string;
          kind: string;
          location: string | null;
          notes: string | null;
          starts_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          location?: string | null;
          notes?: string | null;
          starts_at: string;
          user_id?: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          location?: string | null;
          notes?: string | null;
          starts_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_user_id_application_id_fkey';
            columns: ['user_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      contacts: {
        Row: {
          application_id: string;
          created_at: string;
          email: string | null;
          id: string;
          linkedin_url: string | null;
          name: string;
          phone: string | null;
          role: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          linkedin_url?: string | null;
          name: string;
          phone?: string | null;
          role?: string | null;
          user_id?: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          linkedin_url?: string | null;
          name?: string;
          phone?: string | null;
          role?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'contacts_user_id_application_id_fkey';
            columns: ['user_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      cover_letters: {
        Row: {
          application_id: string | null;
          closing: string;
          created_at: string;
          id: string;
          length: string;
          model: string | null;
          posting_id: string | null;
          salutation: string;
          sections: NonNullable<Json>;
          strengths: string[];
          subject: string;
          tone: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id?: string | null;
          closing?: string;
          created_at?: string;
          id?: string;
          length?: string;
          model?: string | null;
          posting_id?: string | null;
          salutation?: string;
          sections?: NonNullable<Json>;
          strengths?: string[];
          subject?: string;
          tone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          application_id?: string | null;
          closing?: string;
          created_at?: string;
          id?: string;
          length?: string;
          model?: string | null;
          posting_id?: string | null;
          salutation?: string;
          sections?: NonNullable<Json>;
          strengths?: string[];
          subject?: string;
          tone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cover_letters_user_id_application_id_fkey';
            columns: ['user_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['user_id', 'id'];
          },
          {
            foreignKeyName: 'cover_letters_user_id_posting_id_fkey';
            columns: ['user_id', 'posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      documents: {
        Row: {
          created_at: string;
          file_name: string;
          id: string;
          kind: string;
          mime_type: string;
          profile_entry_id: string | null;
          size_bytes: number;
          storage_path: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          file_name: string;
          id?: string;
          kind: string;
          mime_type: string;
          profile_entry_id?: string | null;
          size_bytes: number;
          storage_path: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          file_name?: string;
          id?: string;
          kind?: string;
          mime_type?: string;
          profile_entry_id?: string | null;
          size_bytes?: number;
          storage_path?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_user_id_profile_entry_id_fkey';
            columns: ['user_id', 'profile_entry_id'];
            isOneToOne: false;
            referencedRelation: 'profile_entries';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      job_posting_sources: {
        Row: {
          apply_email: string | null;
          apply_url: string | null;
          captured_at: string;
          company: string | null;
          contact_email: string | null;
          contact_name: string | null;
          id: string;
          job_description: string | null;
          kind: string;
          location: string | null;
          posting_id: string;
          role: string | null;
          salary_max: number | null;
          salary_min: number | null;
          source: string | null;
          url: string | null;
          user_id: string;
          work_mode: string | null;
        };
        ComputedFields: never;
        Insert: {
          apply_email?: string | null;
          apply_url?: string | null;
          captured_at?: string;
          company?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          id?: string;
          job_description?: string | null;
          kind: string;
          location?: string | null;
          posting_id: string;
          role?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          source?: string | null;
          url?: string | null;
          user_id?: string;
          work_mode?: string | null;
        };
        Update: {
          apply_email?: string | null;
          apply_url?: string | null;
          captured_at?: string;
          company?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          id?: string;
          job_description?: string | null;
          kind?: string;
          location?: string | null;
          posting_id?: string;
          role?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          source?: string | null;
          url?: string | null;
          user_id?: string;
          work_mode?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'job_posting_sources_user_id_posting_id_fkey';
            columns: ['user_id', 'posting_id'];
            isOneToOne: false;
            referencedRelation: 'job_postings';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      job_postings: {
        Row: {
          application_id: string | null;
          apply_email: string | null;
          apply_url: string | null;
          company: string;
          contact_email: string | null;
          contact_name: string | null;
          created_at: string;
          dismissed_at: string | null;
          fit_at: string | null;
          fit_model: string | null;
          fit_posting_hash: string | null;
          fit_profile_hash: string | null;
          fit_result: Json | null;
          fit_score: number | null;
          id: string;
          job_description: string | null;
          job_url: string | null;
          location: string;
          role: string;
          salary_max: number | null;
          salary_min: number | null;
          source: string | null;
          updated_at: string;
          user_id: string;
          work_mode: string | null;
        };
        ComputedFields: never;
        Insert: {
          application_id?: string | null;
          apply_email?: string | null;
          apply_url?: string | null;
          company: string;
          contact_email?: string | null;
          contact_name?: string | null;
          created_at?: string;
          dismissed_at?: string | null;
          fit_at?: string | null;
          fit_model?: string | null;
          fit_posting_hash?: string | null;
          fit_profile_hash?: string | null;
          fit_result?: Json | null;
          fit_score?: number | null;
          id?: string;
          job_description?: string | null;
          job_url?: string | null;
          location?: string;
          role: string;
          salary_max?: number | null;
          salary_min?: number | null;
          source?: string | null;
          updated_at?: string;
          user_id?: string;
          work_mode?: string | null;
        };
        Update: {
          application_id?: string | null;
          apply_email?: string | null;
          apply_url?: string | null;
          company?: string;
          contact_email?: string | null;
          contact_name?: string | null;
          created_at?: string;
          dismissed_at?: string | null;
          fit_at?: string | null;
          fit_model?: string | null;
          fit_posting_hash?: string | null;
          fit_profile_hash?: string | null;
          fit_result?: Json | null;
          fit_score?: number | null;
          id?: string;
          job_description?: string | null;
          job_url?: string | null;
          location?: string;
          role?: string;
          salary_max?: number | null;
          salary_min?: number | null;
          source?: string | null;
          updated_at?: string;
          user_id?: string;
          work_mode?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'job_postings_user_id_application_id_fkey';
            columns: ['user_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      notes: {
        Row: {
          application_id: string;
          body: string;
          created_at: string;
          id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          body: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Update: {
          application_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notes_user_id_application_id_fkey';
            columns: ['user_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      profile_entries: {
        Row: {
          created_at: string;
          description: string | null;
          end_date: string | null;
          id: string;
          is_current: boolean;
          kind: string;
          location: string | null;
          organization: string | null;
          position: number;
          start_date: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_current?: boolean;
          kind: string;
          location?: string | null;
          organization?: string | null;
          position?: number;
          start_date?: string | null;
          title: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          end_date?: string | null;
          id?: string;
          is_current?: boolean;
          kind?: string;
          location?: string | null;
          organization?: string | null;
          position?: number;
          start_date?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profile_languages: {
        Row: {
          created_at: string;
          id: string;
          language: string;
          level: string | null;
          position: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          language: string;
          level?: string | null;
          position?: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          language?: string;
          level?: string | null;
          position?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      profile_links: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          label: string | null;
          position: number;
          url: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          label?: string | null;
          position?: number;
          url: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          label?: string | null;
          position?: number;
          url?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profile_skills: {
        Row: {
          category: string | null;
          created_at: string;
          id: string;
          items: string;
          position: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string | null;
          created_at?: string;
          id?: string;
          items: string;
          position?: number;
          user_id?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          id?: string;
          items?: string;
          position?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          birth_date: string | null;
          birth_place: string | null;
          city: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          headline: string | null;
          last_name: string;
          onboarded_at: string | null;
          phone: string | null;
          postal_code: string | null;
          street: string | null;
          summary: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          birth_date?: string | null;
          birth_place?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string;
          headline?: string | null;
          last_name?: string;
          onboarded_at?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          street?: string | null;
          summary?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          birth_date?: string | null;
          birth_place?: string | null;
          city?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string;
          headline?: string | null;
          last_name?: string;
          onboarded_at?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          street?: string | null;
          summary?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      reminders: {
        Row: {
          application_id: string;
          body: string;
          created_at: string;
          done_at: string | null;
          due_at: string;
          key: string;
          kind: string;
          snoozed_until: string | null;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          body: string;
          created_at?: string;
          done_at?: string | null;
          due_at: string;
          key: string;
          kind: string;
          snoozed_until?: string | null;
          title: string;
          user_id?: string;
        };
        Update: {
          application_id?: string;
          body?: string;
          created_at?: string;
          done_at?: string | null;
          due_at?: string;
          key?: string;
          kind?: string;
          snoozed_until?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reminders_user_id_application_id_fkey';
            columns: ['user_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
      settings: {
        Row: {
          key: string;
          user_id: string;
          value: string;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          user_id?: string;
          value: string;
        };
        Update: {
          key?: string;
          user_id?: string;
          value?: string;
        };
        Relationships: [];
      };
      status_events: {
        Row: {
          application_id: string;
          at: string;
          from_status: string | null;
          id: number;
          to_status: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          at?: string;
          from_status?: string | null;
          id?: never;
          to_status: string;
          user_id?: string;
        };
        Update: {
          application_id?: string;
          at?: string;
          from_status?: string | null;
          id?: never;
          to_status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'status_events_user_id_application_id_fkey';
            columns: ['user_id', 'application_id'];
            isOneToOne: false;
            referencedRelation: 'applications';
            referencedColumns: ['user_id', 'id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      delete_ai_api_key: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      get_ai_api_key: { Args: Record<PropertyKey, never>; Returns: string };
      refresh_job_posting: {
        Args: { p_posting_id: string; p_user_id: string };
        Returns: undefined;
      };
      replace_profile: { Args: { profile: Json }; Returns: undefined };
      save_ai_api_key: {
        Args: { api_key: string };
        Returns: {
          created_at: string;
          updated_at: string;
          user_id: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  'public'
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
