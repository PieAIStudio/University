interface ImportMetaEnv {
  readonly VITE_SWIMMER_BACKEND_SUPABASE_URL?: string;
  readonly VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
