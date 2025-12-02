#!/usr/bin/env npx tsx
/**
 * Security Checker Script for KomikRu Project
 * Run with: npx tsx scripts/security-check.ts
 * Or add to package.json: "security:check": "npx tsx scripts/security-check.ts"
 */

import * as fs from 'fs';
import * as path from 'path';

interface SecurityIssue {
  severity: 'error' | 'warning' | 'info';
  type: string;
  file: string;
  line?: number;
  message: string;
  snippet?: string;
}

const issues: SecurityIssue[] = [];

// Patterns to detect potential hardcoded secrets
const SECRET_PATTERNS = [
  { pattern: /['"]sk[-_][a-zA-Z0-9]{20,}['"]/gi, name: 'Stripe Secret Key' },
  { pattern: /['"]AKIA[A-Z0-9]{16}['"]/g, name: 'AWS Access Key' },
  { pattern: /['"]ghp_[a-zA-Z0-9]{36}['"]/g, name: 'GitHub Token' },
  { pattern: /['"]xox[baprs]-[a-zA-Z0-9-]{10,}['"]/g, name: 'Slack Token' },
  { pattern: /service[-_]?role[-_]?key\s*[=:]\s*['"][^'"]{20,}['"]/gi, name: 'Service Role Key' },
  { pattern: /api[-_]?key\s*[=:]\s*['"][a-zA-Z0-9_-]{20,}['"]/gi, name: 'API Key Assignment' },
  { pattern: /secret[-_]?key\s*[=:]\s*['"][^'"]{16,}['"]/gi, name: 'Secret Key Assignment' },
  { pattern: /password\s*[=:]\s*['"][^'"]{8,}['"]/gi, name: 'Hardcoded Password' },
];

// Patterns for dangerous code
const DANGEROUS_PATTERNS = [
  { pattern: /supabase\.storage\.from\(/g, name: 'Direct Storage Upload', severity: 'warning' as const },
  { pattern: /dangerouslySetInnerHTML/g, name: 'Dangerous HTML Injection', severity: 'error' as const },
  { pattern: /eval\s*\(/g, name: 'Eval Usage', severity: 'error' as const },
  { pattern: /innerHTML\s*=/g, name: 'innerHTML Assignment', severity: 'warning' as const },
  { pattern: /document\.write/g, name: 'Document Write', severity: 'warning' as const },
  { pattern: /localStorage\.setItem.*password/gi, name: 'Password in LocalStorage', severity: 'error' as const },
  { pattern: /sessionStorage\.setItem.*password/gi, name: 'Password in SessionStorage', severity: 'error' as const },
];

// Files and directories to exclude
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.cache'];
const EXCLUDE_FILES = ['.lock', '.lockb', '.map', '.d.ts'];

// File extensions to check
const CHECK_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.sql', '.env'];

function shouldCheckFile(filePath: string): boolean {
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath);
  
  // Exclude directories
  if (EXCLUDE_DIRS.some(dir => filePath.includes(`${path.sep}${dir}${path.sep}`) || filePath.includes(`/${dir}/`))) {
    return false;
  }
  
  // Exclude specific file patterns
  if (EXCLUDE_FILES.some(pattern => fileName.includes(pattern))) {
    return false;
  }
  
  // Only check specific extensions
  return CHECK_EXTENSIONS.includes(ext) || fileName.startsWith('.env');
}

function getFilesRecursively(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        if (!EXCLUDE_DIRS.includes(item.name)) {
          files.push(...getFilesRecursively(fullPath));
        }
      } else if (shouldCheckFile(fullPath)) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Ignore permission errors
  }
  
  return files;
}

function checkForSecrets(content: string, filePath: string): void {
  const lines = content.split('\n');
  
  for (const { pattern, name } of SECRET_PATTERNS) {
    // Reset regex
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      // Skip if it's using environment variables
      const line = lines[lineNumber - 1] || '';
      if (line.includes('process.env') || line.includes('Deno.env') || line.includes('import.meta.env')) {
        continue;
      }
      
      // Skip if in comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) {
        continue;
      }
      
      issues.push({
        severity: 'error',
        type: 'HARDCODED_SECRET',
        file: filePath,
        line: lineNumber,
        message: `Potential ${name} detected`,
        snippet: line.trim().substring(0, 80),
      });
    }
  }
}

function checkForDangerousPatterns(content: string, filePath: string): void {
  const lines = content.split('\n');
  
  // Skip if it's a security utils file (legitimate use)
  if (filePath.includes('security-utils') || filePath.includes('securityHelpers')) {
    return;
  }
  
  for (const { pattern, name, severity } of DANGEROUS_PATTERNS) {
    pattern.lastIndex = 0;
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const line = lines[lineNumber - 1] || '';
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }
      
      // For storage uploads, check if it's in src/lib/storage.ts (known file)
      if (name === 'Direct Storage Upload') {
        if (filePath.includes('src/lib/storage.ts') || filePath.includes('src\\lib\\storage.ts')) {
          issues.push({
            severity: 'warning',
            type: 'DIRECT_STORAGE_UPLOAD',
            file: filePath,
            line: lineNumber,
            message: 'Direct client-side storage upload bypasses server-side security checks',
            snippet: line.trim().substring(0, 80),
          });
        }
        continue;
      }
      
      issues.push({
        severity,
        type: name.toUpperCase().replace(/\s+/g, '_'),
        file: filePath,
        line: lineNumber,
        message: `${name} detected - potential security risk`,
        snippet: line.trim().substring(0, 80),
      });
    }
  }
}

function checkRLSDisabled(content: string, filePath: string): void {
  if (!filePath.endsWith('.sql')) return;
  
  const lines = content.split('\n');
  const pattern = /DISABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    const line = lines[lineNumber - 1] || '';
    
    issues.push({
      severity: 'error',
      type: 'RLS_DISABLED',
      file: filePath,
      line: lineNumber,
      message: 'Row Level Security is being disabled - this is extremely dangerous',
      snippet: line.trim(),
    });
  }
}

function checkEnvUsage(): void {
  const envExamplePath = '.env.example';
  const definedEnvVars = new Set<string>();
  
  // Read .env.example if it exists
  if (fs.existsSync(envExamplePath)) {
    const content = fs.readFileSync(envExamplePath, 'utf-8');
    const matches = content.match(/^([A-Z_][A-Z0-9_]*)\s*=/gm);
    if (matches) {
      matches.forEach(m => {
        const varName = m.replace(/\s*=.*/, '');
        definedEnvVars.add(varName);
      });
    }
  }
  
  // Common env vars that are always available
  const commonEnvVars = new Set([
    'NODE_ENV', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 
    'VITE_SUPABASE_PROJECT_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_DB_URL',
  ]);
  
  // Check source files for env var usage
  const files = getFilesRecursively('src').concat(getFilesRecursively('supabase/functions'));
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Match process.env.VAR_NAME, import.meta.env.VAR_NAME, Deno.env.get('VAR_NAME')
      const patterns = [
        /process\.env\.([A-Z_][A-Z0-9_]*)/g,
        /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
        /Deno\.env\.get\(['"]([A-Z_][A-Z0-9_]*)['"]\)/g,
      ];
      
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const varName = match[1];
          if (!definedEnvVars.has(varName) && !commonEnvVars.has(varName)) {
            const beforeMatch = content.substring(0, match.index);
            const lineNumber = beforeMatch.split('\n').length;
            
            issues.push({
              severity: 'info',
              type: 'MISSING_ENV_EXAMPLE',
              file,
              line: lineNumber,
              message: `Environment variable ${varName} not documented in .env.example`,
            });
          }
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }
}

function checkConfigSecurity(): void {
  const configPath = 'supabase/config.toml';
  
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8');
    
    // Check for verify_jwt = false
    const lines = content.split('\n');
    let currentFunction = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track current function section
      const funcMatch = line.match(/\[functions\.([^\]]+)\]/);
      if (funcMatch) {
        currentFunction = funcMatch[1];
      }
      
      // Check for verify_jwt = false
      if (line.includes('verify_jwt') && line.includes('false')) {
        // Check if it's a function that should have JWT
        const sensitivePatterns = ['scrape', 'delete', 'upload', 'admin', 'sync'];
        const isSensitive = sensitivePatterns.some(p => currentFunction.includes(p));
        
        if (isSensitive) {
          issues.push({
            severity: 'warning',
            type: 'JWT_DISABLED',
            file: configPath,
            line: i + 1,
            message: `JWT verification disabled for sensitive function: ${currentFunction}`,
          });
        }
      }
    }
  }
}

// Main execution
console.log('\n🔒 Security Check Starting...\n');
console.log('='.repeat(50));

// Get all files
const srcFiles = getFilesRecursively('src');
const supabaseFiles = getFilesRecursively('supabase');
const allFiles = [...srcFiles, ...supabaseFiles];

console.log(`\nScanning ${allFiles.length} files...\n`);

// Run checks
for (const file of allFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    checkForSecrets(content, file);
    checkForDangerousPatterns(content, file);
    checkRLSDisabled(content, file);
  } catch (e) {
    // Ignore read errors
  }
}

// Additional checks
checkEnvUsage();
checkConfigSecurity();

// Group and display results
const errors = issues.filter(i => i.severity === 'error');
const warnings = issues.filter(i => i.severity === 'warning');
const infos = issues.filter(i => i.severity === 'info');

console.log('='.repeat(50));
console.log('\n📊 Security Check Results:\n');

if (errors.length > 0) {
  console.log(`❌ ${errors.length} ERROR(S):`);
  errors.forEach(e => {
    console.log(`   [${e.type}] ${e.file}${e.line ? `:${e.line}` : ''}`);
    console.log(`   → ${e.message}`);
    if (e.snippet) console.log(`   → "${e.snippet}"`);
    console.log('');
  });
}

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} WARNING(S):`);
  warnings.forEach(w => {
    console.log(`   [${w.type}] ${w.file}${w.line ? `:${w.line}` : ''}`);
    console.log(`   → ${w.message}`);
    if (w.snippet) console.log(`   → "${w.snippet}"`);
    console.log('');
  });
}

if (infos.length > 0) {
  console.log(`ℹ️  ${infos.length} INFO:`);
  infos.slice(0, 5).forEach(i => {
    console.log(`   [${i.type}] ${i.file}${i.line ? `:${i.line}` : ''}`);
    console.log(`   → ${i.message}`);
    console.log('');
  });
  if (infos.length > 5) {
    console.log(`   ... and ${infos.length - 5} more info items\n`);
  }
}

console.log('='.repeat(50));
console.log('\n📋 Summary:');
console.log(`   Errors:   ${errors.length}`);
console.log(`   Warnings: ${warnings.length}`);
console.log(`   Info:     ${infos.length}`);
console.log('');

// Exit with error code if there are errors
if (errors.length > 0) {
  console.log('❌ Security check FAILED - fix errors before deploying!\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('⚠️  Security check passed with warnings\n');
  process.exit(0);
} else {
  console.log('✅ Security check PASSED\n');
  process.exit(0);
}
