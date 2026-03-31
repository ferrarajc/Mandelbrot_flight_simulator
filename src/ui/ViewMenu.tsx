import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VIEW_LABELS, ViewMode } from '../constants';

const VIEWS: ViewMode[] = ['mandelbrot', 'julia', 'split', 'mandelbrot_only', 'julia_only'];

type Props = {
  visible: boolean;
  current: ViewMode;
  onSelect: (v: ViewMode) => void;
  onClose: () => void;
};

export default function ViewMenu({ visible, current, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.menu} onPress={e => e.stopPropagation()}>
          <Text style={styles.heading}>View</Text>
          {VIEWS.map(v => (
            <Pressable
              key={v}
              style={styles.row}
              onPress={() => { onSelect(v); onClose(); }}
            >
              <Text style={styles.label}>{VIEW_LABELS[v]}</Text>
              {current === v && (
                <Ionicons name="checkmark" size={20} color="#fff" />
              )}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  menu: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  heading: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  label: { color: '#fff', fontSize: 16 },
});
