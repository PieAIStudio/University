import type { IslandAssetPackId } from "../island/island-asset-registry.js";

export type InspectorLayerId = "planet" | "world" | "island";

export interface InspectorSourceRef {
  readonly file: string;
  readonly export: string;
}

export type InspectorParameterValue = number | string;

export interface InspectorParameter {
  readonly id: string;
  readonly label: string;
  readonly value: InspectorParameterValue;
  readonly unit?: string;
  readonly mutable: boolean;
  readonly previewKey?: string;
  readonly source: InspectorSourceRef;
  readonly note?: string;
}

export interface InspectorColorStop {
  readonly id: string;
  readonly label: string;
  readonly hex: string;
  readonly source: InspectorSourceRef;
}

export type InspectorTechniqueLockId =
  | "grass"
  | "decoration"
  | "tree"
  | "landmark"
  | "environmentLight"
  | "lessonNode"
  | "undersideWorldLod";

export interface InspectorAsset {
  readonly key: string;
  readonly role: string;
  readonly assetId: string;
  readonly name: string;
  readonly pack: string;
  readonly packId?: IslandAssetPackId;
  readonly runtimePath: string | null;
  readonly sourcePath: string;
  readonly bytes: number | null;
  readonly triangles: number | null;
  readonly instances: number | null;
  readonly bytesSource: InspectorSourceRef | null;
  readonly trianglesSource: InspectorSourceRef | null;
  readonly instancesSource: InspectorSourceRef | null;
  readonly techniqueLock: InspectorTechniqueLockId;
  readonly technique: string;
  readonly techniqueSource: InspectorSourceRef;
  readonly mutable: boolean;
  readonly note?: string;
}

export interface InspectorCatalogAsset {
  readonly key: string;
  readonly assetId: string;
  readonly name: string;
  readonly pack: string;
  readonly packId: IslandAssetPackId;
  readonly runtimePath: string;
  readonly sourcePath: string | null;
  readonly bytes: number | null;
  readonly triangles: number | null;
}

export interface InspectorRoleChoice {
  readonly id: string;
  readonly label: string;
  readonly currentKeys: readonly string[];
  readonly source: InspectorSourceRef;
  readonly mutable: boolean;
  readonly note?: string;
}

export interface InspectorBudget {
  readonly triangleBudget: number;
  readonly actualTriangles: number | null;
  readonly budgetSource: InspectorSourceRef;
  readonly basis: string;
  readonly breakdown: readonly {
    readonly label: string;
    readonly triangles: number | null;
  }[];
}

export interface InspectorLayerDescription {
  readonly id: InspectorLayerId;
  readonly title: string;
  readonly projection: string;
  readonly liveSource: InspectorSourceRef;
  readonly terrain: {
    readonly generator: string;
    readonly parameters: readonly InspectorParameter[];
    readonly colors: readonly InspectorColorStop[];
    readonly geometryTriangles: number;
    readonly geometrySource: InspectorSourceRef;
  };
  readonly dressing: {
    readonly assets: readonly InspectorAsset[];
    readonly catalog: readonly InspectorCatalogAsset[];
    readonly roles: readonly InspectorRoleChoice[];
    readonly parameters: readonly InspectorParameter[];
    readonly note: string;
  };
  readonly lighting: {
    readonly parameters: readonly InspectorParameter[];
    readonly colors: readonly InspectorColorStop[];
  };
  readonly budget: InspectorBudget;
}

export interface InspectorRuntimeMetrics {
  readonly grassInstances?: number;
}

export interface TriangleCountMapLike {
  get(key: string): number | undefined;
}
