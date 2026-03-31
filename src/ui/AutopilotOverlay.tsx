import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AutopilotPath,
  AUTOPILOT_MAX_PX,
  autopilotSpeedLabel,
} from '../constants';
import { useApp } from '../context/AppContext';

type Props = { visible: boolean; onClose: () => void };

const PATHS: { id: AutopilotPath; label: string; icon: string }[] = [
  { id: 'north',    label: 'North',        icon: 'arrow-up-outline' },
  { id: 'south',    label: 'South',        icon: 'arrow-down-outline' },
  { id: 'east',     label: 'East',         icon: 'arrow-forward-outline' },
  { id: 'west',     label: 'West',         icon: 'arrow-back-outline' },
  { id: 'cardioid', label: 'Cardioid',     icon: 'sync-outline' },
  { id: 'bulb',     label: 'Hyperbolic',   icon: 'ellipse-outline' },
  { id: 'figure8',  label: 'Figure Eight', icon: 'infinite-outline' },
  { id: 'scenic',   label: 'Scenic Tour',  icon: 'map-outline' },
];

// ── Continuous speed slider ────────────────────────────────────────────────────
const THUMB_R  = 13;
const TOUCH_H  = 56;                              // tall hit area so the thumb is easy to grab
const TRACK_H  = 4;
const TRACK_TOP = (TOUCH_H - TRACK_H) / 2;       // centres track line vertically
const THUMB_TOP = (TOUCH_H - THUMB_R * 2) / 2;   // centres thumb vertically

function SpeedSlider({ value, onChange }: {
  value:    number;
  onChange: (n: number) => void;
}) {
  const trackWidthRef = useRef(0);
  const startValueRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder:  () => true,

    onPanResponderGrant: () => {
      // Capture current value as drag origin — never use locationX (unreliable
      // when touch lands on the thumb child View rather than the track)
      startValueRef.current = valueRef.current;
    },

    onPanResponderMove: (_evt, gs) => {
      const tw = trackWidthRef.current;
      if (tw <= 0) return;
      const newVal = Math.max(0, Math.min(AUTOPILOT_MAX_PX,
        startValueRef.current + (gs.dx / tw) * AUTOPILOT_MAX_PX));
      onChange(newVal);
    },
  })).current;

  const thumbLeft = trackWidth > 0
    ? (value / AUTOPILOT_MAX_PX) * trackWidth - THUMB_R
    : 0;
  const label = autopilotSpeedLabel(value);
  const isOff = value === 0;

  return (
    <View style={sl.container}>
      <View style={sl.labelRow}>
        <Text style={sl.key}>SPEED: </Text>
        <Text style={[sl.val, isOff && sl.valOff]}>{label}</Text>
      </View>

      <View
        style={sl.trackWrap}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          trackWidthRef.current = w;
          setTrackWidth(w);
        }}
        {...pan.panHandlers}
      >
        {/* Filled portion of track */}
        <View style={sl.trackBg} />
        {trackWidth > 0 && (
          <View style={[sl.trackFill, { width: (value / AUTOPILOT_MAX_PX) * trackWidth }]} />
        )}
        {trackWidth > 0 && (
          <View style={[sl.thumb, { left: thumbLeft }]} />
        )}
      </View>
    </View>
  );
}

const sl = StyleSheet.create({
  container:  { marginBottom: 24 },
  labelRow:   { flexDirection: 'row', alignItems: 'baseline', marginBottom: 18 },
  key:        { color: '#aaa', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  val:        { color: '#fff', fontSize: 14 },
  valOff:     { color: '#e05555' },
  trackWrap:  { height: TOUCH_H },
  trackBg: {
    position: 'absolute', top: TRACK_TOP, left: 0, right: 0,
    height: TRACK_H, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2,
  },
  trackFill: {
    position: 'absolute', top: TRACK_TOP, left: 0,
    height: TRACK_H, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: THUMB_TOP,
    width: THUMB_R * 2, height: THUMB_R * 2, borderRadius: THUMB_R,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4,
    elevation: 4,
  },
});

// ── Path radio row ─────────────────────────────────────────────────────────────
function PathRow({ item, selected, onPress }: {
  item: typeof PATHS[number]; selected: boolean; onPress: () => void;
}) {
  return (
    <Pressable style={[pr.row, selected && pr.rowSel]} onPress={onPress}>
      <View style={[pr.radio, selected && pr.radioSel]}>
        {selected && <View style={pr.dot} />}
      </View>
      <Ionicons name={item.icon as any} size={18} color={selected ? '#fff' : '#666'} style={pr.icon} />
      <Text style={[pr.label, selected && pr.labelSel]}>{item.label}</Text>
    </Pressable>
  );
}

const pr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10,
  },
  rowSel:    { backgroundColor: 'rgba(255,255,255,0.07)' },
  radio:     { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#444', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioSel:  { borderColor: '#fff' },
  dot:       { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
  icon:      { marginRight: 10 },
  label:     { color: '#666', fontSize: 15 },
  labelSel:  { color: '#fff' },
});

// ── Overlay ────────────────────────────────────────────────────────────────────
export default function AutopilotOverlay({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { autopilotSpeed, setAutopilotSpeed, autopilotPath, setAutopilotPath } = useApp();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ov.backdrop} onPress={onClose}>
        <Pressable
          style={[ov.sheet, { paddingBottom: insets.bottom + 20 }]}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={ov.header}>
            <Ionicons name="airplane-outline" size={22} color="#fff" />
            <Text style={ov.title}>Autopilot</Text>
            <Pressable
              onPress={onClose}
              hitSlop={16}
              style={ov.closeBtn}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>

          <SpeedSlider value={autopilotSpeed} onChange={setAutopilotSpeed} />

          <Text style={ov.sectionLabel}>PATH</Text>

          {PATHS.map(item => (
            <PathRow
              key={item.id}
              item={item}
              selected={autopilotPath === item.id}
              onPress={() => {
                setAutopilotPath(item.id);
                if (autopilotSpeed === 0) setAutopilotSpeed(8);
              }}
            />
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ov = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    color: '#fff', fontSize: 17, fontWeight: '700',
    marginLeft: 10, flex: 1,
  },
  closeBtn: {
    width: 36, height: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: {
    color: '#aaa', fontSize: 12, fontWeight: '700',
    letterSpacing: 1.2, marginBottom: 4,
  },
});
