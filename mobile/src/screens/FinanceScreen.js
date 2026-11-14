import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFirestoreData } from '../hooks/useFirestoreData';

export default function FinanceScreen() {
  const [accounts, setAccounts] = useFirestoreData('finance_accounts', [
    { id: 'acc_main', name: 'Main Wallet', accountType: 'cash', currentBalanceMinor: 150000, currency: 'INR' }
  ]);
  const [transactions, setTransactions] = useFirestoreData('finance_transactions', []);
  const [budgets, setBudgets] = useFirestoreData('finance_budgets', [
    { id: 'bgt_overall', name: 'Monthly Budget', limitMinor: 1000000, period: 'monthly', currency: 'INR' }
  ]);
  const [savingsGoals, setSavingsGoals] = useFirestoreData('finance_savings_goals', [
    { id: 'svg_main', title: 'Emergency Fund', targetAmountMinor: 5000000, currentAmountMinor: 1200000, currency: 'INR' }
  ]);

  const [showAddTxn, setShowAddTxn] = useState(false);
  const [txnTitle, setTxnTitle] = useState('');
  const [txnAmount, setTxnAmount] = useState('');
  const [txnType, setTxnType] = useState('expense');

  // Compute monthly totals
  const totalIncome = transactions
    .filter(t => t.type === 'income' && !t.deletedAt)
    .reduce((sum, t) => sum + (t.amountMinor || (t.amount ? t.amount * 100 : 0)), 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense' && !t.deletedAt)
    .reduce((sum, t) => sum + (t.amountMinor || (t.amount ? t.amount * 100 : 0)), 0);

  const activeBudget = budgets[0] || { limitMinor: 1000000 };
  const budgetUtilization = activeBudget.limitMinor > 0
    ? Math.min(100, Math.round((totalExpense / activeBudget.limitMinor) * 100))
    : 0;

  const handleAddTransaction = () => {
    if (!txnTitle.trim() || !txnAmount) {
      Alert.alert('Required', 'Please enter a title and amount');
      return;
    }
    const amtMinor = Math.round(parseFloat(txnAmount) * 100);
    const newTxn = {
      id: `txn_${Date.now()}`,
      title: txnTitle.trim(),
      amountMinor: amtMinor,
      amount: parseFloat(txnAmount),
      type: txnType,
      currency: 'INR',
      transactionDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString()
    };

    setTransactions([newTxn, ...transactions]);
    setTxnTitle('');
    setTxnAmount('');
    setShowAddTxn(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Finance Workspace</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddTxn(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Transaction</Text>
          </TouchableOpacity>
        </View>

        {/* Financial Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Income</Text>
            <Text style={[styles.metricValue, { color: '#10B981' }]}>₹{(totalIncome / 100).toFixed(0)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Expenses</Text>
            <Text style={[styles.metricValue, { color: '#EF4444' }]}>₹{(totalExpense / 100).toFixed(0)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Net</Text>
            <Text style={[styles.metricValue, { color: totalIncome >= totalExpense ? '#10B981' : '#EF4444' }]}>
              ₹{((totalIncome - totalExpense) / 100).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Budget Progress */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget Progress</Text>
            <Text style={styles.sectionBadge}>{budgetUtilization}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${budgetUtilization}%` }]} />
          </View>
          <Text style={styles.helperText}>
            Spent ₹{(totalExpense / 100).toFixed(0)} of ₹{(activeBudget.limitMinor / 100).toFixed(0)}
          </Text>
        </View>

        {/* Savings Goals */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Savings Goals</Text>
          {savingsGoals.map(g => {
            const pct = g.targetAmountMinor > 0
              ? Math.min(100, Math.round((g.currentAmountMinor / g.targetAmountMinor) * 100))
              : 0;
            return (
              <View key={g.id} style={styles.goalItem}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.goalTitle}>{g.title}</Text>
                  <Text style={styles.goalPct}>{pct}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: '#84CC16' }]} />
                </View>
                <Text style={styles.helperText}>
                  ₹{(g.currentAmountMinor / 100).toFixed(0)} / ₹{(g.targetAmountMinor / 100).toFixed(0)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Recent Transactions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.slice(0, 10).map(t => (
            <View key={t.id} style={styles.txnItem}>
              <View>
                <Text style={styles.txnTitle}>{t.title}</Text>
                <Text style={styles.txnDate}>{t.transactionDate}</Text>
              </View>
              <Text style={[styles.txnAmount, { color: t.type === 'income' ? '#10B981' : '#EF4444' }]}>
                {t.type === 'income' ? '+' : '-'}₹{(t.amountMinor ? t.amountMinor / 100 : (t.amount || 0)).toFixed(0)}
              </Text>
            </View>
          ))}
          {transactions.length === 0 && (
            <Text style={styles.emptyText}>No transactions recorded yet.</Text>
          )}
        </View>
      </ScrollView>

      {/* Add Transaction Modal */}
      <Modal visible={showAddTxn} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Transaction</Text>
            <View style={styles.typeSelector}>
              <TouchableOpacity
                style={[styles.typeBtn, txnType === 'expense' && styles.typeBtnActive]}
                onPress={() => setTxnType('expense')}
              >
                <Text style={styles.typeBtnText}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, txnType === 'income' && styles.typeBtnActive]}
                onPress={() => setTxnType('income')}
              >
                <Text style={styles.typeBtnText}>Income</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Title (e.g. Lunch, Tuition)"
              placeholderTextColor="#666"
              value={txnTitle}
              onChangeText={setTxnTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Amount (₹)"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={txnAmount}
              onChangeText={setTxnAmount}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAddTxn(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddTransaction}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1115' },
  scrollContent: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#F3F1EC' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', marginLeft: 4, fontSize: 13 },
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: '#1A1D24', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#2A2E39' },
  metricLabel: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', fontWeight: '600' },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  sectionCard: { backgroundColor: '#1A1D24', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#2A2E39', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#F3F1EC', marginBottom: 10 },
  sectionBadge: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  progressBarBg: { height: 8, backgroundColor: '#2A2E39', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },
  helperText: { fontSize: 12, color: '#9CA3AF' },
  goalItem: { marginBottom: 12 },
  goalTitle: { fontSize: 14, fontWeight: '600', color: '#F3F1EC' },
  goalPct: { fontSize: 12, fontWeight: '700', color: '#84CC16' },
  txnItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A2E39' },
  txnTitle: { fontSize: 14, fontWeight: '600', color: '#F3F1EC' },
  txnDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  txnAmount: { fontSize: 15, fontWeight: '700' },
  emptyText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#1A1D24', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#2A2E39' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#F3F1EC', marginBottom: 14 },
  typeSelector: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2A2E39', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  typeBtnText: { color: '#F3F1EC', fontWeight: '600', fontSize: 13 },
  input: { backgroundColor: '#0F1115', color: '#F3F1EC', borderWidth: 1, borderColor: '#2A2E39', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  cancelBtnText: { color: '#9CA3AF', fontWeight: '600' },
  saveBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: '#fff', fontWeight: '600' }
});

