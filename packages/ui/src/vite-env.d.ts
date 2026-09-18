interface ImportMetaEnv {
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Component-owned PRIMM styles travel with its optional renderer. */
declare module "*.css" {}
