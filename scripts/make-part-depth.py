import sys, glob, os, numpy as np, onnxruntime as ort
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

src, out, dbg = sys.argv[1:4]
OUT = 384
so = ort.SessionOptions(); so.intra_op_num_threads = 2
MODELS = os.environ.get('PART_DEPTH_MODELS', 'models')
seg = ort.InferenceSession(os.path.join(MODELS, 'isnet-general-use.onnx'), so, providers=['CPUExecutionProvider'])
dep = ort.InferenceSession(os.path.join(MODELS, 'depth_anything_v2_vitb.onnx'), so, providers=['CPUExecutionProvider'])

def run_seg(im):
    x = np.asarray(im.convert('RGB').resize((1024, 1024), Image.BILINEAR), np.float32)
    x = x / max(x.max(), 1e-6) - 0.5
    p = seg.run(None, {'input_image': x.transpose(2, 0, 1)[None]})[0][0, 0]
    p = (p - p.min()) / max(p.max() - p.min(), 1e-6)
    return p

def run_depth(im):
    x = np.asarray(im.convert('RGB').resize((518, 518), Image.BICUBIC), np.float32) / 255
    x = (x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    d = dep.run(None, {'l_x_': x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]
    return d

def resize(a, n):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((n, n), Image.BILINEAR))

files = sorted(sum((glob.glob(os.path.join(src, e)) for e in ('*.jpg', '*.jpeg', '*.png', '*.webp')), []))
os.makedirs(out, exist_ok=True); os.makedirs(dbg, exist_ok=True)
only = sys.argv[4:] 
for f in files:
    name = os.path.splitext(os.path.basename(f))[0].lower().replace(' ', '-')
    name = '-'.join(name.split())
    if only and not any(o in name for o in only): continue
    im = Image.open(f).convert('RGB')
    w, h = im.size
    if w != h:
        s = max(w, h); bg = im.getpixel((0, 0))
        sq = Image.new('RGB', (s, s), bg); sq.paste(im, ((s - w) // 2, (s - h) // 2)); im = sq
    p = resize(run_seg(im), OUT)
    rgb = np.asarray(im.resize((OUT, OUT), Image.BILINEAR), np.float32)
    bgc = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    diff = np.abs(rgb - bgc).max(axis=2)
    m = (p > 0.5) | ((diff > 40) & (p > 0.08))
    m = ndi.binary_opening(m, iterations=1)
    lab, n = ndi.label(m)
    if n > 1:  # drop specks
        sizes = ndi.sum(m, lab, range(1, n + 1))
        keep = np.isin(lab, 1 + np.where(sizes >= max(40, sizes.max() * 0.004))[0])
        m = keep
    soft = ndi.gaussian_filter(m.astype(np.float32), 0.7)

    d = resize(run_depth(im), OUT)
    vals = d[m]
    lo, hi = np.percentile(vals, 2), np.percentile(vals, 98)
    dn = np.clip((d - lo) / max(hi - lo, 1e-6), 0, 1)
    dist = ndi.distance_transform_edt(m)
    ramp = np.clip(dist / (OUT * 0.035), 0, 1)
    ramp = ramp * ramp * (3 - 2 * ramp)
    z = ramp * (0.2 + 0.8 * dn)
    z = ndi.gaussian_filter(z, 1.0) * m
    q = np.round(np.clip(z, 0, 1) * 65535).astype(np.uint16)
    outp = np.stack([(q >> 8).astype(np.uint8), np.round(soft * 255).astype(np.uint8), (q & 255).astype(np.uint8)], 2)
    Image.fromarray(outp, 'RGB').save(os.path.join(out, name + '.png'), optimize=True)
    viz = np.concatenate([rgb.astype(np.uint8), np.repeat((m * 255).astype(np.uint8)[..., None], 3, 2), np.repeat((z * 255).astype(np.uint8)[..., None], 3, 2)], 1)
    Image.fromarray(viz).resize((OUT * 3 // 2, OUT // 2)).save(os.path.join(dbg, name + '.jpg'), quality=80)
    print(name, flush=True)