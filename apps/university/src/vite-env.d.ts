interface ImportMetaEnv {
  readonly VITE_SWIMMER_BACKEND_SUPABASE_URL?: string;
  readonly VITE_SWIMMER_BACKEND_PUBLISHABLE_KEY?: string;
  readonly VITE_UNIVERSITY_GRADING_URL?: string;
  /** Public VAPID key only; the matching private key stays in SwimmerBackend. */
  readonly VITE_UNIVERSITY_VAPID_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
