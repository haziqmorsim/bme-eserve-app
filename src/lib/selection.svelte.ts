import { SvelteSet } from "svelte/reactivity";

export class RowSelection {
    private ids = new SvelteSet<string>();

    get count(): number {
        return this.ids.size;
    }

    has(id: string): boolean {
        return this.ids.has(id);
    }

    toggle(id: string, on: boolean) {
        if (on) this.ids.add(id);
        else this.ids.delete(id);
    }

    setMany(ids: string[], on: boolean) {
        for (const id of ids) this.toggle(id, on);
    }

    clear() {
        if (this.ids.size) this.ids.clear();
    }

    prune(valid: Set<string>) {
        for (const id of [...this.ids]) if (!valid.has(id)) this.ids.delete(id);
    }
}