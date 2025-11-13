import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ContentScreen from './src/screens/ContentScreen';
import { Content, Author, Topic } from './src/types';

const App = () => {
    const [currentScreen, setCurrentScreen] = useState<'home' | 'search' | 'content'>('home');
    const [selectedContent, setSelectedContent] = useState<Content | null>(null);

    const handleBackToHome = () => {
        console.log('Back button pressed, current screen:', currentScreen);
        setCurrentScreen('home');
        setSelectedContent(null);
        console.log('Navigating to home');
    };

    const handleAndroidBack = () => {
        console.log('Android back button pressed, current screen:', currentScreen);

        if (currentScreen === 'content') {
            // Go back to search screen
            setCurrentScreen('search');
            return true; // Prevent default back behavior
        } else if (currentScreen === 'search') {
            // Go back to home screen
            setCurrentScreen('home');
            setSelectedContent(null);
            return true; // Prevent default back behavior
        }

        // If on home screen, allow default behavior (exit app)
        return false;
    };

    useEffect(() => {
        // Add hardware back button listener for Android
        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            handleAndroidBack
        );

        // Cleanup listener on unmount
        return () => backHandler.remove();
    }, [currentScreen]); // Re-run when currentScreen changes

    console.log('App render - currentScreen:', currentScreen);

    return (
        <SafeAreaView style={styles.container}>
            {currentScreen !== 'home' && (
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBackToHome}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                </View>
            )}
            <View style={styles.content}>
                {currentScreen === 'home' && (
                    <HomeScreen
                        onAuthorPress={(_author: Author) => setCurrentScreen('search')}
                        onTopicPress={(_topic: Topic) => setCurrentScreen('search')}
                    />
                )}
                {currentScreen === 'search' && (
                    <SearchScreen
                        onContentSelect={(content: Content) => {
                            setSelectedContent(content);
                            setCurrentScreen('content');
                        }}
                    />
                )}
                {currentScreen === 'content' && selectedContent && (
                    <ContentScreen content={selectedContent} />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        height: 56,
        justifyContent: 'center',
        paddingHorizontal: 16,
        backgroundColor: '#1a3a5c',
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    backButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignSelf: 'flex-start',
        backgroundColor: 'transparent',
        zIndex: 1001,
    },
    backButtonText: {
        fontSize: 28,
        color: '#ffffff',
        fontWeight: '600',
        lineHeight: 32,
    },
    content: {
        flex: 1,
    },
});

export default App;
