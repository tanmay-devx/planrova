import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing
} from 'react-native';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { auth, db } from './src/firebase';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import AuthScreen from './src/screens/AuthScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import UnlockingOverlay from './src/components/UnlockingOverlay';

const CustomTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0F1115'
  }
};

const UNLOCK_STATUS_MESSAGES = [
  "Arranging your study table...",
  "Putting the Cutting Chai on boil...",
  "Loading the pomodoro gears...",
  "Pre-heating the Maggi pan...",
  "Syncing xerox and lecture notes...",
  "Setting quiet hours for lectures..."
];

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showMainApp, setShowMainApp] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  // Unlocking sequence animation states
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState(UNLOCK_STATUS_MESSAGES[0]);
  const pulseScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const mainAppEntranceAnim = useRef(new Animated.Value(0)).current;

  // Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setOnboardingLoading(true);
        try {
          const profileDoc = await getDoc(doc(db, 'users', currentUser.uid, 'appData', 'user_profile'));
          if (profileDoc.exists()) {
            const val = profileDoc.data()?.value;
            const parsed = val ? JSON.parse(val) : null;
            setOnboardingRequired(!parsed || !parsed.onboarded);
          } else {
            setOnboardingRequired(true);
          }
        } catch (e) {
          // If Firestore remote query is blocked (e.g. unpublished cloud rules or offline), fall back to local cache
          try {
            const cachedProfile = await AsyncStorage.getItem(`planrova_${currentUser.uid}_user_profile`);
            if (cachedProfile) {
              const parsed = JSON.parse(cachedProfile);
              setOnboardingRequired(!parsed || !parsed.onboarded);
            } else {
              setOnboardingRequired(false);
            }
          } catch {
            setOnboardingRequired(false);
          }
          if (e?.code !== 'permission-denied') {
            console.warn('Profile check fallback:', e);
          }
        } finally {
          setOnboardingLoading(false);
        }
        setShowMainApp(true);
      } else {
        setShowMainApp(false);
        setOnboardingRequired(false);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Notifications listener
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response?.notification?.request?.content?.data;
      if (data && data.screen) {
        if (navigationRef.isReady()) {
          navigationRef.navigate(data.screen, data.params || {});
        }
      }
    });

    return () => sub.remove();
  }, []);

  // Pulse animation during unlock
  useEffect(() => {
    if (isUnlocking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.15,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(pulseScale, {
            toValue: 1.0,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      pulseScale.setValue(1);
    }
  }, [isUnlocking]);

  const triggerUnlock = (authedUser) => {
    setIsUnlocking(true);
    progressAnim.setValue(0);
    const randMsg = UNLOCK_STATUS_MESSAGES[Math.floor(Math.random() * UNLOCK_STATUS_MESSAGES.length)];
    setUnlockMessage(randMsg);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false
    }).start(() => {
      setIsUnlocking(false);
      setUser(authedUser);
      setShowMainApp(true);
    });
  };

  // Main App Entrance Animation
  useEffect(() => {
    if (showMainApp) {
      mainAppEntranceAnim.setValue(0);
      Animated.timing(mainAppEntranceAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      }).start();
    }
  }, [showMainApp]);

  // Loading Screen
  if (!fontsLoaded || isAuthLoading || (user && showMainApp && onboardingLoading)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#C2A878" size="large" />
      </View>
    );
  }

  // Unlocking Animation Overlay
  if (isUnlocking) {
    return (
      <UnlockingOverlay
        progressAnim={progressAnim}
        pulseScale={pulseScale}
        unlockMessage={unlockMessage}
      />
    );
  }

  // Auth Screen
  if (!showMainApp || !user) {
    return <AuthScreen onAuthSuccess={triggerUnlock} />;
  }

  // Onboarding Screen
  if (onboardingRequired) {
    return (
      <OnboardingScreen
        user={user}
        onComplete={() => setOnboardingRequired(false)}
      />
    );
  }

  // Main App Navigation
  return (
    <View style={styles.appContainer}>
      <Animated.View style={[styles.appWrapper, { opacity: mainAppEntranceAnim }]}>
        <NavigationContainer ref={navigationRef} theme={CustomTheme}>
          <StatusBar barStyle="light-content" backgroundColor="#0F1115" />
          <RootNavigator />
        </NavigationContainer>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F1115',
    justifyContent: 'center',
    alignItems: 'center'
  },
  appContainer: {
    flex: 1,
    backgroundColor: '#0F1115'
  },
  appWrapper: {
    flex: 1
  }
});
