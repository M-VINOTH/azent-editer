import type { AlbumTemplate } from "../models/template"

/**
 * Future-compatible service contracts.
 * PSD export is implemented in psdExportService.ts.
 * The remaining contracts are intentionally unimplemented in this POC.
 */

export interface PhotoAnalysisService {
  analyze(photoUrl: string): Promise<unknown>
}

export interface TemplateRecommendationService {
  recommend(input: unknown): Promise<unknown>
}

export interface LayoutGenerationService {
  generate(input: unknown): Promise<unknown>
}

export interface PSDExportService {
  exportPsd(template: AlbumTemplate): Promise<Blob>
}

export interface AlbumStoryService {
  buildStory(input: unknown): Promise<unknown>
}

export interface QualityAnalysisService {
  score(photoUrl: string): Promise<unknown>
}
