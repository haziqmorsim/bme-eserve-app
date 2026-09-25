import { writable } from "svelte/store";

export type ToastType = 'success' | 'error';

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

export const toasts = writable<Toast[]>([]);
let nextId = 0;

export function addToast(message: string, type: ToastType = 'success', timeout = 5000) {
    const id = ++nextId;
    toasts.update((list) => [...list, { id, message, type }]);
    if (timeout > 0) {
        setTimeout(() => removeToast(id), timeout);
    }
}

export function removeToast(id: number) {
    toasts.update((list) => list.filter((t) => t.id !== id));
}