import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { STATUS_BG, STATUS_LABELS, STATUS_TEXT } from '../lib/constants';

interface StatusBadgeProps {
  status: string;
  small?: boolean;
}

export function StatusBadge({ status, small }: StatusBadgeProps) {
  const bg = STATUS_BG[status] ?? '#f1f5f9';
  const color = STATUS_TEXT[status] ?? '#475569';
  const label = STATUS_LABELS[status] ?? status;

  return (
    <View style={[styles.badge, { backgroundColor: bg }, small && styles.small]}>
      <Text style={[styles.text, { color }, small && styles.smallText]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  smallText: {
    fontSize: 11,
  },
});
