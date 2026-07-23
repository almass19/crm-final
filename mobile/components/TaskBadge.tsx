import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { TASK_STATUS_BG, TASK_STATUS_LABELS, TASK_STATUS_TEXT } from '../lib/constants';

interface TaskBadgeProps {
  status: string;
}

export function TaskBadge({ status }: TaskBadgeProps) {
  const bg = TASK_STATUS_BG[status] ?? '#f1f5f9';
  const color = TASK_STATUS_TEXT[status] ?? '#475569';
  const label = TASK_STATUS_LABELS[status] ?? status;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
