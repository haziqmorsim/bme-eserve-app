export type TextWord = {
    text: string;
    x: number;
    width: number;
    confidence: number;
};

export type TextLine = {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    words: TextWord[];
};

export type RenderedPage = {
    index: number;
    width: number;
    height: number;
    canvas: HTMLCanvasElement;
    grey: Uint8ClampedArray;
    hasTextLayer: boolean;
};

export type Rect = { left: number; top: number; width: number; height: number };

export type ProgressFn = (done: number, total: number, note: string) => void;

export type InvoiceRow = {
    project_no: string;
    vendor: string;
    invoice_no: string;
    pod: string;
    type: string;
    freight: number;
    local_charges: number;
    port_storage: number;
    transport_charges: number;
    reimbursement: number;
    total: number;
    source_file: string;
    source_page: number;
    confidence: 'low' | 'medium' | 'high';
};

export type InvoiceFields = Omit<InvoiceRow, 'source_file' | 'source_page'>;

export type PackingContent = {
    quantity: string;
    description: string;
    subItem: boolean;
    sourcePage: number;
};

export type Package = {
    itemNo: string;
    quantity: string;
    packageType: string;
    dimension: string;
    volume: number | null;
    weight: number | null;
    contents: PackingContent[];
    sourceFile: string;
    sourcePage: number;
    confidence: 'low' | 'medium' | 'high';
};

export type PackingList = {
    project: string;
    client: string;
    date: string;
    product: string;
    packages: Package[];
    totalWeight: number | null;
    sourceFile: string;
};

export type ExtractResult<T> = {
    rows: T[];
    warnings: string[];
};