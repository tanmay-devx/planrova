import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ScrollView,
  Animated,
  Easing,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function OnboardingScreen({ user, onComplete }) {
  const [obStep, setObStep] = useState(1);
  const [obName, setObName] = useState('');
  const [obCollege, setObCollege] = useState('');
  const [obBranch, setObBranch] = useState('');
  const [obSemester, setObSemester] = useState('');
  const [obHabits, setObHabits] = useState([
    { name: 'Gym', icon: 'barbell-outline', selected: true },
    { name: 'Read', icon: 'book-outline', selected: true },
    { name: 'Meditate', icon: 'body-outline', selected: false },
    { name: 'Code', icon: 'code-slash-outline', selected: true },
    { name: 'Namaz', icon: 'sunny-outline', selected: false },
    { name: 'Journal', icon: 'create-outline', selected: false },
    { name: 'Study', icon: 'school-outline', selected: true },
    { name: 'Wake early', icon: 'alarm-outline', selected: false }
  ]);
  const [obStudyHours, setObStudyHours] = useState('4');
  const [obWaterTarget, setObWaterTarget] = useState('2000');
  const [obPocketLimit, setObPocketLimit] = useState('5000');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const slideStepAnim = useRef(new Animated.Value(0)).current;

  const handleOnboardingNext = (nextStep) => {
    Animated.sequence([
      Animated.timing(slideStepAnim, {
        toValue: nextStep > obStep ? -20 : 20,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true
      }),
      Animated.timing(slideStepAnim, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true
      })
    ]).start();
    setObStep(nextStep);
  };

  const toggleObHabit = (idx) => {
    setObHabits(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], selected: !copy[idx].selected };
      return copy;
    });
  };

  const handleCompleteOnboarding = async () => {
    if (!obName.trim()) {
      Alert.alert('Required Field', 'Please provide your name to continue.');
      setObStep(1);
      return;
    }

    if (!user) {
      if (onComplete) onComplete();
      return;
    }

    setIsSubmitting(true);
    const userId = user.uid;

    try {
      // 1. Profile
      await setDoc(doc(db, 'users', userId, 'appData', 'user_profile'), {
        id: 'user_profile',
        value: JSON.stringify({
          name: obName.trim(),
          college: obCollege.trim(),
          branch: obBranch.trim(),
          semester: obSemester.trim(),
          bio: `Student at ${obCollege.trim()}`,
          onboarded: true
        }),
        updated_at: Date.now(),
        deleted: false
      }, { merge: true });

      // 2. Habits
      const selectedHabitsList = obHabits.filter(h => h.selected).map((h, idx) => ({
        id: (idx + 1).toString(),
        name: h.name,
        icon: h.icon,
        fire: 0,
        logs: []
      }));
      await setDoc(doc(db, 'users', userId, 'appData', 'user_habits'), {
        id: 'user_habits',
        value: JSON.stringify(selectedHabitsList.length > 0 ? selectedHabitsList : [
          { id: '1', name: 'Drink 3L Water', icon: 'water-outline', fire: 0, logs: [] },
          { id: '2', name: 'Read 10 Pages', icon: 'book-outline', fire: 0, logs: [] }
        ]),
        updated_at: Date.now(),
        deleted: false
      }, { merge: true });

      // 3. Hydration
      await setDoc(doc(db, 'users', userId, 'appData', 'hydration'), {
        id: 'hydration',
        value: JSON.stringify({ water: 0, target: parseInt(obWaterTarget, 10) || 2000 }),
        updated_at: Date.now(),
        deleted: false
      }, { merge: true });

      // 4. Budget Settings
      await setDoc(doc(db, 'users', userId, 'appData', 'budget_settings'), {
        id: 'budget_settings',
        value: JSON.stringify({
          monthlyLimit: parseInt(obPocketLimit, 10) || 5000,
          savingsGoalName: 'Semester Exam Fees',
          savingsGoalTarget: 1500,
          savingsGoalCurrent: 500
        }),
        updated_at: Date.now(),
        deleted: false
      }, { merge: true });

      // 5. Streaks
      await setDoc(doc(db, 'users', userId, 'appData', 'streaks'), {
        id: 'streaks',
        value: JSON.stringify({
          tasks: 0,
          focus: 0,
          hydration: 0,
          habits: 0,
          budget: 0,
          lastUpdated: { tasks: '', focus: '', hydration: '', habits: '', budget: '' },
          shields: 1
        }),
        updated_at: Date.now(),
        deleted: false
      }, { merge: true });

      // 6. Gamification
      await setDoc(doc(db, 'users', userId, 'appData', 'gamification'), {
        id: 'gamification',
        value: JSON.stringify({ level: 1, xp: 0 }),
        updated_at: Date.now(),
        deleted: false
      }, { merge: true });

      if (onComplete) onComplete();
    } catch (e) {
      console.error(e);
      Alert.alert('Setup Failed', 'Failed to configure your desk workspace. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F1115" />
      <View style={styles.obHeader}>
        <Text style={styles.obHeaderBrand}>PLANROVA</Text>
        <View style={styles.obProgressDots}>
          <View style={[styles.obDot, obStep >= 1 && styles.obDotActive]} />
          <View style={[styles.obDot, obStep >= 2 && styles.obDotActive]} />
          <View style={[styles.obDot, obStep >= 3 && styles.obDotActive]} />
        </View>
      </View>

      <Animated.View style={{ flex: 1, transform: [{ translateX: slideStepAnim }] }}>
        {obStep === 1 && (
          <ScrollView contentContainerStyle={styles.obContent}>
            <Text style={styles.obTitle}>Welcome to your Workspace</Text>
            <Text style={styles.obSubtitle}>Let us customize your study profile. This will serve as your digital Student ID.</Text>
            
            <View style={styles.obInputGroup}>
              <Text style={styles.obLabel}>Your Full Name *</Text>
              <TextInput 
                style={styles.obInput}
                value={obName}
                onChangeText={setObName}
                placeholder="e.g. Tanmay Sharma"
                placeholderTextColor="#5A6070"
              />
            </View>

            <View style={styles.obInputGroup}>
              <Text style={styles.obLabel}>School / College Name</Text>
              <TextInput 
                style={styles.obInput}
                value={obCollege}
                onChangeText={setObCollege}
                placeholder="e.g. School or University Name"
                placeholderTextColor="#5A6070"
              />
            </View>

            <View style={styles.obInputGroup}>
              <Text style={styles.obLabel}>Class / Branch / Stream</Text>
              <TextInput 
                style={styles.obInput}
                value={obBranch}
                onChangeText={setObBranch}
                placeholder="e.g. Grade 11 or Computer Science"
                placeholderTextColor="#5A6070"
              />
            </View>

            <View style={styles.obInputGroup}>
              <Text style={styles.obLabel}>Grade / Semester / Year</Text>
              <TextInput 
                style={styles.obInput}
                value={obSemester}
                onChangeText={setObSemester}
                placeholder="e.g. Grade 11 or Semester 4"
                placeholderTextColor="#5A6070"
              />
            </View>

            <TouchableOpacity style={styles.obPrimaryBtn} onPress={() => handleOnboardingNext(2)}>
              <Text style={styles.obPrimaryBtnText}>Next: Choose Habits →</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {obStep === 2 && (
          <ScrollView contentContainerStyle={styles.obContent}>
            <Text style={styles.obTitle}>Build Your Routine</Text>
            <Text style={styles.obSubtitle}>Select daily habits you want to track. Planrova makes building consistency rewarding.</Text>
            
            <View style={styles.obHabitsGrid}>
              {obHabits.map((habit, idx) => (
                <TouchableOpacity 
                  key={idx}
                  style={[styles.obHabitCard, habit.selected && styles.obHabitCardActive]}
                  onPress={() => toggleObHabit(idx)}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={habit.icon} 
                    size={24} 
                    color={habit.selected ? '#0F1115' : '#C2A878'} 
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={[styles.obHabitLabel, habit.selected && styles.obHabitLabelActive]}>
                    {habit.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.obButtonRow}>
              <TouchableOpacity style={styles.obSecondaryBtn} onPress={() => handleOnboardingNext(1)}>
                <Text style={styles.obSecondaryBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.obPrimaryBtn, { flex: 1 }]} onPress={() => handleOnboardingNext(3)}>
                <Text style={styles.obPrimaryBtnText}>Next: Targets →</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {obStep === 3 && (
          <ScrollView contentContainerStyle={styles.obContent}>
            <Text style={styles.obTitle}>Set Daily Targets</Text>
            <Text style={styles.obSubtitle}>Set focus study hours, hydration objectives, and pocket budget parameters.</Text>

            <View style={styles.obInputGroup}>
              <Text style={styles.obLabel}>Daily Study Goal (Hours)</Text>
              <TextInput 
                style={styles.obInput}
                value={obStudyHours}
                onChangeText={setObStudyHours}
                keyboardType="numeric"
                placeholder="4"
                placeholderTextColor="#5A6070"
              />
            </View>

            <View style={styles.obInputGroup}>
              <Text style={styles.obLabel}>Daily Water Target (ml)</Text>
              <View style={styles.waterQuickSelector}>
                {[1000, 2000, 3000, 4000, 5000].map(val => (
                  <TouchableOpacity 
                    key={val} 
                    style={[styles.waterSelectorPill, obWaterTarget === val.toString() && styles.waterSelectorPillActive]}
                    onPress={() => setObWaterTarget(val.toString())}
                  >
                    <Text style={[styles.waterSelectorPillText, obWaterTarget === val.toString() && { color: '#0F1115' }]}>{val}ml</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.obInputGroup}>
              <Text style={styles.obLabel}>Optional Monthly Pocket Money Limit (₹)</Text>
              <TextInput 
                style={styles.obInput}
                value={obPocketLimit}
                onChangeText={setObPocketLimit}
                keyboardType="numeric"
                placeholder="5000"
                placeholderTextColor="#5A6070"
              />
            </View>

            <View style={styles.obButtonRow}>
              <TouchableOpacity style={styles.obSecondaryBtn} onPress={() => handleOnboardingNext(2)}>
                <Text style={styles.obSecondaryBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.obPrimaryBtn, { flex: 1, backgroundColor: '#C2A878' }]}
                onPress={handleCompleteOnboarding}
                disabled={isSubmitting}
              >
                <Text style={[styles.obPrimaryBtnText, { color: '#0F1115' }]}>
                  {isSubmitting ? 'Launching...' : 'Launch Workspace'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115'
  },
  obHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  obHeaderBrand: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#C2A878',
    letterSpacing: 2
  },
  obProgressDots: {
    flexDirection: 'row',
    gap: 8
  },
  obDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  obDotActive: {
    backgroundColor: '#C2A878'
  },
  obContent: {
    padding: 24
  },
  obTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#F3F1EC',
    marginBottom: 8
  },
  obSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8B92A0',
    lineHeight: 20,
    marginBottom: 24
  },
  obInputGroup: {
    marginBottom: 16
  },
  obLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 11,
    color: '#5A6070',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8
  },
  obInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14
  },
  obPrimaryBtn: {
    backgroundColor: '#C2A878',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16
  },
  obPrimaryBtnText: {
    color: '#0F1115',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14
  },
  obButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20
  },
  obSecondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center'
  },
  obSecondaryBtnText: {
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13
  },
  obHabitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20
  },
  obHabitCard: {
    width: '47%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center'
  },
  obHabitCardActive: {
    backgroundColor: '#C2A878',
    borderColor: '#C2A878'
  },
  obHabitLabel: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#F3F1EC'
  },
  obHabitLabelActive: {
    color: '#0F1115'
  },
  waterQuickSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6
  },
  waterSelectorPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  waterSelectorPillActive: {
    backgroundColor: '#C2A878',
    borderColor: '#C2A878'
  },
  waterSelectorPillText: {
    fontSize: 12,
    color: '#8B92A0',
    fontWeight: '600'
  }
});

