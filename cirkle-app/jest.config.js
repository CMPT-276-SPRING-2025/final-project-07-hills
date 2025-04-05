// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(ts|tsx)$': 'babel-jest',  // Use babel-jest for TypeScript files
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',  // Adjust this if necessary to match your project structure
  },
};
