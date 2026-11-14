import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Vibration,
  ScrollView,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const CAPTURE_TYPES = [
  { id: 'task', label: 'Task', icon: 'checkmark-circle-outline' },
  { id: 'expense', label: 'Expense', icon: 'cash-outline' },
  { id: 'reminder', label: 'Reminder', icon: 'alarm-outline' },
  { id: 'habit', label: 'Habit', icon: 'flame-outline' },
  { id: 'note', label: 'Note', icon: 'document-text-outline' },
  { id: 'calendar_event', label: 'Calendar', icon: 'calendar-outline' },
  { id: 'brain_dump', label: 'Idea', icon: 'bulb-outline' }
];

export default function QuickCaptureModal({ 
  visible, 
  onClose, 
  onSave, 
  initialText = '' 
}) {
  const [inputText, setInputText] = useState(initialText);
  const [overrideType, setOverrideType] = useState(null);
  const [detectedType, setDetectedType] = useState('task');
  const [confidence, setConfidence] = useState(0.8);
  const [previewDetails, setPreviewDetails] = useState('');

  useEffect(() => {
    if (visible) {
      setInputText(initialText);
      setOverrideType(null);
    }
  }, [visible, initialText]);

  // Real-time classification on input change
  useEffect(() => {
    const raw = inputText.trim();
    if (!raw) {
      setDetectedType('task');
      setConfidence(0);
      setPreviewDetails('Type anything to see intelligent classification');
      return;
    }

    const lower = raw.toLowerCase();

    // 1. Expense check
    const hasCurrency = /(?:₹|\$|\brs\.?|\brupees?\b)/i.test(lower);
    const hasSpendVerb = /\b(?:spent|spend|bought|paid|cost|expense|kharcha)\b/i.test(lower);
    const hasAmount = /\b\d+(?:\.\d{1,2})?\b/.test(lower);
    if ((hasSpendVerb || hasCurrency) && hasAmount) {
      setDetectedType('expense');
      setConfidence(0.95);
      const amtMatch = raw.match(/\b\d+(?:\.\d{1,2})?\b/);
      const amt = amtMatch ? amtMatch[0] : '0';
      setPreviewDetails(`Log ₹${amt} expense`);
      return;
    }

    // 2. Reminder check
    if (/^(?:remind|remember\s+to|alert)/i.test(lower)) {
      setDetectedType('reminder');
      setConfidence(0.95);
      setPreviewDetails('Schedule push reminder');
      return;
    }

    // 3. Habit check
    if (/\b(?:every\s+(?:day|morning|night)|daily|routine|habit)\b/i.test(lower)) {
      setDetectedType('habit');
      setConfidence(0.92);
      setPreviewDetails('Create daily tracking habit');
      return;
    }

    // 4. Calendar event check
    if (/\b(?:lecture|meeting|class|call\s+with|interview|exam)\b/i.test(lower)) {
      setDetectedType('calendar_event');
      setConfidence(0.90);
      setPreviewDetails('Add event to schedule');
      return;
    }

    // 5. Note check
    if (/^(?:note:|remember\s+that|summary:)/i.test(lower)) {
      setDetectedType('note');
      setConfidence(0.90);
      setPreviewDetails('Save to knowledge notes');
      return;
    }

    // 6. Action verb check -> Task
    if (/\b(?:finish|complete|submit|read|study|prepare|write|clean|do|review)\b/i.test(lower)) {
      setDetectedType('task');
      setConfidence(0.90);
      setPreviewDetails('Add task to weekly planner');
      return;
    }

    // 7. Fallback to Brain Dump
    setDetectedType('brain_dump');
    setConfidence(0.50);
    setPreviewDetails('Save to Brain Dump buffer');
  }, [inputText]);

  const effectiveType = overrideType || detectedType;

  const handleCaptureSubmit = () => {
    const raw = inputText.trim();
    if (!raw) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Vibration.vibrate(30);
    }

    onSave({
      type: effectiveType,
      text: raw,
      date: new Date().toISOString()
    });

    setInputText('');
    setOverrideType(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="flash" size={18} color="#C2A878" />
              <Text style={styles.headerTitle}>UNIVERSAL CAPTURE</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#8B92A0" />
            </TouchableOpacity>
          </View>

          {/* Input Box */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 'Spent ₹120 on lunch', 'Finish DBMS assignment tomorrow', 'Read 20 pages daily'"
              placeholderTextColor="#5A6070"
              value={inputText}
              onChangeText={setInputText}
              multiline
              autoFocus
            />
          </View>

          {/* Type Selector Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsScroll}>
            {CAPTURE_TYPES.map(item => {
              const isActive = item.id === effectiveType;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => setOverrideType(item.id === overrideType ? null : item.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={14} 
                    color={isActive ? '#C2A878' : '#8B92A0'} 
                  />
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Classification Preview Card */}
          <View style={styles.previewCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons 
                name={
                  effectiveType === 'expense' ? 'cash-outline' :
                  effectiveType === 'habit' ? 'flame-outline' :
                  effectiveType === 'reminder' ? 'alarm-outline' :
                  effectiveType === 'note' ? 'document-text-outline' :
                  effectiveType === 'calendar_event' ? 'calendar-outline' :
                  effectiveType === 'brain_dump' ? 'bulb-outline' : 'checkmark-circle-outline'
                } 
                size={16} 
                color="#C2A878" 
              />
              <Text style={styles.previewText}>{previewDetails}</Text>
            </View>
            {confidence > 0 && (
              <View style={[styles.confBadge, { backgroundColor: confidence >= 0.8 ? 'rgba(52, 211, 153, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
                <Text style={[styles.confText, { color: confidence >= 0.8 ? '#34d399' : '#f59e0b' }]}>
                  {Math.round(confidence * 100)}%
                </Text>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[styles.submitBtn, !inputText.trim() && { opacity: 0.5 }]} 
            onPress={handleCaptureSubmit}
            disabled={!inputText.trim()}
          >
            <Text style={styles.submitBtnText}>Capture & Organize</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#171B22',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(194, 168, 120, 0.2)',
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#F3F1EC',
    letterSpacing: 0.8
  },
  closeBtn: {
    padding: 4
  },
  inputContainer: {
    backgroundColor: '#0F1115',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
    marginBottom: 16
  },
  input: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 15,
    color: '#F3F1EC',
    minHeight: 70,
    textAlignVertical: 'top'
  },
  pillsScroll: {
    marginBottom: 16
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8
  },
  pillActive: {
    backgroundColor: 'rgba(194, 168, 120, 0.15)',
    borderColor: '#C2A878'
  },
  pillText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 12,
    color: '#8B92A0'
  },
  pillTextActive: {
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_700Bold'
  },
  previewCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  previewText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12.5,
    color: '#8B92A0'
  },
  confBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  confText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10
  },
  submitBtn: {
    backgroundColor: '#C2A878',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#0F1115'
  }
});

