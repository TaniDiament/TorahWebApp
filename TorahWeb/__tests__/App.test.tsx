/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from '../App';

jest.mock('../src/services/api', () => ({
  api: {
    getAuthors: jest.fn().mockResolvedValue([]),
    getTopics: jest.fn().mockResolvedValue([]),
    getRecent: jest.fn().mockResolvedValue([]),
    getContentByAuthor: jest.fn().mockResolvedValue([]),
    getContentByTopic: jest.fn().mockResolvedValue([]),
    searchContent: jest.fn().mockResolvedValue([]),
  },
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(async () => {
    ReactTestRenderer.create(
      <SafeAreaProvider>
        <App />
      </SafeAreaProvider>,
    );
    await (globalThis as any).flushAsync();
  });
});
