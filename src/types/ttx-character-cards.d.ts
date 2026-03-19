/**
 * Type declarations for the TTX Character Cards plugin API.
 *
 * The plugin sets window.TTXCharacterCards when loaded and removes it on unload.
 * All types are declared locally — no dependency on the upstream npm package.
 */

import type { SRDCharacter } from "src/types/participants";

declare global {
    interface Window {
        TTXCharacterCards?: {
            getVersion(): { major: number; minor: number; patch: number };
            getLibrary(): Map<string, SRDCharacter>;
            getLibraryParticipants(): SRDCharacter[];
            getLibraryNames(): string[];
            hasParticipant(name: string): boolean;
            getParticipantFromLibrary(name: string): Partial<SRDCharacter> | null;
            isResolved(): boolean;
            onResolved(callback: () => void): () => void;
            render(participant: Record<string, any>, el: HTMLElement, display?: string): any;
            isStatblockLink(link: string): boolean;
            parseStatblockLink(link: string): string;
            renderMarkdown(markdown: string, el: HTMLElement, sourcePath: string, component: any): Promise<void>;
        };
    }
}

export {};
