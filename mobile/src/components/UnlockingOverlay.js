import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function UnlockingOverlay({
  progressAnim,
  pulseScale,
  unlockMessage
}) {
  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.unlockContainer}>
        <Animated.View style={[styles.pulseContainer, { transform: [{ scale: pulseScale }] }]}>
          <Ionicons name="sync-outline" size={32} color="#C2A878" />
        </Animated.View>
        <Text style={styles.unlockTitle}>Unlocking Planrova</Text>
        <Text style={styles.unlockSubtitle}>{unlockMessage}</Text>
        
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, { width: barWidth }]} />
        </View>
        
        <Text style={styles.studentBadge}>STUDENT WORKSPACE SYNC</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115'
  },
  unlockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  pulseContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(194, 168, 120, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.2)'
  },
  unlockTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#F3F1EC',
    marginBottom: 8
  },
  unlockSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8B92A0',
    marginBottom: 32,
    textAlign: 'center'
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 24
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#C2A878',
    borderRadius: 3
  },
  studentBadge: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#5A6070',
    letterSpacing: 2
  }
});

