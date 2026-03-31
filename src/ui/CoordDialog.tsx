import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BOUND } from '../constants';

type Props = {
  visible: boolean;
  initialCr: number;
  initialCi: number;
  onSubmit: (cr: number, ci: number) => void;
  onClose: () => void;
};

export default function CoordDialog({ visible, initialCr, initialCi, onSubmit, onClose }: Props) {
  const [crText, setCrText] = useState('');
  const [ciText, setCiText] = useState('');

  // Reset inputs each time dialog opens
  const handleShow = () => {
    setCrText(initialCr.toFixed(8));
    setCiText(initialCi.toFixed(8));
  };

  const handleSubmit = () => {
    const cr = parseFloat(crText);
    const ci = parseFloat(ciText);
    if (isNaN(cr) || isNaN(ci)) return;
    onSubmit(
      Math.max(-BOUND, Math.min(BOUND, cr)),
      Math.max(-BOUND, Math.min(BOUND, ci)),
    );
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Pressable style={styles.closeIcon} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color="#888" />
          </Pressable>

          <Text style={styles.title}>Go to coordinates</Text>

          <Text style={styles.label}>Cr (real part)</Text>
          <TextInput
            style={styles.input}
            value={crText}
            onChangeText={setCrText}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
            selectTextOnFocus
            placeholderTextColor="#555"
          />

          <Text style={styles.label}>Ci (imaginary part)</Text>
          <TextInput
            style={styles.input}
            value={ciText}
            onChangeText={setCiText}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            selectTextOnFocus
            placeholderTextColor="#555"
          />

          <Pressable style={styles.goBtn} onPress={handleSubmit}>
            <Text style={styles.goText}>Go</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    padding: 24,
  },
  closeIcon: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 20,
    marginTop: 4,
  },
  label: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontFamily: 'Courier',
    fontSize: 15,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  goBtn: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  goText: { color: '#000', fontSize: 15, fontWeight: '700' },
});
