import React, { useState, useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Animated, 
  Easing, 
  Vibration, 
  Share, 
  PanResponder, 
  Dimensions,
  Platform 
} from 'react-native';

import DashboardScreen from '../screens/DashboardScreen';
import HabitsScreen from '../screens/HabitsScreen';
import NotesScreen from '../screens/NotesScreen';
import FocusScreen from '../screens/FocusScreen';
import ScheduleScreen from '../screens/ScheduleScreen';

import { auth } from '../firebase';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { calculateXPProgress, getLevelTitle } from '../utils/gamification';
import { awardXP } from '../utils/xpManager';
import QuickCaptureModal from '../components/QuickCapture/QuickCaptureModal';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

// SwipeWrapper component to intercept swipes and navigate between tabs
function SwipeWrapper({ children, navigation, route }) {
  const tabNames = ['Home', 'Habits', 'Notes', 'Timer', 'Schedule'];
  const currentIndex = tabNames.indexOf(route.name);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Smooth swipe recognition: triggers when horizontal movement is larger than vertical
        // and exceeds a threshold (30px)
        return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dy) < 60 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 45) {
          // Swipe Right -> Go to prev tab
          if (currentIndex > 0) {
            navigation.navigate(tabNames[currentIndex - 1]);
            Vibration.vibrate(25);
          }
        } else if (gestureState.dx < -45) {
          // Swipe Left -> Go to next tab
          if (currentIndex < tabNames.length - 1) {
            navigation.navigate(tabNames[currentIndex + 1]);
            Vibration.vibrate(25);
          }
        }
      }
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

