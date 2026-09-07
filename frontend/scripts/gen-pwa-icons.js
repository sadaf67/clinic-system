// ══════════════════════════════════════════════════════════════
// gen-pwa-icons.js — یه‌بار اجرا میشه تا آیکون‌های PNG لازم برای
// نصب‌پذیری PWA (192x192 و 512x512) از روی طرح icon.svg موجود
// بسازه — بدون نیاز به هیچ پکیج تصویرسازی (sharp/canvas) که
// نصبش با محدودیت‌های شبکه ممکنه به مشکل بخوره.
//
// همون طرح icon.svg (مربع آبی گردگوشه + علامت + سفید وسطش) رو
// پیکسل به پیکسل رسم و به PNG واقعی انکود می‌کنه (بدون هیچ
// وابستگی خارجی، فقط با zlib داخلی Node).
//
// خروجی: public/icons/icon-192.png و public/icons/icon-512.png
// این اسکریپت بعد از اجرا لازم نیست دوباره اجرا بشه؛ می‌مونه
// توی repo برای مستندسازی/تغییرات بعدی طرح آیکون.
// ══════════════════════════════════════════════════════════════
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// ─── جدول CRC-32 استاندارد (الگوریتم عمومی PNG/zlib) ─────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// ─── رسم طرح آیکون روی یه بافر RGBA در اندازه N×N ─────────────
// طرح از روی src/app/icon.svg (viewBox 0 0 32 32):
//   پس‌زمینه: مربع آبی #2563eb با شعاع گوشه ۸
//   روش: علامت + سفید (میله عمودی 13-19 در 7-25، میله افقی 7-25 در 13-19)
function drawIcon(n) {
  const scale = n / 32;
  const r = 8 * scale; // شعاع گوشه گرد
  const buf = Buffer.alloc(n * n * 4);
  const bg = [0x25, 0x63, 0xeb, 0xff]; // #2563eb
  const fg = [0xff, 0xff, 0xff, 0xff]; // سفید

  const vx0 = 13 * scale, vx1 = 19 * scale, vy0 = 7 * scale, vy1 = 25 * scale; // میله عمودی
  const hx0 = 7 * scale, hx1 = 25 * scale, hy0 = 13 * scale, hy1 = 19 * scale; // میله افقی

  const insideRoundedRect = (x, y) => {
    // چهار گوشه: اگه پیکسل توی ناحیه گوشه بود، باید داخل دایره شعاع r باشه
    const cx = x < r ? r : x > n - r ? n - r : x;
    const cy = y < r ? r : y > n - r ? n - r : y;
    if ((x < r || x > n - r) && (y < r || y > n - r)) {
      const dx = x - cx, dy = y - cy;
      return dx * dx + dy * dy <= r * r;
    }
    return true;
  };

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const idx = (y * n + x) * 4;
      const cx = x + 0.5, cy = y + 0.5; // مرکز پیکسل برای دقت بهتر لبه‌ها
      let color = null;
      if (insideRoundedRect(cx, cy)) {
        const isPlus = (cx >= vx0 && cx <= vx1 && cy >= vy0 && cy <= vy1) ||
                       (cx >= hx0 && cx <= hx1 && cy >= hy0 && cy <= hy1);
        color = isPlus ? fg : bg;
      }
      if (color) {
        buf[idx] = color[0]; buf[idx + 1] = color[1]; buf[idx + 2] = color[2]; buf[idx + 3] = color[3];
      } // وگرنه شفاف می‌مونه (پیش‌فرض بافر صفره = شفاف کامل)
    }
  }
  return buf;
}

// ─── نسخه maskable: برای آیکون‌های تطبیقی اندروید ─────────────
// این نسخه پس‌زمینه رو تا لبه پر می‌کنه (بدون گوشه گرد، چون
// سیستم‌عامل خودش ماسک/گوشه رو اعمال می‌کنه) و علامت + رو
// کوچیک‌تر و وسط‌چین می‌کشه تا داخل "safe zone" (دایره ۸۰٪ وسط)
// بیفته و موقع کراپ شدن قطع نشه.
function drawMaskableIcon(n) {
  const buf = Buffer.alloc(n * n * 4);
  const bg = [0x25, 0x63, 0xeb, 0xff];
  const fg = [0xff, 0xff, 0xff, 0xff];

  const cx0 = n / 2, cy0 = n / 2;
  const armHalfShort = n * (3 / 32) * 0.65; // ضخامت نصف میله (کوچک‌شده برای safe zone)
  const armHalfLong = n * (9 / 32) * 0.65;  // طول نصف میله

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const idx = (y * n + x) * 4;
      const dx = x + 0.5 - cx0, dy = y + 0.5 - cy0;
      const isPlus =
        (Math.abs(dx) <= armHalfShort && Math.abs(dy) <= armHalfLong) ||
        (Math.abs(dx) <= armHalfLong && Math.abs(dy) <= armHalfShort);
      const color = isPlus ? fg : bg;
      buf[idx] = color[0]; buf[idx + 1] = color[1]; buf[idx + 2] = color[2]; buf[idx + 3] = color[3];
    }
  }
  return buf;
}

function encodePng(n, maskable = false) {
  const raw = maskable ? drawMaskableIcon(n) : drawIcon(n);
  // هر ردیف با یه بایت فیلتر (0 = بدون فیلتر) شروع میشه
  const stride = n * 4;
  const withFilter = Buffer.alloc((stride + 1) * n);
  for (let y = 0; y < n; y++) {
    withFilter[y * (stride + 1)] = 0;
    raw.copy(withFilter, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(withFilter);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const png = encodePng(size);
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), png);
  console.log(`Wrote icon-${size}.png (${png.length} bytes)`);
}
const maskable = encodePng(512, true);
fs.writeFileSync(path.join(outDir, "icon-512-maskable.png"), maskable);
console.log(`Wrote icon-512-maskable.png (${maskable.length} bytes)`);
