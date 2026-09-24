import ExcelJS from 'exceljs';
import type { InvoiceRow, PackingList } from './types';

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEBF7' } };
const MONEY_FMT = '#,##0.00';
const INT_FMT = '#,##0';
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

function styleHeader(sheet: ExcelJS.Worksheet, row: number, columns: number) {
    const header = sheet.getRow(row);
    for (let c = 1; c <= columns; c += 1) {
        const cell = header.getCell(c);
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = BORDER;
    }
    header.height = 28;
}

function autosize(sheet: ExcelJS.Worksheet, min = 10, max = 60) {
    sheet.columns.forEach((column) => {
        let longest = min;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
            for (const line of String(cell.value ?? '').split('\n')) {
                longest = Math.max(longest, line.length);
            }
        });
        column.width = Math.max(min, Math.min(max, longest + 2));
    });
}

async function toBlob(wb: ExcelJS.Workbook): Promise<Blob> {
    const buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
}

const INVOICE_HEADERS = [
    'Project No', 'Vendor', 'Invoice No', 'POD', 'Type',
    'Freight (RM)', 'Local Charges (RM)', 'Port Storage (RM)',
    'Transport Charges (RM)', 'Reimbursement (RM)', 'Total (RM)'
];

export async function buildInvoiceWorkbook(rows:InvoiceRow[]): Promise<Blob> {
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();

    const detailed = wb.addWorksheet('Detailed', { views: [{ state: 'frozen', ySplit:1 }] });
    detailed.addRow(INVOICE_HEADERS);
    for (const r of rows) {
        detailed.addRow([
            r.project_no, r.vendor, r.invoice_no, r.pod, r.type,
            r.freight, r.local_charges, r.port_storage,
            r.transport_charges, r.reimbursement, r.total
        ]);
    }

    const last = detailed.rowCount;
    if (rows.length) {
        const totals = detailed.addRow(['TOTAL']);
        for (let c = 6; c <= 11; c += 1) {
            const letter = detailed.getColumn(c).letter;
            totals.getCell(c).value = { formula: `SUM(${letter}2:${letter}${last})` };
        }
    }

    for (let r = 2; r <= detailed.rowCount; r += 1) {
        const isTotal = rows.length > 0 && r === detailed.rowCount;
        for (let c = 1; c <= INVOICE_HEADERS.length; c += 1) {
            const cell = detailed.getRow(r).getCell(c);
            cell.border = BORDER;
            if (c >= 6) {
                cell.numFmt = MONEY_FMT;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            }
            if (isTotal) {
                cell.font = { bold: true };
                cell.fill = TOTAL_FILL;
            }
        }
    }
    styleHeader(detailed, 1, INVOICE_HEADERS.length);
    autosize(detailed, 10, 34);
    if (rows.length) detailed.autoFilter = { from: { row: 1, column: 1 }, to: { row: last, column: 11 } };

    const summary = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
    summary.addRow(['Project No', 'Vendor', 'Freight', 'Local Charges', 'Port Storage', 'Transport Charges', 'Reimbursement']);

    const grouped = new Map<string, { project: string; vendor: string; values: number[] }>();
    for (const r of rows) {
        const key = `${r.project_no || '(blank)'}\u0000${r.vendor}`;
        const entry = grouped.get(key) ?? {
            project: r.project_no || '(blank)',
            vendor: r.vendor,
            values: [0, 0, 0, 0, 0]
        };
        entry.values[0] += r.freight;
        entry.values[1] += r.local_charges;
        entry.values[2] += r.port_storage;
        entry.values[3] += r.transport_charges;
        entry.values[4] += r.reimbursement;
        grouped.set(key, entry);
    }
    for (const { project, vendor, values } of grouped.values()) {
        summary.addRow([project, vendor, ...values.map((v) => Math.round(v * 100) / 100)]);
    }
    for (let r = 2; r <= summary.rowCount; r += 1) {
        for (let c = 1; c <= 7; c += 1) {
            const cell = summary.getRow(r).getCell(c);
            cell.border = BORDER;
            if (c >= 3) {
                cell.numFmt = MONEY_FMT;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            }
        }
    }
    styleHeader(summary, 1, 7);
    autosize(summary, 10, 34);

    return toBlob(wb);
}

