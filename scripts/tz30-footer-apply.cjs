(function applyTZ30Footer(){
  'use strict';
  const fs=require('node:fs');
  const p='shared/classifier-lexer.mjs';
  const s=fs.readFileSync(p,'utf8');
  const key='  const useful = rows.some(evidence) ? rows.filter((r) => !prose(r)) : rows;';
  if(!s.includes(key))throw Error('TZ30 footer filtering patch anchor missing');
  const patch=`  // Receipt coupons and discount announcements are not account records.\n  // Preserve any ambiguous line containing a real identity or cookie for review.\n  const receiptFooter = (r) => {\n    const raw = r.sourceRecord.trim();\n    if (!/^(?:Купон на скидку|Время жизни купона|Coupon(?: code)?|Discount(?: code)?|Promo(?:tional)? code)\\b|^(?:Купон на скидку|Время жизни купона)(?:\\s|:)/iu.test(raw)) return false;\n    if (/[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}/.test(raw)) return false;\n    if (/https?:\\/\\/www\\.facebook\\.com\\/profile\\.php\\?id=\\d+|\\\"name\\\"\\s*:\\s*\\\"c_user\\\"/i.test(raw)) return false;\n    return true;\n  };\n  const useful = rows.some(evidence) ? rows.filter((r) => !prose(r) && !receiptFooter(r)) : rows;`;
  fs.writeFileSync(p,s.replace(key,patch));
  console.log('TZ30 receipt footer classifier fixed');
})();
