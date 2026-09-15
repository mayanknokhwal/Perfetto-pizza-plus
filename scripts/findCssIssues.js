const fs = require('fs');
const path = require('path');

const checks = [
  { prefix: '-webkit-line-clamp', standard: 'line-clamp' },
  { prefix: '-webkit-background-clip', standard: 'background-clip' },
  { prefix: '-webkit-user-select', standard: 'user-select' },
  { prefix: '-webkit-mask-image', standard: 'mask-image' },
  { prefix: '-webkit-backdrop-filter', standard: 'backdrop-filter' },
  { prefix: '-webkit-appearance', standard: 'appearance' }
];

['styles.css', 'staff.css', 'admin.html', 'index.html', 'staff.html'].forEach(filename => {
  const filepath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filepath)) return;
  const lines = fs.readFileSync(filepath, 'utf8').split('\n');
  console.log('=== ' + filename + ' ===');
  checks.forEach(({ prefix, standard }) => {
    lines.forEach((line, idx) => {
      if (line.includes(prefix)) {
        const start = Math.max(0, idx - 6);
        const end = Math.min(lines.length - 1, idx + 6);
        const block = lines.slice(start, end + 1).join('\n');
        const regex = new RegExp('(?:^|[^a-zA-Z-])' + standard + '\\s*:', 'm');
        if (!regex.test(block)) {
          console.log(`  Line ${idx + 1}: ${line.trim()} (missing standard: ${standard})`);
        }
      }
    });
  });
});