export default function TabNavigator() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'guest';

  // Firestore collections for Quick Add Modal
  const [tasks, setTasks] = useFirestoreData('tasks', []);
  const [expenses, setExpenses] = useFirestoreData('expenses', []);
  const [notes, setNotes] = useFirestoreData('notes', []);
  const [habits, setHabits] = useFirestoreData('user_habits', []);
  const [brainDump, setBrainDump] = useFirestoreData('brain_dump', []);
  const [gamification, setGamification] = useFirestoreData('gamification', { level: 1, xp: 0 });

  // Modal States
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [previousLevel, setPreviousLevel] = useState(null);

  // Form inputs
  const [taskTitle, setTaskTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [noteSubject, setNoteSubject] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Sparkle animations for Level-Up Modal
  const sparkleAnims = useRef(
    Array.from({ length: 12 }).map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      scale: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // Track global leveling state
  useEffect(() => {
    if (gamification && gamification.level) {
      if (previousLevel !== null && gamification.level > previousLevel) {
        setShowLevelUpModal(true);
        Vibration.vibrate([0, 100, 50, 150]);
        // Trigger sparkles burst after modal opens
        setTimeout(triggerSparkles, 250);
      }
      setPreviousLevel(gamification.level);
    }
  }, [gamification]);

  const triggerSparkles = () => {
    sparkleAnims.forEach((spark, index) => {
      spark.x.setValue(0);
      spark.y.setValue(0);
      spark.scale.setValue(0.2);
      spark.opacity.setValue(1);

      const angle = (index / 12) * 2 * Math.PI;
      const distance = 70 + Math.random() * 60;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;

      Animated.parallel([
        Animated.timing(spark.x, {
          toValue: targetX,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(spark.y, {
          toValue: targetY,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(spark.scale, {
          toValue: 1.2 + Math.random(),
          duration: 1200,
          useNativeDriver: true
        }),
        Animated.timing(spark.opacity, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true
        })
      ]).start();
    });
  };

  const handleUniversalCapture = ({ type, text, date }) => {
    const now = Date.now();
    const dateStr = date ? date.split('T')[0] : new Date().toISOString().split('T')[0];

    if (type === 'expense') {
      const amtMatch = text.match(/\b\d+(?:\.\d{1,2})?\b/);
      const amt = amtMatch ? parseFloat(amtMatch[0]) : 0;
      const desc = text.replace(/(?:spent|spend|bought|paid|cost|for|on|\$|₹|\brs\.?)/gi, '').replace(/\b\d+(?:\.\d{1,2})?\b/, '').trim() || 'Quick Expense';
      let category = 'Other';
      const lower = text.toLowerCase();
      if (/food|lunch|dinner|chai|coffee|snack/i.test(lower)) category = 'Food';
      else if (/cab|uber|ola|auto|metro|bus/i.test(lower)) category = 'Transport';
      else if (/book|xerox|print|exam|study/i.test(lower)) category = 'Study';

      const newExpense = {
        id: now.toString(),
        amount: amt,
        amountMinor: Math.round(amt * 100),
        currency: 'INR',
        description: desc,
        desc: desc,
        category,
        date: dateStr,
        schemaVersion: 1
      };
      setExpenses([newExpense, ...expenses]);
      awardXP(userId, gamification, 5, `Logged expense: ${newExpense.desc}`).then(setGamification);
    } else if (type === 'habit') {
      const name = text.replace(/^(?:build\s+(?:a\s+)?habit|start\s+(?:a\s+)?habit|start|track)\s+/i, '').replace(/\b(?:every\s+day|daily)\b/gi, '').trim() || 'Daily Habit';
      const newHabit = {
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
      };
      setHabits([newHabit, ...habits]);
    } else if (type === 'note') {
      const words = text.split(/\s+/).filter(Boolean);
      const autoTitle = words.slice(0, 5).join(' ') || 'Quick Note';
      const newNote = {
        id: now.toString(),
        subject: 'General',
        title: autoTitle,
        content: text,
        text: text,
        date: dateStr,
        linkedTaskIds: [],
        schemaVersion: 1
      };
      setNotes([newNote, ...notes]);
    } else if (type === 'brain_dump') {
      const newDump = {
        id: now.toString(),
        text,
        date: new Date().toISOString()
      };
      setBrainDump([newDump, ...brainDump]);
    } else {
      // task, reminder, calendar_event -> saves as planner task
      const newTask = {
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
      };
      setTasks([...tasks, newTask]);
      awardXP(userId, gamification, 10, `Captured task: ${newTask.title}`).then(setGamification);
    }
  };

  const handleShareStatus = async () => {
    try {
      await Share.share({
        message: `I just leveled up to Level ${gamification.level} (${getLevelTitle(gamification.level)}) on Planrova! Join my study workspace.`
      });
    } catch (error) {
      // ignore
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          animation: 'fade',
          tabBarStyle: {
            backgroundColor: '#171B22',
            borderTopColor: 'rgba(255,255,255,0.03)',
            borderTopWidth: 1,
            elevation: 8,
            height: Platform.OS === 'ios' ? 88 : 72,
            paddingBottom: Platform.OS === 'ios' ? 24 : 12,
            paddingTop: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 10,
          },
          tabBarActiveTintColor: '#C2A878',
          tabBarInactiveTintColor: '#5A6070',
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color }) => {
            let iconName;
            if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'Habits') iconName = focused ? 'checkmark-circle' : 'checkmark-circle-outline';
            else if (route.name === 'Notes') iconName = focused ? 'document-text' : 'document-text-outline';
            else if (route.name === 'Timer') iconName = focused ? 'timer' : 'timer-outline';
            else if (route.name === 'Schedule') iconName = focused ? 'calendar' : 'calendar-outline';

            return (
              <View 
                style={[
                  { 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: 50,
                    height: 30,
                    borderRadius: 15,
                  },
                  focused && {
                    backgroundColor: 'rgba(186, 117, 23, 0.15)',
                  }
                ]}
              >
                <Ionicons name={iconName} size={20} color={color} />
              </View>
            );
          },
          tabBarLabel: ({ focused, color }) => (
            <Text 
              style={{
                fontFamily: focused ? 'PlusJakartaSans_700Bold' : 'PlusJakartaSans_600SemiBold',
                fontSize: focused ? 10.5 : 9,
                color: color,
                marginTop: 2,
                marginBottom: Platform.OS === 'ios' ? 0 : 4,
              }}
            >
              {route.name}
            </Text>
          )
        })}
      >
        <Tab.Screen name="Home">
          {props => (
            <SwipeWrapper {...props}>
              <DashboardScreen />
            </SwipeWrapper>
          )}
        </Tab.Screen>
        <Tab.Screen name="Habits">
          {props => (
            <SwipeWrapper {...props}>
              <HabitsScreen />
            </SwipeWrapper>
          )}
        </Tab.Screen>
        <Tab.Screen name="Notes">
          {props => (
            <SwipeWrapper {...props}>
              <NotesScreen />
            </SwipeWrapper>
          )}
        </Tab.Screen>
        <Tab.Screen name="Timer">
          {props => (
            <SwipeWrapper {...props}>
              <FocusScreen />
            </SwipeWrapper>
          )}
        </Tab.Screen>
        <Tab.Screen name="Schedule">
          {props => (
            <SwipeWrapper {...props}>
              <ScheduleScreen />
            </SwipeWrapper>
          )}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setShowQuickAdd(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#0F1115" />
      </TouchableOpacity>

      {/* Universal Quick Capture Modal */}
      <QuickCaptureModal
        visible={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onSave={handleUniversalCapture}
      />

      {/* Global Level-Up Reveal Modal */}
      <Modal
        visible={showLevelUpModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowLevelUpModal(false)}
      >
        <View style={styles.levelUpOverlay}>
          <View style={styles.levelUpCard}>
            
            {/* Sparkles bursts */}
            {sparkleAnims.map((spark, idx) => (
              <Animated.View
                key={idx}
                style={[
                  styles.sparkle,
                  {
                    transform: [
                      { translateX: spark.x },
                      { translateY: spark.y },
                      { scale: spark.scale }
                    ],
                    opacity: spark.opacity
                  }
                ]}
              >
                <Ionicons name="star" size={16} color="#C2A878" />
              </Animated.View>
            ))}

            <Ionicons name="trophy" size={72} color="#C2A878" style={styles.trophyIcon} />
            <Text style={styles.levelUpTitle}>LEVEL UP!</Text>
            <Text style={styles.levelUpSubtitle}>Congratulations Grinder!</Text>
            
            <View style={styles.levelCircle}>
              <Text style={styles.levelCircleText}>{gamification.level}</Text>
            </View>

            <Text style={styles.levelTitleText}>{getLevelTitle(gamification.level)}</Text>
            <Text style={styles.levelDescText}>Your productivity is unlocking new desks in the workspace.</Text>

            <View style={styles.levelUpActions}>
              <TouchableOpacity style={styles.shareBtn} onPress={handleShareStatus}>
                <Ionicons name="share-social-outline" size={18} color="#0F1115" style={{ marginRight: 8 }} />
                <Text style={styles.shareBtnText}>Share Status</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.okBtn} 
                onPress={() => setShowLevelUpModal(false)}
              >
                <Text style={styles.okBtnText}>Back to Desk</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#C2A878',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#C2A878',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#171B22',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  modalTabs: {
    flexDirection: 'row',
    backgroundColor: '#0F1115',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20
  },
  modalTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalTabActive: {
    backgroundColor: '#1D2430'
  },
  modalTabText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#5A6070'
  },
  modalTabTextActive: {
    color: '#C2A878'
  },
  form: {
    marginBottom: 12
  },
  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 10,
    color: '#8B92A0',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F1115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#F3F1EC',
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 14,
    marginBottom: 16
  },
  submitBtn: {
    backgroundColor: '#C2A878',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 8
  },
  submitBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#0F1115'
  },
  closeBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 13,
    color: '#5A6070'
  },

  // Level Up Modal
  levelUpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 11, 0.95)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  levelUpCard: {
    width: width * 0.85,
    backgroundColor: '#171B22',
    borderWidth: 1.5,
    borderColor: 'rgba(186, 117, 23, 0.25)',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    position: 'relative'
  },
  sparkle: {
    position: 'absolute',
    top: '30%',
    left: '46%'
  },
  trophyIcon: {
    marginBottom: 16,
    shadowColor: '#C2A878',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  levelUpTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#C2A878',
    letterSpacing: 2
  },
  levelUpSubtitle: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 13,
    color: '#8B92A0',
    marginTop: 4,
    marginBottom: 24
  },
  levelCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(186, 117, 23, 0.1)',
    borderWidth: 2,
    borderColor: '#C2A878',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  levelCircleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 36,
    color: '#F3F1EC'
  },
  levelTitleText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#F3F1EC',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  levelDescText: {
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 12,
    color: '#8B92A0',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 32,
    paddingHorizontal: 8
  },
  levelUpActions: {
    width: '100%',
    gap: 12
  },
  shareBtn: {
    backgroundColor: '#C2A878',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center'
  },
  shareBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#0F1115',
    fontSize: 14
  },
  okBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  okBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#8B92A0',
    fontSize: 13
  }
});
