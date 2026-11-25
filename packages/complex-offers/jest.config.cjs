/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  watchman: false,
  rootDir: '.',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@open-mercato/complex-offers/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      // Shared transformer: MikroORM ships ESM-only decorator entrypoints, and
      // `@open-mercato/*` packages resolve to their TypeScript sources.
      '<rootDir>/../../scripts/jest-mikroorm-transformer.cjs',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          target: 'es2022',
          esModuleInterop: true,
          allowJs: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(@mikro-orm|@open-mercato)/)'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
  passWithNoTests: true,
}
