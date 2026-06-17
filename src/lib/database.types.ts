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
          title?: string;
          transcript?: string | null;
          video_path?: string;
          video_url?: string;
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
export type FunnelStage = "TOF" | "MOF" | "BOF";
export type BrandProfile = Database["public"]["Tables"]["brand_profile"]["Row"];
