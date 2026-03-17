export type ApplyPatchAction = "CREATE" | "EDIT" | "DELETE";

export interface ApplyPatchRequest {
  action: ApplyPatchAction;
  path: string;
  replacee?: string;
  replacer?: string;
  content?: string;
}

export interface ApplyPatchResult {
  action: ApplyPatchAction;
  path: string;
  changed: boolean;
}

export interface ApplyPatchPluginLike {
  readonly name: string;
  readonly version: string;
  readonly isInitialized: boolean;
  applyPatch(patch: string): Promise<ApplyPatchResult>;
}
