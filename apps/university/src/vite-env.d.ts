interface ImportMetaEnv {
  readonly VITE_SWIMMER_CORE_SUPABASE_URL?: string;
  readonly VITE_SWIMMER_CORE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
