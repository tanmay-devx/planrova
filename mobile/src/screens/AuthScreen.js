import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';

export default function AuthScreen({ onAuthSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setAuthError('Please fill in both fields.');
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (onAuthSuccess) onAuthSuccess(cred.user);
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setAuthError('Invalid email or password.');
      } else if (err.code === 'auth/invalid-email') {
        setAuthError('Please enter a valid email address.');
      } else if (err.code === 'auth/network-request-failed') {
        setAuthError('Network error. Check your connection.');
      } else {
        setAuthError('Could not sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async () => {
    if (!email || !password) {
      setAuthError('Please fill in both fields.');
      return;
    }
    if (password.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (onAuthSuccess) onAuthSuccess(cred.user);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setAuthError('This email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setAuthError('Password should be at least 8 characters.');
      } else {
        setAuthError('Could not create account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setAuthError('Enter your email above first.');
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setForgotPasswordSent(true);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setAuthError('No account found with this email.');
      } else {
        setAuthError('Could not send reset link. Try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1115" />
      
      {/* Background Glows */}
      <View style={styles.glowTopRight} pointerEvents="none" />
      <View style={styles.glowBottomLeft} pointerEvents="none" />

      <View style={styles.authContainer}>
        <Animated.View style={[
          styles.authCard,
          {
            opacity: fadeAnim,
            transform: [
              { translateY: slideAnim },
              { scale: logoScale }
            ]
          }
        ]}>
          <View style={styles.brandRow}>
            <Image source={require('../../assets/icon.png')} style={styles.brandLogo} />
            <Text style={styles.brandTitle}>Planrova</Text>
          </View>
          <Text style={styles.subtitle}>Your second brain & focus space.</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, emailFocused && styles.labelFocused]}>School / College Email</Text>
            <TextInput 
              style={[styles.input, emailFocused && styles.inputFocused]} 
              value={email} 
              onChangeText={(t) => { setEmail(t); setForgotPasswordSent(false); }}
              placeholder="student@school.edu"
              placeholderTextColor="#5A6070"
              autoCapitalize="none"
              keyboardType="email-address"
              accessibilityLabel="Email address input"
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, passwordFocused && styles.labelFocused]}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput 
                style={[styles.inputPassword, passwordFocused && styles.inputFocused]} 
                value={password} 
                onChangeText={setPassword} 
                placeholder="Min 8 characters"
                placeholderTextColor="#5A6070"
                secureTextEntry={!showPassword}
                accessibilityLabel="Password input"
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#5A6070" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
            disabled={isSubmitting}
            accessibilityLabel="Forgot password"
          >
            <Text style={styles.forgotBtnText}>Forgot Password?</Text>
          </TouchableOpacity>

          {forgotPasswordSent && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={14} color="#7C9B7A" style={{ marginRight: 6 }} />
              <Text style={styles.successBannerText}>Reset link sent! Check your inbox.</Text>
            </View>
          )}

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}

          <TouchableOpacity 
            style={[styles.btnPrimary, isSubmitting && styles.btnDisabled]} 
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.8}
            accessibilityLabel="Sign in to Planrova"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#0F1115" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Enter Workspace</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.btnGhost, isSubmitting && styles.btnDisabled]} 
            onPress={handleSignup}
            disabled={isSubmitting}
            activeOpacity={0.8}
            accessibilityLabel="Create a new Planrova account"
          >
            <Text style={styles.btnGhostText}>Create New Desk</Text>
          </TouchableOpacity>

          <Text style={styles.desiFooter}>Made for Indian Students 🇮🇳</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0F1115' 
  },
  authContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20 
  },
  glowTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#C2A878',
    opacity: 0.08,
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#4B6BFB',
    opacity: 0.06,
  },
  authCard: {
    backgroundColor: 'rgba(23, 27, 34, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 32,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4
  },
  brandLogo: {
    width: 32,
    height: 32,
    marginRight: 10,
    borderRadius: 8
  },
  brandTitle: { 
    fontFamily: 'PlusJakartaSans_700Bold', 
    fontSize: 34, 
    color: '#F3F1EC', 
    textAlign: 'center',
    letterSpacing: -0.5
  },
  subtitle: { 
    fontFamily: 'PlusJakartaSans_500Medium', 
    fontSize: 13, 
    color: '#8B92A0', 
    marginBottom: 28, 
    textAlign: 'center',
    opacity: 0.8
  },
  inputGroup: { 
    marginBottom: 16 
  },
  label: { 
    fontFamily: 'PlusJakartaSans_700Bold', 
    fontSize: 10, 
    color: '#5A6070', 
    textTransform: 'uppercase', 
    letterSpacing: 1.2, 
    marginBottom: 8 
  },
  labelFocused: {
    color: '#C2A878'
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16
  },
  inputPassword: {
    flex: 1,
    paddingVertical: 14,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14
  },
  inputFocused: {
    borderColor: '#C2A878',
    backgroundColor: 'rgba(194, 168, 120, 0.05)'
  },
  eyeBtn: {
    padding: 8
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 14
  },
  forgotBtnText: {
    fontSize: 11,
    color: '#8B92A0',
    fontFamily: 'PlusJakartaSans_600SemiBold'
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 155, 122, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124, 155, 122, 0.3)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14
  },
  successBannerText: {
    fontSize: 12,
    color: '#7C9B7A',
    fontFamily: 'PlusJakartaSans_500Medium'
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginBottom: 14,
    textAlign: 'center'
  },
  btnPrimary: {
    backgroundColor: '#C2A878',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10
  },
  btnPrimaryText: {
    color: '#0F1115',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14
  },
  btnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16
  },
  btnGhostText: {
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13
  },
  btnDisabled: {
    opacity: 0.6
  },
  desiFooter: {
    textAlign: 'center',
    fontSize: 11,
    color: '#5A6070',
    marginTop: 4
  }
});

