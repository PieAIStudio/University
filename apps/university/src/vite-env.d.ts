interface ImportMetaEnv {
  readonly VITE_SWIMMER_BACKEND_SUPABASE_URL?: string;
  readonly VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY?: string;
  /** @deprecated The browser backend reader accepts these during migration. */
  readonly VITE_SWIMMER_CORE_SUPABASE_URL?: string;
  readonly VITE_SWIMMER_CORE_PUBLISHABLE_KEY?: string;
  readonly VITE_UNIVERSITY_GRADING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
