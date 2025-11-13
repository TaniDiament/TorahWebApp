import { Author, Topic, Article, Video, Audio, SearchParams } from '../types';

const BASE_URL = 'https://torahweb.org';

export const api = {
  // Fetch all authors
  async getAuthors(): Promise<Author[]> {
    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch(`${BASE_URL}/api/authors`);
      // return await response.json();

      // Mock data for now
      return [
        { id: '1', name: 'Rabbi Sample Author 1' },
        { id: '2', name: 'Rabbi Sample Author 2' },
        { id: '3', name: 'Rabbi Sample Author 3' },
      ];
    } catch (error) {
      console.error('Error fetching authors:', error);
      return [];
    }
  },

  // Fetch all topics
  async getTopics(): Promise<Topic[]> {
    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch(`${BASE_URL}/api/topics`);
      // return await response.json();

      // Mock data for now
      return [
        { id: '1', name: 'Parsha' },
        { id: '2', name: 'Jewish Law' },
        { id: '3', name: 'Philosophy' },
        { id: '4', name: 'Holidays' },
      ];
    } catch (error) {
      console.error('Error fetching topics:', error);
      return [];
    }
  },

  // Search content
  async searchContent(params: SearchParams): Promise<(Article | Video | Audio)[]> {
    try {
      // TODO: Replace with actual API endpoint
      // const queryString = new URLSearchParams(params as any).toString();
      // const response = await fetch(`${BASE_URL}/api/search?${queryString}`);
      // return await response.json();

      // Mock data for now
      return [];
    } catch (error) {
      console.error('Error searching content:', error);
      return [];
    }
  },

  // Fetch articles
  async getArticles(): Promise<Article[]> {
    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch(`${BASE_URL}/api/articles`);
      // return await response.json();

      // Mock data for now
      return [];
    } catch (error) {
      console.error('Error fetching articles:', error);
      return [];
    }
  },

  // Fetch videos
  async getVideos(): Promise<Video[]> {
    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch(`${BASE_URL}/api/videos`);
      // return await response.json();

      // Mock data for now
      return [];
    } catch (error) {
      console.error('Error fetching videos:', error);
      return [];
    }
  },

  // Fetch audio
  async getAudio(): Promise<Audio[]> {
    try {
      // TODO: Replace with actual API endpoint
      // const response = await fetch(`${BASE_URL}/api/audio`);
      // return await response.json();

      // Mock data for now
      return [];
    } catch (error) {
      console.error('Error fetching audio:', error);
      return [];
    }
  },
};

