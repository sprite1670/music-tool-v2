/**
 * 批量给使用了 SCSS 语法的 <style> 标签加上 lang="scss"
 */
const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, 'src')

function findVueFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      findVueFiles(full, files)
    } else if (entry.endsWith('.vue')) {
      files.push(full)
    }
  }
  return files
}

const scssPatterns = [
  /\$[a-zA-Z_-][a-zA-Z0-9_-]*/,   // SCSS 变量
  /&\s*[:{]/,                       // 嵌套语法 &:hover 或 & {
]

let fixed = 0
for (const file of findVueFiles(srcDir)) {
  let content = fs.readFileSync(file, 'utf-8')
  // 检查是否包含 SCSS 语法但没有 lang="scss"
  const hasScssSyntax = scssPatterns.some(p => p.test(content))
  const hasLangScss = /<style[^>]*lang\s*=\s*["']scss["'][^>]*>/i.test(content)

  if (hasScssSyntax && !hasLangScss) {
    content = content.replace(/<style([^>]*)>/g, (match, attrs) => {
      // 避免重复添加
      if (attrs.includes('lang=')) return match
      return `<style lang="scss"${attrs}>`
    })
    fs.writeFileSync(file, content)
    console.log('Fixed:', path.relative(__dirname, file))
    fixed++
  }
}

console.log(`Fixed ${fixed} files`)
