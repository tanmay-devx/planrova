/**
 * mobile/src/screens/AIAssistantScreen.js
 * Mobile AI Assistant Screen for Planrova 2.0 (React Native + Expo).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';
import {
  MockAIProvider,
  processAIQuery,
  approveAndExecuteProposal,
  rejectProposal,
  AI_ACTION_TYPES,
  AI_PROPOSAL_STATUSES,
  AI_CONTEXT_CATEGORIES,
  enableAI,
  disableAI,
  updateDomainPermission,
  normalizeAIPermissions
} from '../../../shared/domain/ai';

export default function AIAssistantScreen({ navigation }) {
  const [permissions, setPermissions] = useFirestoreData('ai_permissions', normalizeAIPermissions());
  const [messages, setMessages] = useFirestoreData('ai_messages', []);
  const [proposals, setProposals] = useFirestoreData('ai_proposals', []);
  const [tasks, setTasks] = useFirestoreData('tasks', []);

  const [inputQuery, setInputQuery] = useState('');
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const isEnabled = Boolean(permissions?.enabled);

  const mockProvider = new MockAIProvider();

  const handleSend = async () => {
    if (!inputQuery.trim()) return;
    const query = inputQuery.trim();
    setInputQuery('');

    const userData = { tasks };

    try {
      const result = await processAIQuery({
        query,
        permissions,
        userData,
        provider: mockProvider
      });

      setMessages([...messages, result.userMessage, result.assistantMessage]);
      if (result.proposals?.length) {
        setProposals([...proposals, ...result.proposals]);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const handleApproveProposal = async (proposal) => {
    const domainHandlers = {
      [AI_ACTION_TYPES.CREATE_TASK]: async (payload) => {
        const newTask = {
          id: `task_${Date.now()}`,
          title: payload.title,
          priority: payload.priority || 'medium',
          dueDate: payload.dueDate || new Date().toISOString().slice(0, 10),
          completed: false,
          createdAt: new Date().toISOString()
        };
        setTasks([newTask, ...tasks]);
        return newTask;
      }
    };

    try {
      const res = await approveAndExecuteProposal({ proposal, domainHandlers });
      if (res.executed) {
        setProposals(proposals.map(p => p.id === proposal.id ? res.proposal : p));
        Alert.alert('Success', 'Action proposal approved and executed!');
      }
    } catch (err) {
      Alert.alert('Execution Error', err.message);
    }
  };

  const handleRejectProposal = (proposal) => {
    const rejected = rejectProposal({ proposal });
    setProposals(proposals.map(p => p.id === proposal.id ? rejected : p));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSubtitle}>
            {isEnabled ? '● Active (Privacy-First)' : '○ Disabled (Opt-In Required)'}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.settingsBtn}
          onPress={() => setSettingsModalVisible(true)}
        >
          <Ionicons name="settings-outline" size={20} color="#C2A878" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Daily Briefing Banner */}
        <View style={styles.briefingCard}>
          <Text style={styles.briefingTitle}>⚡ Daily Intelligence Briefing</Text>
          <Text style={styles.briefingText}>
            {isEnabled 
              ? `You have ${tasks.filter(t => !t.completed).length} pending tasks today. Deterministic scheduling engines remain active.`
              : 'AI is disabled. Tap settings above to enable assistance.'}
          </Text>
        </View>

        {/* Message Feed */}
        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Ask Planrova Assistant</Text>
            <Text style={styles.emptySub}>
              "What should I focus on today?" or "Remind me to finish DBMS lab tomorrow"
            </Text>
          </View>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === 'user';
            const relatedProposals = proposals.filter(p => m.proposalIds?.includes(p.id));

            return (
              <View key={m.id || idx} style={[styles.messageWrap, isUser ? styles.msgRight : styles.msgLeft]}>
                <View style={[styles.msgBubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                  <Text style={[styles.msgText, isUser ? { color: '#000' } : { color: '#fff' }]}>
                    {m.content}
                  </Text>
                </View>

                {/* Render Attached Action Proposals */}
                {relatedProposals.map((p, pIdx) => (
                  <View key={p.id || pIdx} style={styles.proposalCard}>
                    <Text style={styles.proposalBadge}>⚡ PROPOSAL: {p.actionType}</Text>
                    <Text style={styles.proposalSummary}>{p.summary}</Text>
                    <Text style={styles.proposalStatus}>Status: {p.approvalStatus}</Text>

                    {p.approvalStatus === AI_PROPOSAL_STATUSES.PENDING_APPROVAL && (
                      <View style={styles.propBtnRow}>
                        <TouchableOpacity 
                          style={styles.approveBtn}
                          onPress={() => handleApproveProposal(p)}
                        >
                          <Text style={styles.btnTextDark}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.rejectBtn}
                          onPress={() => handleRejectProposal(p)}
                        >
                          <Text style={styles.btnTextDanger}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.inputField}
          placeholder={isEnabled ? "Type a message or task..." : "Enable AI in settings..."}
          placeholderTextColor="#78716c"
          value={inputQuery}
          onChangeText={setInputQuery}
          editable={isEnabled}
        />
        <TouchableOpacity 
          style={[styles.sendBtn, !isEnabled && { opacity: 0.5 }]}
          onPress={handleSend}
          disabled={!isEnabled}
        >
          <Ionicons name="arrow-up" size={18} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Privacy Settings Modal */}
      <Modal
        visible={settingsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>AI Privacy & Permissions</Text>
              <TouchableOpacity onPress={() => setSettingsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#a8a29e" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.toggleRow}
              onPress={() => {
                const updated = isEnabled ? disableAI(permissions) : enableAI(permissions);
                setPermissions(updated);
              }}
            >
              <View>
                <Text style={styles.toggleTitle}>Enable Planrova AI</Text>
                <Text style={styles.toggleSub}>Master opt-in switch.</Text>
              </View>
              <Ionicons 
                name={isEnabled ? "checkbox" : "square-outline"} 
                size={24} 
                color={isEnabled ? "#10b981" : "#78716c"} 
              />
            </TouchableOpacity>

            <Text style={styles.sectionHeader}>Category Permissions</Text>

            {Object.values(AI_CONTEXT_CATEGORIES).map(cat => {
              const isGranted = Boolean(permissions?.domains?.[cat]);
              return (
                <TouchableOpacity 
                  key={cat}
                  style={styles.categoryRow}
                  onPress={() => {
                    const updated = updateDomainPermission(permissions, cat, !isGranted);
                    setPermissions(updated);
                  }}
                >
                  <Text style={styles.categoryName}>{cat.toUpperCase()}</Text>
                  <Ionicons 
                    name={isGranted ? "checkmark-circle" : "close-circle-outline"} 
                    size={20} 
                    color={isGranted ? "#C2A878" : "#78716c"} 
                  />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity 
              style={styles.closeBtn}
              onPress={() => setSettingsModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Done</Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
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
  settingsBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)'
  },
  scrollContent: {
    padding: 16
  },
  briefingCard: {
    backgroundColor: 'rgba(194, 168, 120, 0.05)',
    borderColor: 'rgba(194, 168, 120, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  briefingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C2A878',
    marginBottom: 4
  },
  briefingText: {
    fontSize: 12,
    color: '#d6d3d1',
    lineHeight: 18
  },
  emptyWrap: {
    paddingVertical: 50,
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6
  },
  emptySub: {
    fontSize: 12,
    color: '#78716c',
    textAlign: 'center',
    paddingHorizontal: 30
  },
  messageWrap: {
    marginBottom: 14,
    width: '100%'
  },
  msgRight: {
    alignItems: 'flex-end'
  },
  msgLeft: {
    alignItems: 'flex-start'
  },
  msgBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 14
  },
  bubbleUser: {
    backgroundColor: '#C2A878'
  },
  bubbleAssistant: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18
  },
  proposalCard: {
    marginTop: 8,
    width: '85%',
    backgroundColor: '#1E232A',
    borderColor: 'rgba(194, 168, 120, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12
  },
  proposalBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2A878',
    marginBottom: 4
  },
  proposalSummary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4
  },
  proposalStatus: {
    fontSize: 10,
    color: '#a8a29e',
    marginBottom: 10
  },
  propBtnRow: {
    flexDirection: 'row',
    gap: 8
  },
  approveBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  rejectBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnTextDark: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000'
  },
  btnTextDanger: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444'
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#16191F',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  inputField: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8
  },
  sendBtn: {
    backgroundColor: '#C2A878',
    padding: 10,
    borderRadius: 8
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20
  },
  modalCard: {
    backgroundColor: '#181B20',
    borderRadius: 14,
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#C2A878'
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff'
  },
  toggleSub: {
    fontSize: 11,
    color: '#a8a29e'
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78716c',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#d6d3d1'
  },
  closeBtn: {
    backgroundColor: '#C2A878',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000'
  }
});

