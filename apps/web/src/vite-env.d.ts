/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TUTELA_VAULT_ADDRESS?: string;
  readonly VITE_SOURCE_REGISTRY_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
