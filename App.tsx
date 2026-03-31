import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from './src/context/AppContext';
import { usePersistence } from './src/hooks/usePersistence';
import { useAutopilot } from './src/hooks/useAutopilot';
import MandelbrotBg   from './src/views/MandelbrotBg';
import JuliaBg        from './src/views/JuliaBg';
import SplitScreen    from './src/views/SplitScreen';
import MandelbrotOnly from './src/views/MandelbrotOnly';
import JuliaOnly      from './src/views/JuliaOnly';
import Drawer            from './src/ui/Drawer';
import HelpOverlay       from './src/ui/HelpOverlay';
import ViewMenu          from './src/ui/ViewMenu';
import ColorMenu         from './src/ui/ColorMenu';
import AutopilotOverlay  from './src/ui/AutopilotOverlay';
import CoordDialog       from './src/ui/CoordDialog';
import HintBanner        from './src/ui/HintBanner';
import LoadingOverlay    from './src/ui/LoadingOverlay';

function Main() {
  const { height } = useWindowDimensions();
  const ctx = useApp();
  const { cx, cy, mandZoom, viewMode, setViewMode, colorScheme, setColorScheme,
          autopilotSpeed, autopilotPath } = ctx;

  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [showHelp,        setShowHelp]        = useState(false);
  const [showViewMenu,    setShowViewMenu]     = useState(false);
  const [showColorMenu,   setShowColorMenu]    = useState(false);
  const [showAutopilot,   setShowAutopilot]    = useState(false);
  const [showCoordDialog, setShowCoordDialog]  = useState(false);
  const [hintActive,      setHintActive]      = useState(false);
  const [appReady,        setAppReady]        = useState(false);
  const hintDismissed = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem('mfs_hint_seen').then(val => {
      if (!val) setHintActive(true);
    });
  }, []);

  // Any open overlay pauses autopilot
  const anyOverlayOpen = showViewMenu || showColorMenu || showAutopilot || showHelp;

  useAutopilot({
    cx, cy, mandZoom,
    speed: autopilotSpeed,
    path:  autopilotPath,
    paused: anyOverlayOpen,
    height,
  });

  // Live coordinate display
  const [drawerCX, setDrawerCX] = useState(0);
  const [drawerCY, setDrawerCY] = useState(0);

  useEffect(() => {
    if (!drawerOpen) return;
    setDrawerCX(cx.current);
    setDrawerCY(cy.current);
    const id = setInterval(() => {
      setDrawerCX(cx.current);
      setDrawerCY(cy.current);
    }, 80);
    return () => clearInterval(id);
  }, [drawerOpen]);

  const { save } = usePersistence(ctx, { setViewMode, setColorScheme });

  const handleTap = () => {
    setDrawerOpen(prev => !prev);
    if (!hintDismissed.current) {
      hintDismissed.current = true;
      setHintActive(false);
      AsyncStorage.setItem('mfs_hint_seen', '1');
    }
  };

  const handleViewSelect = (v: typeof viewMode) => {
    setAppReady(false);
    setViewMode(v);
    save(v, colorScheme.id);
  };

  const handleColorSelect = (s: typeof colorScheme) => {
    setColorScheme(s);
    save(viewMode, s.id);
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {viewMode === 'mandelbrot'      && <MandelbrotBg   onTap={handleTap} onReady={() => setAppReady(true)} />}
      {viewMode === 'julia'           && <JuliaBg        onTap={handleTap} onReady={() => setAppReady(true)} />}
      {viewMode === 'split'           && <SplitScreen    onTap={handleTap} onReady={() => setAppReady(true)} />}
      {viewMode === 'mandelbrot_only' && <MandelbrotOnly onTap={handleTap} onReady={() => setAppReady(true)} />}
      {viewMode === 'julia_only'      && <JuliaOnly      onTap={handleTap} onReady={() => setAppReady(true)} />}

      <LoadingOverlay ready={appReady} />

      <Drawer
        open={drawerOpen}
        cx={drawerCX}
        cy={drawerCY}
        viewMode={viewMode}
        colorScheme={colorScheme}
        autopilotOn={autopilotSpeed > 0}
        onOpenViewMenu={() => setShowViewMenu(true)}
        onOpenColorMenu={() => setShowColorMenu(true)}
        onOpenAutopilot={() => setShowAutopilot(true)}
        onEditCoords={() => setShowCoordDialog(true)}
        onOpenHelp={() => setShowHelp(true)}
      />

      <ViewMenu
        visible={showViewMenu}
        current={viewMode}
        onSelect={handleViewSelect}
        onClose={() => setShowViewMenu(false)}
      />
      <ColorMenu
        visible={showColorMenu}
        current={colorScheme}
        onSelect={handleColorSelect}
        onClose={() => setShowColorMenu(false)}
      />
      <HelpOverlay
        visible={showHelp}
        onClose={() => setShowHelp(false)}
      />
      <AutopilotOverlay
        visible={showAutopilot}
        onClose={() => setShowAutopilot(false)}
      />
      <HintBanner active={hintActive} />

      <CoordDialog
        visible={showCoordDialog}
        initialCr={cx.current}
        initialCi={cy.current}
        onSubmit={(cr, ci) => { cx.current = cr; cy.current = ci; }}
        onClose={() => setShowCoordDialog(false)}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Main />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
});
