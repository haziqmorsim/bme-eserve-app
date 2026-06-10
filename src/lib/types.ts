export interface Region {
    id: string;
    name: string;
    sort_order: number;
    boilers?: Boiler[];
}

export interface Boiler {
    id: string;
    region_id: string;
    code: string;
    name: string | null;
    capacity: string | null;
    pressure: string | null;
    steam_temperature: string | null;
    fuel_type: string | null;
    year_commissioned: number | null;
    status: string | null;
    design_image_url: string | null;
    description: string | null;
}

export interface Component {
    id: string;
    boiler_id: string;
    name: string;
    icon: string | null;
    sort_order: number;
}

export interface Part {
    id: string;
    component_id: string;
    part_number: string;
    name: string;
    description: string | null;
    image_url: string | null;
    in_stock: boolean;
    price_min: number | null;
    price_max: number | null;
    stock_quantity: number;
}

export interface Profile {
    id: string;
    full_name: string | null;
    company: string | null;
    role: 'customer' | 'admin';
    region_id: string | null;
    email: string | null;
    phone: string | null;
}