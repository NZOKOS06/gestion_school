import fs from 'fs';
import path from 'path';

const dir = 'server/src/controllers';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'));
const issues = [];

for (const f of files) {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    const lineNum = i + 1;

    // Detect undefined variable usage (common copy-paste bugs)
    const spreadMatch = line.match(/\.\.\.([\w]+)/);
    if (spreadMatch) {
      const varName = spreadMatch[1];
      if (!content.includes(`const ${varName}`) && !content.includes(`let ${varName}`) && !content.includes(`var ${varName}`)) {
        // Ignore common destructuring patterns
        if (!['args', 'rest', 'props', 'params', 'opts', 'data'].includes(varName)) {
          issues.push({ file: f, line: lineNum, issue: `spread of possibly undeclared variable: ${varName}`, code: line.trim() });
        }
      }
    }

    // Detect potential prisma model field mismatches: tx.user.create/update with role
    if ((line.includes('user.create') || line.includes('user.update'))) {
      const block = lines.slice(i, Math.min(i + 25, lines.length)).join('\n');
      if (/role\s*:/.test(block)) {
        issues.push({ file: f, line: lineNum, issue: 'User.create/update may have invalid role field (User model has no role)', code: line.trim() });
      }
    }
  });
}

if (issues.length === 0) {
  console.log('✅ No obvious controller issues found.');
} else {
  console.log(`Found ${issues.length} potential issues:\n`);
  issues.forEach(i => console.log(`  [${i.file}:${i.line}] ${i.issue}\n    > ${i.code}\n`));
}
