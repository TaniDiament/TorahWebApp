import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Author } from '../types';

interface AuthorButtonProps {
  author: Author;
  onPress: () => void;
}

const AuthorButton: React.FC<AuthorButtonProps> = ({ author, onPress }) => {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>👤</Text>
      </View>
      <Text style={styles.text} numberOfLines={2}>
        {author.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: 18,
    marginBottom: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 52,
    height: 52,
    backgroundColor: '#1a3a5c',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 26,
  },
  text: {
    fontSize: 14,
    textAlign: 'center',
    color: '#1a3a5c',
    fontWeight: '600',
    lineHeight: 20,
  },
});

export default AuthorButton;

