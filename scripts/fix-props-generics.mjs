// Rewrites   let { a, b = 1 } = $props<{ a: string; b?: number }>();
//      into  let { a, b = 1 }: { a: string; b?: number } = $props();
//
// $props() is declared by Svelte without a generic parameter, so the generic form only
// works because the editor tooling hides the resulting error. The annotation form is the
// one Svelte documents and every tool understands.
//
// Usage (from the project root):
//   node scripts/fix-props-generics.mjs          -> rewrite files in place
//   node scripts/fix-props-generics.mjs --check  -> only list the files that would change
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const srcDir = join(root, 'src');
const checkOnly = process.argv.includes('--check');
const MARK = '$props<';

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name.startsWith('.')) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (full.endsWith('.svelte')) out.push(full);
    }
    return out;
}

// Index of the ">" that closes the generic opened at `start` (just after "$props<").
// "=>" arrows inside the type are skipped.
function findClose(text, start) {
    let depth = 1;
    for (let i = start; i < text.length; i++) {
        const c = text[i];
        if (c === '<') depth++;
        else if (c === '>' && text[i - 1] !== '=') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

function convert(text) {
    let out = '';
    let pos = 0;
    let count = 0;

    for (;;) {
        const at = text.indexOf(MARK, pos);
        if (at === -1) break;

        const typeStart = at + MARK.length;
        const close = findClose(text, typeStart);
        const afterClose = close === -1 ? '' : text.slice(close + 1, close + 3);
        // Must be "= $props<...>()" with the "=" directly before "$props".
        const before = text.slice(0, at).replace(/\s+$/, '');
        if (close === -1 || afterClose !== '()' || !before.endsWith('=')) {
            out += text.slice(pos, at + MARK.length);
            pos = at + MARK.length;
            continue;
        }

        const type = text.slice(typeStart, close);
        const eqStart = before.length - 1; // index of "="
        const pattern = text.slice(pos, eqStart).replace(/\s+$/, '');

        out += pattern + ': ' + type + ' = $props()';
        pos = close + 3;
        count++;
    }

    return { text: out + text.slice(pos), count };
}

let files = 0;
let total = 0;
for (const file of walk(srcDir)) {
    const original = readFileSync(file, 'utf8');
    if (!original.includes(MARK)) continue;

    const { text, count } = convert(original);
    if (count === 0) continue;

    files++;
    total += count;
    console.log(`${checkOnly ? 'would change' : 'fixed'}  ${relative(root, file)}`);
    if (!checkOnly) writeFileSync(file, text);
}

console.log(`\n${files} file(s), ${total} $props<...>() call(s) ${checkOnly ? 'found' : 'rewritten'}.`);
