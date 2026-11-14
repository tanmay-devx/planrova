/**
 * mobile/src/screens/AcademicScreen.js
 * Mobile Academic & Professional Workspace Screen for Planrova 2.0 (React Native).
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { ACADEMIC_STORAGE_KEYS } from '../../../shared/domain/academic/academic.types';
import { computeAcademicDashboard } from '../../../shared/domain/academic/academic-dashboard.engine';

export default function AcademicScreen({ navigation }) {
  const [courses, setCourses] = useFirestoreData(ACADEMIC_STORAGE_KEYS.COURSES, []);
  const [semesters, setSemesters] = useFirestoreData(ACADEMIC_STORAGE_KEYS.SEMESTERS, []);
  const [topics, setTopics] = useFirestoreData(ACADEMIC_STORAGE_KEYS.SYLLABUS_TOPICS, []);
  const [assessments, setAssessments] = useFirestoreData(ACADEMIC_STORAGE_KEYS.ASSESSMENTS, []);
  const [assignments, setAssignments] = useFirestoreData(ACADEMIC_STORAGE_KEYS.ASSIGNMENTS, []);
  const [flashcards, setFlashcards] = useFirestoreData(ACADEMIC_STORAGE_KEYS.FLASHCARDS, []);

  const [addCourseModalVisible, setAddCourseModalVisible] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseCredits, setNewCourseCredits] = useState('3');

  const todayStr = new Date().toISOString().slice(0, 10);
  const activeSemester = semesters.find(s => s.status === 'active') || semesters[0] || { name: 'Current Semester' };

  const dashboard = computeAcademicDashboard({
    semester: activeSemester,
    courses,
    topics,
    assessments,
    assignments,
    flashcards,
    referenceDateStr: todayStr
  });

  const handleAddCourse = () => {
    if (!newCourseName.trim()) {
      Alert.alert('Required', 'Please enter a course name');
      return;
    }

    const newCourse = {
      id: `crs_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: newCourseName.trim(),
      courseCode: newCourseCode.trim().toUpperCase(),
      credits: parseFloat(newCourseCredits) || 3,
      semesterId: activeSemester.id || null,
      color: '#C2A878',
      status: 'active'
    };

    setCourses([...courses, newCourse]);
    setNewCourseName('');
    setNewCourseCode('');
    setNewCourseCredits('3');
    setAddCourseModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Academic Workspace</Text>
            <Text style={styles.headerSubtitle}>{activeSemester.name || 'Semester Overview'}</Text>
          </View>
          <TouchableOpacity 
            style={styles.addCourseBtn}
            onPress={() => setAddCourseModalVisible(true)}
          >
            <Ionicons name="add" size={20} color="#000" />
            <Text style={styles.addCourseBtnText}>Add Course</Text>
          </TouchableOpacity>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Current SGPA</Text>
            <Text style={styles.metricValue}>
              {dashboard.semesterSummary.currentSGPA > 0 ? dashboard.semesterSummary.currentSGPA.toFixed(2) : '—'}
            </Text>
            <Text style={styles.metricSub}>Scale 4.0</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Credits</Text>
            <Text style={styles.metricValue}>{dashboard.semesterSummary.totalCredits}</Text>
            <Text style={styles.metricSub}>{courses.length} courses</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Syllabus</Text>
            <Text style={[styles.metricValue, { color: '#3b82f6' }]}>
              {dashboard.semesterSummary.overallSyllabusPercentage}%
            </Text>
            <Text style={styles.metricSub}>Progress</Text>
          </View>
        </View>

        {/* Flashcards Due Prompt */}
        {dashboard.flashcardsSummary.totalDue > 0 && (
          <View style={styles.reviewBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Spaced Repetition Due</Text>
              <Text style={styles.bannerSub}>{dashboard.flashcardsSummary.totalDue} card(s) ready for review</Text>
            </View>
            <TouchableOpacity style={styles.reviewBtn}>
              <Text style={styles.reviewBtnText}>Review</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Imminent Exams */}
        {dashboard.upcomingExams.length > 0 && (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Upcoming Exams</Text>
            {dashboard.upcomingExams.slice(0, 3).map((exam, idx) => (
              <View key={exam.id || idx} style={styles.examCard}>
                <View>
                  <Text style={styles.examName}>{exam.title}</Text>
                  <Text style={styles.examCourse}>{exam.courseName} ({exam.courseCode})</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.examDays, { color: exam.daysRemaining <= 3 ? '#ef4444' : '#f59e0b' }]}>
                    {exam.daysRemaining === 0 ? 'Today!' : `${exam.daysRemaining}d left`}
                  </Text>
                  <Text style={styles.examDate}>{exam.examDate || exam.dueDate}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Course Cards */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Enrolled Courses ({courses.length})</Text>
          {courses.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No courses enrolled. Tap "Add Course" above to begin.</Text>
            </View>
          ) : (
            courses.map((course, idx) => {
              const cTopics = topics.filter(t => t && String(t.courseId) === String(course.id));
              const masteredCount = cTopics.filter(t => t.completed || t.masteryLevel === 'mastered').length;
              const pct = cTopics.length > 0 ? Math.round((masteredCount / cTopics.length) * 100) : 0;

              return (
                <View key={course.id || idx} style={styles.courseCard}>
                  <View style={[styles.colorBar, { backgroundColor: course.color || '#C2A878' }]} />
                  <View style={styles.courseHeader}>
                    <View>
                      <Text style={styles.courseCode}>{course.courseCode || 'COURSE'} • {course.credits} Credits</Text>
                      <Text style={styles.courseName}>{course.name || course.title}</Text>
                    </View>
                  </View>

                  {/* Syllabus Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>Syllabus Mastered</Text>
                      <Text style={styles.progressPct}>{pct}% ({masteredCount}/{cTopics.length})</Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: course.color || '#C2A878' }]} />
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add Course Modal */}
      <Modal
        visible={addCourseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddCourseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Course</Text>
            
            <Text style={styles.inputLabel}>Course Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Operating Systems"
              placeholderTextColor="#78716c"
              value={newCourseName}
              onChangeText={setNewCourseName}
            />

            <Text style={styles.inputLabel}>Course Code</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. CS 301"
              placeholderTextColor="#78716c"
              value={newCourseCode}
              onChangeText={setNewCourseCode}
            />

            <Text style={styles.inputLabel}>Credits</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={newCourseCredits}
              onChangeText={setNewCourseCredits}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn}
                onPress={() => setAddCourseModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSaveBtn}
                onPress={handleAddCourse}
              >
                <Text style={styles.modalSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115'
  },
  scrollContent: {
    padding: 20
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#C2A878'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#a8a29e',
    marginTop: 2
  },
  addCourseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#C2A878',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addCourseBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000'
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12
  },
  metricLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
    color: '#a8a29e'
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#C2A878',
    marginVertical: 4
  },
  metricSub: {
    fontSize: 10,
    color: '#78716c'
  },
  reviewBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10b981'
  },
  bannerSub: {
    fontSize: 11,
    color: '#a8a29e',
    marginTop: 2
  },
  reviewBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000'
  },
  sectionWrap: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12
  },
  examCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8
  },
  examName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff'
  },
  examCourse: {
    fontSize: 11,
    color: '#a8a29e',
    marginTop: 2
  },
  examDays: {
    fontSize: 13,
    fontWeight: '700'
  },
  examDate: {
    fontSize: 10,
    color: '#78716c',
    marginTop: 2
  },
  courseCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden'
  },
  colorBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3
  },
  courseHeader: {
    marginBottom: 12
  },
  courseCode: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#C2A878'
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2
  },
  progressContainer: {
    marginTop: 6
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  progressLabel: {
    fontSize: 10,
    color: '#a8a29e'
  },
  progressPct: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff'
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2
  },
  emptyWrap: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12
  },
  emptyText: {
    fontSize: 12,
    color: '#a8a29e',
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#181512',
    borderColor: 'rgba(194,168,120,0.25)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C2A878',
    marginBottom: 14
  },
  inputLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: '#a8a29e',
    fontWeight: '700',
    marginBottom: 4
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontSize: 13,
    marginBottom: 12
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  modalCancelBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600'
  },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#C2A878'
  },
  modalSaveBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700'
  }
});

