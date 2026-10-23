import { writable, get } from "svelte/store";
import { browser } from "$app/environment";
import { track } from "$lib/tracking";

export interface QuoteItem {
    partId: string;
    partNumber: string;
    partName: string;
    boilerCode: string;
    componentName: string;
    price?: number;
    priceMin: number;
    priceMax: number;
    quantity: number;
}

const KEY = 'bme-quote-cart';
const initial: QuoteItem[] = browser ? JSON.parse(localStorage.getItem(KEY) ?? '[]') : [];

export const quoteItems = writable<QuoteItem[]>(initial);

if (browser) {
    quoteItems.subscribe((items) => localStorage.setItem(KEY, JSON.stringify(items)));
}

export function addItem(item: QuoteItem) {
    track('cart_add', { label: item.partNumber, boiler: item.boilerCode || null, qty: item.quantity });
    quoteItems.update((items) => {
        const existing = items.find((i) => i.partId === item.partId);
        if (existing) {
            return items.map((i) => i.partId === item.partId ? { ...i, quantity: i.quantity + item.quantity } : i);
        }
        return [...items, item];
    });
}

export function removeItem(partId: string) {
    const removed = get(quoteItems).find((i) => i.partId === partId);
    if (removed) track('cart_remove', { label: removed.partNumber });
    quoteItems.update((items) => items.filter((i) => i.partId !== partId));
}

export function setQuantity(partId: string, quantity: number) {
    quoteItems.update((items) => items.map((i) => (i.partId === partId ? { ...i, quantity: Math.max(1, quantity) } : i)));
}

export function clearCart() {
    quoteItems.set([]);
}