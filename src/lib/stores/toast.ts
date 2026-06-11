import { writable } from "svelte/store";

export interface Toast {
    id: number;
    message: string;
}

export const toasts = writable<Toast[]>([]);
let nextId = 0;

export function addToast(message: string, timeout = 5000) {
    const id = ++nextId;
    toasts.update((list) => [...list, { id, message }]);
    if (timeout > 0) {
        setTimeout(() => removeToast(id), timeout);
    }
}

export function removeToast(id: number) {
    toasts.update((list) => list.filter((t) => t.id !== id));
}