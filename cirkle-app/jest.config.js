const nextJest = require('next/jest')

const createJestConfig = nextJest({

  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {

    '^@/(.*)$': '<rootDir>/$1',
  },

  transform: {
    '\\.tsx?$': ['ts-jest', { 
      babelConfig: false, 
      tsconfig: './tsconfig.jest.json'
    }],
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
}

module.exports = createJestConfig(customJestConfig)