import globals from 'globals';

export default [
  { ignores: ['vendor/**', 'node_modules/**', '.tools/**', 'supabase/**'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, supabase: 'readonly', Chart: 'readonly', JSZip: 'readonly' }
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-redeclare': 'error',
      'no-unreachable': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-unsafe-finally': 'error',
      'valid-typeof': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }]
    }
  },
  { files: ['tests/**/*.js', 'scripts/**/*.js', 'finance-rules.js', 'runtime-utils.js', 'reports-rules.js', 'dashboard-overview.js', 'capitalizacao/regras.js'], languageOptions: { globals: { ...globals.browser, ...globals.node } } }
];
