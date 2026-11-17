// 시험 전에 한 번: 화면 코드(app.js)와 꾸밈 규칙(app.css)이 원본(src/app.jsx · src/tw.css · index.html · tailwind.config.js)보다 낡았으면 다시 만든다.
// (2026-11-17 전엔 여기서 시험용 테일윈드 CSS 를 따로 만들었다 — 이제 앱이 쓰는 app.css 그대로 시험한다)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

module.exports = async function globalSetup() {
  const root = path.resolve(__dirname, '..');
  const m = f => { try { return fs.statSync(path.join(root, f)).mtimeMs; } catch { return 0; } };
  const src = Math.max(m('src/app.jsx'), m('src/tw.css'), m('index.html'), m('tailwind.config.js'));
  if (m('app.js') >= m('src/app.jsx') && m('app.css') >= src) return;
  console.log('app.js·app.css 가 원본보다 낡아 다시 만듭니다 (npm run build)');
  execFileSync(process.execPath, [path.join(root, 'build.js')], { cwd: root, stdio: 'inherit' });
};
