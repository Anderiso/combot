export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      brand_profile: {
        Row: {
          brand_title: string | null;
          id: string;
          product_description: string | null;
          target_audience: string | null;
          updated_at: string | null;
        };
        Insert: {
          brand_title?: string | null;
          id?: string;
          product_description?: string | null;
          target_audience?: string | null;
          updated_at?: string | null;
        };
        Update: {
          brand_title?: string | null;
          id?: string;
          product_description?: string | null;
          target_audience?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      concepts: {
        Row: {
          created_at: string | null;
          description: string | null;
          funnel_stage: string;
          id: string;
          number: number;
          tag_id: string | null;
          title: string;
          transcript: string | null;
          video_path: string;
          video_url: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          funnel_stage: string;
          id?: string;
          number: number;
          tag_id?: string | null;
          title: string;
          transcript?: string | null;
          video_path: string;
          video_url: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          funnel_stage?: string;
          id?: string;
          number?: number;
          tag_id?: string | null;
          title?: string;
          transcript?: string | null;
          video_path?: string;
          video_url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "concepts_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "concept_tags";
            referencedColumns: ["id"];
          },
        ];
      };
      concept_tags: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Concept = Database["public"]["Tables"]["concepts"]["Row"];
export type ConceptTag = Database["public"]["Tables"]["concept_tags"]["Row"];
export type ConceptWithTag = Concept & {
  tag: Pick<ConceptTag, "id" | "name"> | null;
};
export type FunnelStage = "TMOF" | "BOF";
export type BrandProfile = Database["public"]["Tables"]["brand_profile"]["Row"];
