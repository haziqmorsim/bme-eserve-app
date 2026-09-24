import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const source = join(
    root,
    'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'
);
const targetDir = join(root, 'static/tesseract');
const target = join(targetDir, 'eng.traineddata.gz');

if (!existsSync(source)) {
    console.warn('[ocr-assets] eng.traineddata.gz not found; skipping copy.');
    process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log('[ocr-assets] copied eng.traineddata.gz into static/tesseract/');