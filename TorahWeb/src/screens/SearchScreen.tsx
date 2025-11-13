import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Content, ContentType } from '../types';
import { api } from '../services/api';
import ArticleCard from '../components/ArticleCard';

interface SearchScreenProps {
  onContentSelect: (content: Content) => void;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ onContentSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Content[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<ContentType | 'all'>('all');

  useEffect(() => {
    if (searchQuery.length > 2) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [searchQuery, selectedType]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const searchResults = await api.searchContent({
        query: searchQuery,
        contentType: selectedType === 'all' ? undefined : selectedType,
      });
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderContentTypeButton = (type: ContentType | 'all', label: string) => (
    <TouchableOpacity
      style={[
        styles.typeButton,
        selectedType === type && styles.typeButtonActive,
      ]}
      onPress={() => setSelectedType(type)}
    >
      <Text
        style={[
          styles.typeButtonText,
          selectedType === type && styles.typeButtonTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search articles, videos, audio..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.filterContainer}>
        {renderContentTypeButton('all', 'All')}
        {renderContentTypeButton('article', 'Articles')}
        {renderContentTypeButton('video', 'Videos')}
        {renderContentTypeButton('audio', 'Audio')}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ArticleCard content={item} onPress={() => onContentSelect(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery.length > 2
                  ? 'No results found'
                  : 'Enter at least 3 characters to search'}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  searchContainer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    height: 48,
    borderWidth: 2,
    borderColor: '#1a3a5c',
    borderRadius: 6,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#333333',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  typeButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginHorizontal: 5,
    borderRadius: 6,
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  typeButtonActive: {
    backgroundColor: '#1a3a5c',
    borderColor: '#1a3a5c',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#555555',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 10,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default SearchScreen;

