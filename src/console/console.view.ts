// src/console/console.view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type InitiativeTracker from "../main";
import { TTX_CONSOLE_VIEW } from "../utils/constants";
import Console from "./ui/Console.svelte";

export const TTX_CONSOLE_ICON = "shield";

export default class TTXConsoleView extends ItemView {
    private ui: Console;

    constructor(
        public leaf: WorkspaceLeaf,
        public plugin: InitiativeTracker
    ) {
        super(leaf);
    }

    getViewType() { return TTX_CONSOLE_VIEW; }
    getDisplayText() { return "TTX Console"; }
    getIcon() { return TTX_CONSOLE_ICON; }

    async onOpen() {
        this.ui = new Console({
            target: this.contentEl,
            props: { plugin: this.plugin }
        });
    }

    async onClose() {
        this.ui?.$destroy();
    }
}
