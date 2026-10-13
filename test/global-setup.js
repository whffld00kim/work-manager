// 시험 전에 한 번: index.html 이 쓰는 Tailwind 클래스를 npm 의 tailwindcss 로 미리 컴파일해 둔다.
// (cdn.tailwindcss.com 스크립트는 실행 시점에 같은 일을 한다 — 시험은 네트워크 없이도 같은 모양으로 돌아야 하므로)
const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  const root = path.resolve(__dirname, '..');
  const cacheDir = path.join(__dirname, '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const out = path.join(cacheDir, 'tailwind.css');
  const index = path.join(root, 'index.html');
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(index).mtimeMs) return;
  const postcss = require('postcss');
  const tailwindcss = require('tailwindcss');
  const result = await postcss([
    tailwindcss({ content: [index], darkMode: 'class' }),   // index.html 의 tailwind.config 와 같게
  ]).process('@tailwind base;\n@tailwind components;\n@tailwind utilities;\n', { from: undefined });
  fs.writeFileSync(out, result.css);
};
