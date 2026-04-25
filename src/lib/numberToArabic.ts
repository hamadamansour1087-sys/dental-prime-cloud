// تحويل رقم إلى مبلغ بالحروف العربية (للسندات المالية)

const ones = [
  "", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
  "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
  "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر",
];
const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function under1000(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t] : `${ones[o]} و${tens[t]}`;
  }
  const h = Math.floor(n / 100);
  const r = n % 100;
  return r === 0 ? hundreds[h] : `${hundreds[h]} و${under1000(r)}`;
}

function thousandsForm(n: number): string {
  if (n === 1) return "ألف";
  if (n === 2) return "ألفان";
  if (n >= 3 && n <= 10) return `${under1000(n)} آلاف`;
  return `${under1000(n)} ألفًا`;
}

function millionsForm(n: number): string {
  if (n === 1) return "مليون";
  if (n === 2) return "مليونان";
  if (n >= 3 && n <= 10) return `${under1000(n)} ملايين`;
  return `${under1000(n)} مليونًا`;
}

export function numberToArabicWords(num: number, currency = "جنيهًا مصريًا"): string {
  if (!isFinite(num) || num <= 0) return "صفر " + currency + " فقط لا غير";
  const rounded = Math.round(num * 100) / 100;
  const intPart = Math.floor(rounded);
  const fraction = Math.round((rounded - intPart) * 100);

  const millions = Math.floor(intPart / 1_000_000);
  const thousands = Math.floor((intPart % 1_000_000) / 1000);
  const rest = intPart % 1000;

  const parts: string[] = [];
  if (millions > 0) parts.push(millionsForm(millions));
  if (thousands > 0) parts.push(thousandsForm(thousands));
  if (rest > 0) parts.push(under1000(rest));

  let result = parts.join(" و") || "صفر";
  result += " " + currency;
  if (fraction > 0) {
    result += ` و${under1000(fraction)} قرشًا`;
  }
  return "فقط " + result + " لا غير";
}
