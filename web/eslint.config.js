// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Errores silenciosos = datos corruptos sin rastro (guía §11).
      'no-empty': ['error', { allowEmptyCatch: false }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
      // Nada de innerHTML con datos del usuario (guía §8).
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Usa JSX; innerHTML abre la puerta a XSS.' },
      ],
      // El dominio no llama a now() directamente: usa el Reloj inyectado (guía §6).
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Usa el Reloj inyectado en lugar de Date.now().',
        },
      ],
    },
  },
  {
    // Reloj del sistema y pruebas: únicos lugares donde se permite leer la hora real.
    files: ['src/nucleo/infraestructura/reloj-del-sistema.ts', 'src/**/*.test.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['src/sw/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Promise: 'readonly',
      },
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts'],
    languageOptions: { globals: { process: 'readonly' } },
  },
);
