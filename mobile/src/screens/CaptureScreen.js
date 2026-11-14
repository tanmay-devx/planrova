import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { auth } from '../firebase';
import QuickCaptureModal from '../components/QuickCapture/QuickCaptureModal';

export default function CaptureScreen() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';
  const [brainDump, setBrainDump] = useFirestoreData('brain_dump', []);
  const [tasks, setTasks] = useFirestoreData('tasks', []);
  const [expenses, setExpenses] = useFirestoreData('expenses', []);
  const [notes, setNotes] = useFirestoreData('notes', []);
  const [habits, setHabits] = useFirestoreData('user_habits', []);
  const [dumpText, setDumpText] = useState('');
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  const addBrainDump = () => {
    if (!dumpText.trim()) return;
    setBrainDump([
      { id: Date.now().toString(), text: dumpText.trim(), date: new Date().toISOString() },
      ...brainDump
    ]);
    setDumpText('');
  };

  const handleUniversalCapture = ({ type, text, date }) => {
    const now = Date.now();
    const dateStr = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];

    if (type === 'expense') {
      const amtMatch = text.match(/\b\d+(?:\.\d{1,2})?\b/);
      const amt = amtMatch ? parseFloat(amtMatch[0]) : 0;
      const desc = text.replace(/(?:spent|spend|bought|paid|cost|for|on|\$|₹|\brs\.?)/gi, '').replace(/\b\d+(?:\.\d{1,2})?\b/, '').trim() || 'Quick Expense';
      setExpenses([{
        id: now.toString(),
        amount: amt,
        amountMinor: Math.round(amt * 100),
        currency: 'INR',
        description: desc,
        desc,
        category: 'Other',
        date: dateStr,
        schemaVersion: 1
      }, ...expenses]);
    } else if (type === 'habit') {
      const name = text.replace(/^(?:build\s+(?:a\s+)?habit|start\s+(?:a\s+)?habit|start|track)\s+/i, '').replace(/\b(?:every\s+day|daily)\b/gi, '').trim() || 'Daily Habit';
      setHabits([{
        id: now.toString(),
        name,
        icon: 'sparkles',
        currentStreak: 0,
        longestStreak: 0,
        streak: 0,
        fire: 0,
        completionDates: [],
        logs: [],
        frequency: { type: 'daily', days: [] },
        schemaVersion: 1
      }, ...habits]);
    } else if (type === 'note') {
      const words = text.split(/\s+/).filter(Boolean);
      const autoTitle = words.slice(0, 5).join(' ') || 'Quick Note';
      setNotes([{
        id: now.toString(),
        subject: 'General',
        title: autoTitle,
        content: text,
        text,
        date: dateStr,
        linkedTaskIds: [],
        schemaVersion: 1
      }, ...notes]);
    } else if (type === 'brain_dump') {
      setBrainDump([{
        id: now.toString(),
        text,
        date: new Date().toISOString()
      }, ...brainDump]);
    } else {
      setTasks([...tasks, {
        id: 't_' + now,
        title: text.replace(/\b(?:tomorrow|today|kal)\b/gi, '').trim() || 'Quick Task',
        desc: '',
        date: dateStr,
        category: 'study',
        priority: 'medium',
        status: 'todo',
        completed: false,
        linkedNoteIds: [],
        schemaVersion: 1
      }]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Capture</Text>
        <TouchableOpacity 
          style={styles.universalBtn}
          onPress={() => setShowQuickCapture(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="flash" size={14} color="#0F1115" />
          <Text style={styles.universalBtnText}>Quick Capture</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.sectionTitle}>BRAIN DUMP</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>{brainDump.length}</Text></View>
            </View>
            <Ionicons name="caret-down" size={14} color="#5A6070" />
          </View>

          <View style={styles.captureBox}>
            <TextInput
              style={styles.input}
              placeholder="Quick thought? Dump here..."
              placeholderTextColor="#5A6070"
              value={dumpText}
              onChangeText={setDumpText}
              multiline
            />
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowQuickCapture(true)}>
                <Ionicons name="flash" size={18} color="#C2A878" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={addBrainDump}>
                <Text style={styles.addBtnText}>Dump</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.helperText}>Capture ideas before they disappear.</Text>
        </View>

        {brainDump.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 16 }]}>RECENT DUMPS</Text>
            {brainDump.slice(0, 8).map(item => (
              <View key={item.id} style={styles.dumpCard}>
                <Text style={styles.dumpText}>{item.text}</Text>
                <Text style={styles.dumpDate}>{new Date(item.date).toLocaleString()}</Text>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Universal Quick Capture Modal */}
      <QuickCaptureModal 
        visible={showQuickCapture}
        onClose={() => setShowQuickCapture(false)}
        onSave={handleUniversalCapture}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: 12, 
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 28, color: '#F3F1EC' },
  universalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C2A878',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  universalBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#0F1115'
  },
  
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12, color: '#5A6070', letterSpacing: 1 },
  badge: { backgroundColor: '#1D2430', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 8 },
  badgeText: { color: '#8B92A0', fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold' },

  captureBox: { backgroundColor: 'transparent', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', padding: 16 },
  input: { fontFamily: 'PlusJakartaSans_500Medium', color: '#F3F1EC', fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  iconBtn: { backgroundColor: '#1D2430', padding: 10, borderRadius: 10 },
  addBtn: { backgroundColor: '#C2A878', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: '#0F1115', fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14 },

  helperText: { fontFamily: 'PlusJakartaSans_500Medium', color: '#8B92A0', fontSize: 13, textAlign: 'center', marginTop: 24, marginBottom: 32 },

  settingsBtn: { backgroundColor: '#171B22', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  settingsText: { color: '#8B92A0', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 },

  dumpCard: { backgroundColor: '#1D2430', padding: 16, borderRadius: 16, marginBottom: 12 },
  dumpText: { color: '#F3F1EC', fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 20 },
  dumpDate: { color: '#5A6070', fontSize: 11, marginTop: 12, fontFamily: 'PlusJakartaSans_500Medium' }
});
