export type BehaviourKey = 'views' | 'interactions' | 'requests' | 'enquiries' | 'updates' | 'signins';

export const BEHAVIOURS: { key: BehaviourKey; label: string }[] = [
    { key: 'views', label: 'Page Views'},
    { key: 'interactions', label: 'Clicks and interactions'},
    { key: 'requests', label: 'Cart and requests'},
    { key: 'enquiries', label: 'Enquiries'},
    { key: 'updates', label: 'Updates'},
    { key: 'signins', label: 'Sign-Ins'}
];

export const BEHAVIOUR_INDEX: Record<BehaviourKey, number> = Object.fromEntries(
    BEHAVIOURS.map((b, i) => [b.key, i])
) as Record<BehaviourKey, number>;

const UPDATE_TYPES = new Set([
    'profile_updated',
    'general_settings_updated',
    'invoice_converted',
    'packing_converted'
]);

export function behaviourOf(eventType: string): BehaviourKey | null {
    switch (eventType) {
        case 'page_view':
            return 'views';
        case 'click':
        case 'boiler_search':
        case 'image_view':
        case 'file_download':
            return 'interactions';
        case 'cart_add':
        case 'cart_remove':
            return 'requests';
        case 'sign_in':
        case 'sign_out':
            return 'signins';
    }
    if (UPDATE_TYPES.has(eventType)) return 'updates';
    if(/^(project|boiler|part|user|faq)_(created|updated|deleted)$/.test(eventType)) return 'updates';
    return null;
}

export const emptyCounts = (): number[] => BEHAVIOURS.map(() => 0);

export const HEAT_COLS = 12;
export const HEAT_ROWS = 8;