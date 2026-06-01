const fs = require('fs');
const path = require('path');

// SCSS 变量 → CSS 值映射（根据 _variables.scss）
const varMap = {
  '\\$primary-color': '#4ECDC4',
  '\\$primary-light': '#7EDDD6',
  '\\$primary-dark': '#26A69A',
  '\\$primary-bg': 'rgba(78, 205, 196, 0.08)',
  '\\$secondary-color': '#95E1D3',
  '\\$accent-color': '#FF6B6B',
  '\\$accent-light': '#FF8E8E',
  '\\$bg-primary': '#F7F9FC',
  '\\$bg-secondary': '#FFFFFF',
  '\\$bg-tertiary': '#EEF2F7',
  '\\$text-primary': '#2C3E50',
  '\\$text-secondary': '#7F8C8D',
  '\\$text-muted': '#AAB7C4',
  '\\$border-color': '#E1E8ED',
  '\\$border-light': '#F0F3F6',
  '\\$success': '#2ECC71',
  '\\$warning': '#F39C12',
  '\\$error': '#E74C3C',
  '\\$info': '#3498DB',
  '\\$shadow-sm': '0 2px 8px rgba(0, 0, 0, 0.04)',
  '\\$shadow-md': '0 4px 16px rgba(0, 0, 0, 0.06)',
  '\\$shadow-lg': '0 8px 32px rgba(0, 0, 0, 0.08)',
  '\\$shadow-hover': '0 6px 24px rgba(78, 205, 196, 0.15)',
  '\\$radius-xs': '4px',
  '\\$radius-sm': '6px',
  '\\$radius-md': '10px',
  '\\$radius-lg': '16px',
  '\\$radius-xl': '20px',
  '\\$spacing-xs': '4px',
  '\\$spacing-sm': '8px',
  '\\$spacing-md': '16px',
  '\\$spacing-lg': '24px',
  '\\$spacing-xl': '32px',
  '\\$spacing-xxl': '48px',
  '\\$header-height': '56px',
  '\\$sidebar-width': '220px',
  '\\$sidebar-collapsed-width': '64px',
  '\\$player-height': '64px',
};

function walkDir(dir) {
  let files;
  try { files = fs.readdirSync(dir); } catch(e) { return; }
  for (const f of files) {
    const full = path.join(dir, f);
    try {
      if (fs.statSync(full).isDirectory()) { walkDir(full); continue; }
      if (!f.endsWith('.vue') && !f.endsWith('.scss')) continue;
      let content = fs.readFileSync(full, 'utf8');
      let changed = false;
      // 替换 SCSS 变量
      for (const [key, val] of Object.entries(varMap)) {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(escapedKey, 'g');
        if (re.test(content)) {
          content = content.replace(re, val);
          changed = true;
        }
      }
      // 去掉 lang="scss"
      if (content.includes('lang="scss"')) {
        content = content.replace(/<style\s+lang="scss"(\s+scoped)?>/g, '<style scoped>');
        changed = true;
      }
      // 去掉 @use 语句
      if (content.includes('@use')) {
        content = content.replace(/@use\s+[^;]+;/g, '');
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(full, content, 'utf8');
        console.log('Fixed:', full);
      }
    } catch(e) { console.error('Error processing', full, e.message); }
  }
}
walkDir('./src');
console.log('Done!');
