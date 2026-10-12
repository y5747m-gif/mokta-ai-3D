/* ============================================================
 * harness.mjs — أدوات اختبار بسيطة (بدون اعتماديات خارجية)
 * ============================================================ */

let passed = 0;
let failed = 0;
const failures = [];

export function section(title) {
  console.log('\n\x1b[1m■ ' + title + '\x1b[0m');
}

export function ok(cond, label) {
  if (cond) {
    passed++;
    console.log('  \x1b[32m✓\x1b[0m ' + label);
  } else {
    failed++;
    failures.push(label);
    console.log('  \x1b[31m✗ ' + label + '\x1b[0m');
  }
}

export function eq(actual, expected, label) {
  const good = actual === expected;
  ok(good, label + (good ? '' : '  (expected: ' + JSON.stringify(expected) + ', got: ' + JSON.stringify(actual) + ')'));
}

export function summary() {
  console.log('\n───────────────────────────────');
  console.log('النتيجة: ' + passed + ' ناجح، ' + failed + ' فاشل');
  if (failures.length) {
    console.log('الاختبارات الفاشلة:');
    for (const f of failures) console.log('  ✗ ' + f);
    process.exitCode = 1;
  }
}
