// Genereras om från live-schemat efter varje migration:
//   supabase gen types typescript --project-id gyjelwdvjrkbzqgnkhzk > src/types/database.types.ts
// Platshållare tills första migrationen (M01) är applicerad.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
