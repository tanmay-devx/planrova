import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';

export default function WellbeingScreen() {
  const [habits, setHabits] = useFirestoreData('user_habits', []);
  const [hydration, setHydration] = useFirestoreData('hydration', { water: 0, target: 2000 });
  const [routines, setRoutines] = useFirestoreData('wellbeing_routines', [
    {
      id: 'rtn_morning',
      title: 'Morning Routine',
      steps: [
        { id: 's1', title: 'Hydrate 500ml', isCompleted: false },
        { id: 's2', title: '10 min stretch', isCompleted: false }
      ]
    }
  ]);
  const [checkIn, setCheckIn] = useFirestoreData('wellbeing_check_in_today', { energyLevel: 3, note: '' });

  const todayStr = new Date().toISOString().slice(0, 10);

  const toggleHabit = (habitId) => {
    const updated = habits.map(h => {
      if (h.id === habitId) {
        const dates = Array.isArray(h.completionDates) ? [...h.completionDates] : [];
        const isDone = dates.includes(todayStr);
        const newDates = isDone ? dates.filter(d => d !== todayStr) : [...dates, todayStr];
        const newStreak = isDone ? Math.max(0, (h.currentStreak || 1) - 1) : (h.currentStreak || 0) + 1;
        return {
          ...h,
          completionDates: newDates,
          currentStreak: newStreak,
          streak: newStreak
        };
      }
      return h;
    });
    setHabits(updated);
  };

  const addWater = (ml) => {
    const newVol = (hydration.water || 0) + ml;
    setHydration({ ...hydration, water: newVol });
  };

  const toggleStep = (routineId, stepId) => {
    const updated = routines.map(r => {
      if (r.id === routineId) {
        const steps = (r.steps || []).map(s => s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s);
        return { ...r, steps };
      }
      return r;
    });
    setRoutines(updated);
  };

  const hydrationPct = hydration.target > 0
    ? Math.min(100, Math.round(((hydration.water || 0) / hydration.target) * 100))
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Wellbeing Workspace</Text>
        </View>

        {/* Hydration Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>💧 Daily Hydration</Text>
            <Text style={styles.badge}>{hydration.water || 0} / {hydration.target || 2000} ml</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${hydrationPct}%`, backgroundColor: '#3B82F6' }]} />
          </View>
          <View style={styles.quickAddRow}>
            <TouchableOpacity style={styles.quickAddBtn} onPress={() => addWater(250)}>
              <Text style={styles.quickAddText}>+ 250 ml (Glass)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAddBtn} onPress={() => addWater(500)}>
              <Text style={styles.quickAddText}>+ 500 ml (Bottle)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reflection Check-In */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧘 Daily Reflection</Text>
          <View style={styles.energyRow}>
            <Text style={styles.energyLabel}>Energy (1-5):</Text>
            {[1, 2, 3, 4, 5].map(lvl => (
              <TouchableOpacity
                key={lvl}
                style={[styles.energyBtn, checkIn.energyLevel === lvl && styles.energyBtnActive]}
                onPress={() => setCheckIn({ ...checkIn, energyLevel: lvl })}
              >
                <Text style={[styles.energyBtnText, checkIn.energyLevel === lvl && styles.energyBtnTextActive]}>{lvl}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="A quick note about how you feel..."
            placeholderTextColor="#666"
            value={checkIn.note || ''}
            onChangeText={(txt) => setCheckIn({ ...checkIn, note: txt })}
          />
        </View>

        {/* Habits Checklist */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔥 Today's Habits</Text>
          {habits.map(h => {
            const isCompleted = Array.isArray(h.completionDates) && h.completionDates.includes(todayStr);
            return (
              <TouchableOpacity key={h.id} style={styles.itemRow} onPress={() => toggleHabit(h.id)}>
                <Ionicons
                  name={isCompleted ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={isCompleted ? '#10B981' : '#9CA3AF'}
                />
                <Text style={[styles.itemText, isCompleted && styles.completedText]}>{h.name || h.title}</Text>
                <Text style={styles.streakText}>🔥 {h.currentStreak || 0}</Text>
              </TouchableOpacity>
            );
          })}
          {habits.length === 0 && <Text style={styles.emptyText}>No habits scheduled for today.</Text>}
        </View>

        {/* Routines Checklist */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔄 Active Routines</Text>
          {routines.map(r => (
            <View key={r.id} style={styles.routineBlock}>
              <Text style={styles.routineTitle}>{r.title}</Text>
              {(r.steps || []).map(step => (
                <TouchableOpacity key={step.id} style={styles.itemRow} onPress={() => toggleStep(r.id, step.id)}>
                  <Ionicons
                    name={step.isCompleted ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={step.isCompleted ? '#8B5CF6' : '#9CA3AF'}
                  />
                  <Text style={[styles.itemText, step.isCompleted && styles.completedText]}>{step.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  scrollContent: { padding: 16 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#F3F1EC' },
  card: { backgroundColor: '#1A1D24', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2A2E39', marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#F3F1EC', marginBottom: 10 },
  badge: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  progressBarBg: { height: 8, backgroundColor: '#2A2E39', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  quickAddRow: { flexDirection: 'row', gap: 10 },
  quickAddBtn: { flex: 1, backgroundColor: '#2A2E39', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  quickAddText: { color: '#F3F1EC', fontSize: 13, fontWeight: '600' },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  energyLabel: { fontSize: 13, color: '#9CA3AF' },
  energyBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#2A2E39', justifyContent: 'center', alignItems: 'center' },
  energyBtnActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  energyBtnText: { color: '#F3F1EC', fontWeight: '600', fontSize: 12 },
  energyBtnTextActive: { color: '#fff' },
  input: { backgroundColor: '#0F1115', color: '#F3F1EC', borderWidth: 1, borderColor: '#2A2E39', borderRadius: 8, padding: 10, fontSize: 13 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  itemText: { flex: 1, color: '#F3F1EC', marginLeft: 10, fontSize: 14 },
  completedText: { textDecorationLine: 'line-through', color: '#666' },
  streakText: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  emptyText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  routineBlock: { marginBottom: 12 },
  routineTitle: { fontSize: 14, fontWeight: '700', color: '#F3F1EC', marginBottom: 4 }
});

