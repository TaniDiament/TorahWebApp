module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // The RN preset only transforms react-native / @react-native(-community).
  // The navigation stack, screens, safe-area-context and vector-icons all ship
  // untranspiled ESM, so widen the allow-list (a project-level value replaces
  // the preset's entirely, so the base RN entries are repeated here).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native(-.*)?|@react-native(-community|-vector-icons)?|@react-navigation)/)',
  ],
};
