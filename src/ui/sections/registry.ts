// sections/registry.ts
// Maps a section id to its implementation. The shell resolves placements
// through this, so adding a section is a one-line registration and the layout
// is the only thing that decides where it goes.

import type { SectionDefinition, SectionId } from './types.js';

export type SectionRegistry = Partial<Record<SectionId, SectionDefinition>>;

const REGISTRY: SectionRegistry = {};

export function registerSection(definition: SectionDefinition): void {
  REGISTRY[definition.id] = definition;
}

export function getSection(
  id: SectionId,
  registry: SectionRegistry = REGISTRY
): SectionDefinition | undefined {
  return registry[id];
}

export function registeredSections(
  registry: SectionRegistry = REGISTRY
): SectionDefinition[] {
  return Object.values(registry).filter(Boolean) as SectionDefinition[];
}

/** Every registered section's CSS, for the shadow root's stylesheet. */
export function registeredStyles(
  registry: SectionRegistry = REGISTRY
): string[] {
  return registeredSections(registry)
    .map(section => section.styles ?? '')
    .filter(Boolean);
}