const PACKAGE_HEADERS = [
    'Item No', 'Quantity', 'Package Type', 'Dimensions',
    'Volume (m3)', 'Weight (kg)', 'Contents', 'Source File', 'Page'
];

const CONTENT_HEADERS = [
    'Item No', 'Package Type', 'Level', 'Qty', 'Description', 'Source File', 'Page'
];

export async function buildPackingWorkbook(docs: PackingList[]): Promise<Blob> {
    const wb = new ExcelJS.Workbook();
    wb.created = new Date();
    const packages = docs.flatMap((d) => d.packages);

    const summary = wb.addWorksheet('Summary');
    summary.getCell('A1').value = 'Packing List';
    summary.getCell('A1').font = { bold: true, size: 12, color: { argb: 'FF1F4E78' } };

    const joined = (pick: (d: PackingList) => string) =>
    [...new Set(docs.map(pick).map((v) => v.trim()).filter(Boolean))].join(' / ');

    let row = 3;
    const details: Array<[string, string]> = [
        ['Project', joined((d) => d.project)],
        ['Client', joined((d) => d.client)],
        ['Date', joined((d) => d.date)],
        ['Product', joined((d) => d.product)],
        ['Source file(s)', docs.map((d) => d.sourceFile).filter(Boolean).join(', ')]
    ];
    for (const [label, value] of details) {
        summary.getCell(row, 1).value = label;
        summary.getCell(row, 1).font = { bold: true };
        summary.getCell(row, 2).value = value;
        summary.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
        row += 1;
    }

    row += 1;
    summary.getCell(row, 1).value = 'By package type';
    summary.getCell(row, 1).font = { bold: true };
    row += 1;

    const head = row;
    ['Package Type', 'Packages', 'Volume (m3)', 'Weight (kg)'].forEach((name, i) => {
        summary.getCell(head, 1 + i).value = name;
    });
    styleHeader(summary, head, 4);

    const byType = new Map<string, { count: number; volume: number; weight: number }>();
    for (const pkg of packages) {
        const key = pkg.packageType || '(unspecified)';
        const entry = byType.get(key) ?? { count: 0, volume: 0, weight: 0 };
        entry.count += 1;
        entry.volume += pkg.volume ?? 0;
        entry.weight += pkg.weight ?? 0;
        byType.set(key, entry);
    }

    row = head + 1;
    for (const [name, entry] of byType) {
        summary.getCell(row, 1).value = name;
        summary.getCell(row, 2).value = entry.count;
        summary.getCell(row, 2).numFmt = INT_FMT;
        summary.getCell(row, 3).value = Math.round(entry.volume * 1000) / 1000;
        summary.getCell(row, 3).numFmt = MONEY_FMT;
        summary.getCell(row, 4).value = Math.round(entry.weight * 100) / 100;
        summary.getCell(row, 4).numFmt = MONEY_FMT;
        for (let c = 1; c <= 4; c += 1) {
            summary.getCell(row, c).border = BORDER;
            if (c > 1) summary.getCell(row, c).alignment = { horizontal: 'center', vertical: 'middle' };
        }
        row += 1;
    }

    const volume = Math.round(packages.reduce((s, p) => s + (p.volume ?? 0), 0) * 1000) / 1000;
    const weight = Math.round(packages.reduce((s, p) => s + (p.weight ?? 0), 0) * 100) / 100;
    summary.getCell(row, 1).value = 'TOTAL';
    summary.getCell(row, 2).value = packages.length;
    summary.getCell(row, 2).numFmt = INT_FMT;
    summary.getCell(row, 3).value = volume;
    summary.getCell(row, 3).numFmt = MONEY_FMT;
    summary.getCell(row, 4).value = weight;
    summary.getCell(row, 4).numFmt = MONEY_FMT;
    for (let c = 1; c <= 4; c += 1) {
        const cell = summary.getCell(row, c);
        cell.font = { bold: true };
        cell.fill = TOTAL_FILL;
        cell.border = BORDER;
        if (c > 1) cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    const printed = docs.map((d) => d.totalWeight).filter((v): v is number => v !== null);
    if (printed.length) {
        row += 2;
        const total = Math.round(printed.reduce((s, v) => s + v, 0) * 100) / 100;
        summary.getCell(row, 1).value = 'Printed total weight (kg)';
        summary.getCell(row, 1).font = { bold: true };
        summary.getCell(row, 2).value = total;
        summary.getCell(row, 2).numFmt = MONEY_FMT;
        row += 1;
        const difference = Math.round((total - weight) * 100) / 100;
        summary.getCell(row, 1).value = 'Difference vs items (kg)';
        summary.getCell(row, 1).font = { bold: true };
        const cell = summary.getCell(row, 2);
        cell.value = difference;
        cell.numFmt = MONEY_FMT;
        if (Math.abs(difference) > 1) cell.font = { bold: true, color: { argb: 'FFC00000' } };
    }

    summary.getColumn(1).width = 26;
    summary.getColumn(2).width = 46;
    summary.getColumn(3).width = 16;
    summary.getColumn(4).width = 16;

    const sheet = wb.addWorksheet('Packages', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.addRow(PACKAGE_HEADERS);
    for (const pkg of packages) {
        sheet.addRow([
            pkg.itemNo, pkg.quantity, pkg.packageType, pkg.dimension, pkg.volume, pkg.weight, pkg.contents.length, pkg.sourceFile, pkg.sourcePage
        ]);
    }
    const lastPackage = sheet.rowCount;
    if (packages.length) {
        const totals = sheet.addRow(['TOTAL']);
        for (const c of [5, 6, 7]) {
            const letter = sheet.getColumn(c).letter;
            totals.getCell(c).value = { formula: `SUM(${letter}2:${letter}${lastPackage})` };
        }
    }
    for (let r = 2; r <= sheet.rowCount; r += 1) {
        const isTotal = packages.length > 0 && r === sheet.rowCount;
        for (let c = 1; c <= PACKAGE_HEADERS.length; c += 1) {
            const cell = sheet.getRow(r).getCell(c);
            cell.border = BORDER;
            if (c === 5 || c === 6) {
                cell.numFmt = MONEY_FMT;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (c === 1 || c === 7 || c === 9) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
            }
            if (isTotal) {
                cell.font = { bold: true };
                cell.fill = TOTAL_FILL;
            }
        }
    }
    styleHeader(sheet, 1, PACKAGE_HEADERS.length);
    autosize(sheet, 10, 46);
    if (packages.length) {
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastPackage, column: PACKAGE_HEADERS.length } };
    }

    const contents = wb.addWorksheet('Contents', { views: [{ state: 'frozen', ySplit: 1 }] });
    contents.addRow(CONTENT_HEADERS);
    const subRows: number[] = [];
    for (const pkg of packages) {
        for (const item of pkg.contents) {
            contents.addRow([
                pkg.itemNo, pkg.packageType, item.subItem ? 2 : 1, item.quantity, item.description, pkg.sourceFile, pkg.sourcePage
            ]);
            if (item.subItem) subRows.push(contents.rowCount);
        }
    }
    const subSet = new Set(subRows);
    for (let r = 2; r <= contents.rowCount; r += 1) {
        const isSub = subSet.has(r);
        for (let c = 1; c <= CONTENT_HEADERS.length; c += 1) {
            const cell = contents.getRow(r).getCell(c);
            cell.border = BORDER;
            cell.alignment = 
                c === 5
                    ? { horizontal: 'left', vertical: 'top', wrapText: true, indent: isSub ? 2 : 0 }
                    : { horizontal: 'center', vertical: 'middle' };
            if (isSub) cell.font = { color: { argb: 'FF595959' } };
        }
    }
    styleHeader(contents, 1, CONTENT_HEADERS.length);
    autosize(contents, 10, 70);
    if (contents.rowCount > 1) {
        contents.autoFilter = { from: { row: 1, column: 1 }, to: { row: contents.rowCount, column: CONTENT_HEADERS.length } };
    }

    return toBlob(wb);
}