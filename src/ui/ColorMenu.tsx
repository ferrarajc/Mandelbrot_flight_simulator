import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLOR_SCHEMES,
  ColorScheme,
  DISC_T_EDGE,
  DISC_T_OUTSIDE,
  evalPalette,
} from '../constants';

type Props = {
  visible: boolean;
  current: ColorScheme;
  onSelect: (s: ColorScheme) => void;
  onClose: () => void;
};

function Disc({ scheme }: { scheme: ColorScheme }) {
  const outside = evalPalette(DISC_T_OUTSIDE, scheme);
  const edge    = evalPalette(DISC_T_EDGE,    scheme);
  return (
    <View style={[disc.circle, { backgroundColor: edge }]}>
      {/* upper-left triangle using the border trick */}
      <View style={[disc.triangle, { borderTopColor: outside }]} />
    </View>
  );
}

export default function ColorMenu({ visible, current, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.menu} onPress={e => e.stopPropagation()}>
          <Text style={styles.heading}>Color Scheme</Text>
          {COLOR_SCHEMES.map(s => (
            <Pressable
              key={s.id}
              style={styles.row}
              onPress={() => { onSelect(s); onClose(); }}
            >
              <Disc scheme={s} />
              <Text style={styles.label}>{s.label}</Text>
              {current.id === s.id && (
                <Ionicons name="checkmark" size={20} color="#fff" />
              )}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const DISC = 36;
const disc = StyleSheet.create({
  circle: {
    width: DISC, height: DISC, borderRadius: DISC / 2, overflow: 'hidden',
  },
  triangle: {
    position: 'absolute', top: 0, left: 0,
    width: 0, height: 0,
    borderStyle: 'solid',
    borderTopWidth: DISC, borderRightWidth: DISC,
    borderRightColor: 'transparent',
    // borderTopColor set per instance
  },
});

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
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#333',
  },
  label: { flex: 1, color: '#fff', fontSize: 16 },
});
