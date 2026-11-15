import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';

export default function ProjectsScreen() {
  const [projects = [], setProjects, projectsLoading = false] = useFirestoreData('projects', []);
  const [milestones = [], setMilestones] = useFirestoreData('milestones', []);
  const [tasks = []] = useFirestoreData('tasks', []);

  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'in_progress', 'completed'
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newCategory, setNewCategory] = useState('work'); // 'work', 'study', 'personal'

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return projects;
    return projects.filter(p => p.status === activeFilter);
  }, [projects, activeFilter]);

  // Compute stats for each project
  const projectSummaries = useMemo(() => {
    return filteredProjects.map(proj => {
      const projMilestones = (milestones || []).filter(m => m.projectId === proj.id);
      const projTasks = (tasks || []).filter(t => t.projectId === proj.id);

      const completedMilestones = projMilestones.filter(m => m.status === 'completed').length;
      const totalMilestones = projMilestones.length;

      const completedTasks = projTasks.filter(t => t.completed || t.status === 'completed').length;
      const totalTasks = projTasks.length;

      // Progress calculation
      let progress = 0;
      if (totalMilestones > 0 || totalTasks > 0) {
        const milestoneWeight = totalMilestones > 0 ? 0.6 : 0;
        const taskWeight = totalTasks > 0 ? (totalMilestones > 0 ? 0.4 : 1.0) : 0;
        const mScore = totalMilestones > 0 ? (completedMilestones / totalMilestones) : 0;
        const tScore = totalTasks > 0 ? (completedTasks / totalTasks) : 0;
        progress = Math.round((mScore * milestoneWeight + tScore * taskWeight) * 100);
      }

      // Health diagnostic
      let health = 'ON_TRACK';
      if (proj.targetDate) {
        const daysRemaining = Math.ceil((new Date(proj.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
        if (daysRemaining < 3 && progress < 60) {
          health = 'OFF_TRACK';
        } else if (daysRemaining < 7 && progress < 40) {
          health = 'AT_RISK';
        }
      }

      return {
        ...proj,
        totalMilestones,
        completedMilestones,
        totalTasks,
        completedTasks,
        progress,
        health
      };
    });
  }, [filteredProjects, milestones, tasks]);

  const handleCreateProject = () => {
    if (!newTitle.trim()) {
      Alert.alert('Required Field', 'Please provide a project title.');
      return;
    }

    const newProject = {
      id: `proj_${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      targetDate: newTargetDate.trim() || null,
      category: newCategory,
      status: 'in_progress',
      createdAt: new Date().toISOString()
    };

    setProjects([...projects, newProject]);
    setNewTitle('');
    setNewDesc('');
    setNewTargetDate('');
    setModalVisible(false);
  };

  const toggleProjectStatus = (projId, currentStatus) => {
    const nextStatus = currentStatus === 'completed' ? 'in_progress' : 'completed';
    setProjects(projects.map(p => p.id === projId ? { ...p, status: nextStatus } : p));
  };

  const getHealthBadge = (health) => {
    if (health === 'OFF_TRACK') {
      return { label: 'Off Track', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
    }
    if (health === 'AT_RISK') {
      return { label: 'At Risk', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
    }
    return { label: 'On Track', bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981' };
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Projects Workspace</Text>
          <Text style={styles.headerSubtitle}>
            {projectSummaries.length} active initiatives & roadmaps
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={20} color="#0F1115" />
          <Text style={styles.addBtnText}>New Project</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {['all', 'in_progress', 'completed'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Projects List */}
      {projectsLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C2A878" />
        </View>
      ) : projectSummaries.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="briefcase-outline" size={48} color="#5A6070" />
          <Text style={styles.emptyTitle}>No projects in this view</Text>
          <Text style={styles.emptySubtitle}>Tap "+ New Project" to create your first milestone-driven initiative.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList}>
          {projectSummaries.map(proj => {
            const badge = getHealthBadge(proj.health);
            return (
              <View key={proj.id} style={styles.projectCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projTitle}>{proj.title}</Text>
                    {proj.description ? (
                      <Text style={styles.projDesc} numberOfLines={2}>{proj.description}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.healthBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.healthText, { color: badge.color }]}>{badge.label}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${proj.progress}%` }]} />
                  </View>
                  <Text style={styles.progressPercent}>{proj.progress}%</Text>
                </View>

                {/* Stats & Metadata Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons name="flag-outline" size={14} color="#a8a29e" />
                    <Text style={styles.statText}>
                      {proj.completedMilestones}/{proj.totalMilestones} Milestones
                    </Text>
                  </View>

                  <View style={styles.statItem}>
                    <Ionicons name="checkbox-outline" size={14} color="#a8a29e" />
                    <Text style={styles.statText}>
                      {proj.completedTasks}/{proj.totalTasks} Tasks
                    </Text>
                  </View>

                  {proj.targetDate ? (
                    <View style={styles.statItem}>
                      <Ionicons name="calendar-outline" size={14} color="#C2A878" />
                      <Text style={[styles.statText, { color: '#C2A878' }]}>
                        {proj.targetDate.slice(0, 10)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Card Action Controls */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      proj.status === 'completed' && styles.toggleBtnDone
                    ]}
                    onPress={() => toggleProjectStatus(proj.id, proj.status)}
                  >
                    <Ionicons
                      name={proj.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
                      size={16}
                      color={proj.status === 'completed' ? '#10b981' : '#a8a29e'}
                    />
                    <Text style={[styles.toggleBtnText, proj.status === 'completed' && { color: '#10b981' }]}>
                      {proj.status === 'completed' ? 'Completed' : 'Mark Complete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* New Project Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Project Initiative</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#a8a29e" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>PROJECT TITLE *</Text>
            <TextInput
              style={styles.modalInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="e.g. Final Year Thesis or App Launch"
              placeholderTextColor="#5A6070"
            />

            <Text style={styles.inputLabel}>DESCRIPTION</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Primary objectives and scope..."
              placeholderTextColor="#5A6070"
              multiline
            />

            <Text style={styles.inputLabel}>TARGET DEADLINE (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              value={newTargetDate}
              onChangeText={setNewTargetDate}
              placeholder="2026-12-31"
              placeholderTextColor="#5A6070"
            />

            <TouchableOpacity style={styles.createBtn} onPress={handleCreateProject}>
              <Text style={styles.createBtnText}>Create Project</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)'
  },
  headerTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#F3F1EC'
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8B92A0',
    marginTop: 2
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#C2A878',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 12,
    color: '#0F1115'
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  filterTabActive: {
    backgroundColor: 'rgba(194, 168, 120, 0.15)',
    borderColor: '#C2A878'
  },
  filterTabText: {
    fontSize: 12,
    color: '#8B92A0',
    fontWeight: '600'
  },
  filterTabTextActive: {
    color: '#C2A878'
  },
  scrollList: {
    padding: 16,
    gap: 14
  },
  projectCard: {
    backgroundColor: 'rgba(23, 27, 34, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    gap: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  projTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#F3F1EC'
  },
  projDesc: {
    fontSize: 12,
    color: '#8B92A0',
    marginTop: 4,
    lineHeight: 16
  },
  healthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  healthText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#C2A878',
    borderRadius: 3
  },
  progressPercent: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#C2A878',
    width: 36,
    textAlign: 'right'
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)'
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  statText: {
    fontSize: 11,
    color: '#a8a29e'
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 4
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.03)'
  },
  toggleBtnDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)'
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a8a29e'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  emptyTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#F3F1EC',
    marginTop: 12
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#5A6070',
    textAlign: 'center',
    marginTop: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#171B22',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    gap: 10
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  modalTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#F3F1EC'
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5A6070',
    letterSpacing: 1
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F3F1EC',
    fontSize: 13
  },
  createBtn: {
    backgroundColor: '#C2A878',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8
  },
  createBtnText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 13,
    color: '#0F1115'
  }
});

