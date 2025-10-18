// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import * as ExpoCamera from 'expo-camera';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';



// Host for backend (use the machine's Wi‑Fi IP so device can reach it)
// ATENÇÃO: SUBSTITUA 'X.X.X.X' PELO IP DE WI-FI REAL DA SUA MÁQUINA HOST
const BASE_HOST = '192.168.0.249:8000'; // Corrija aqui!

function pickCameraComponent(exportsObj: any) {
  if (!exportsObj) return null;
  const candidates = ['Camera', 'camera', 'CameraView', 'cameraView', 'CameraModule', 'CameraComponent', 'ExpoCamera', 'View'];
  for (const name of candidates) {
    const v = exportsObj[name];
    if (!v) continue;
    if (typeof v === 'function') return v;
    if (typeof v === 'object' && v !== null && ('render' in v || 'prototype' in v)) return v;
  }
  if (typeof (exportsObj as any).default === 'function') return (exportsObj as any).default;
  if (typeof exportsObj === 'function') return exportsObj;
  if (typeof exportsObj === 'object' && exportsObj !== null && 'render' in exportsObj) return exportsObj;
  return null;
}

const CameraComponent: any = pickCameraComponent(ExpoCamera) || pickCameraComponent((ExpoCamera as any).default) || null;
const CameraNamespace = ExpoCamera;

const ReconhecimentoScreen = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [nome, setNome] = useState('');
  const cameraRef = useRef(null);
  const ws = useRef(null);
  const [loading, setLoading] = useState(false);
  const [faces, setFaces] = useState([]);
  const [recognizerReady, setRecognizerReady] = useState(false);
  const viewLayoutRef = useRef({ width: 0, height: 0 });
  const [mirrorOverlay, setMirrorOverlay] = useState(true);
  const [lastFrameSize, setLastFrameSize] = useState({ w: 0, h: 0 });
  const streamIntervalRef = useRef<number | null>(null);
  const pauseSendingRef = useRef(false); // when recognized, pause sending for a bit
  const lastFacesRef = useRef([]);
  const nameStreakRef = useRef({ name: '', count: 0 });
  const [wsStatus, setWsStatus] = useState('closed');
  const reconnectAttempts = useRef(0);
  const [lastWsError, setLastWsError] = useState<string | null>(null);
  const navigation = useNavigation();
  // Flag para saber se está montado
  const isMountedRef = useRef(true);
  const route = useRoute();

  // start/stop streaming based on camera & ws readiness
  const startStreamIfReady = () => {
    if (!cameraRef.current || !ws.current || ws.current.readyState !== 1) return;
    if (streamIntervalRef.current) return;
    // Intervalo de 750ms para estabilidade
    streamIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) return;
      try {
        if (!cameraRef.current || !ws.current) return;
        if (pauseSendingRef.current) return;
        if (ws.current.readyState !== 1) return;
        const takePic = cameraRef.current.takePictureAsync || cameraRef.current.takeSnapshotAsync;
        if (!takePic) return;
        // Attempt to take picture; sometimes the first call fails on some devices, retry once
        let photo = null;
        try { photo = await takePic.call(cameraRef.current, { base64: true, quality: 0.5 }); } catch (err) {
          // retry once after a short delay
          await new Promise(r => setTimeout(r, 150));
          try { photo = await takePic.call(cameraRef.current, { base64: true, quality: 0.4 }); } catch (e) { return; }
        }
        if (!photo || !photo.base64) return;
        // Robust base64 -> Uint8Array for RN/Expo.
        const b64 = photo.base64;
        let binaryString = null;
        try {
          binaryString = atob(b64);
        } catch (e) {
          // fallback for environments without atob
          binaryString = Buffer.from(b64, 'base64').toString('binary');
        }
        const byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) byteArray[i] = binaryString.charCodeAt(i);
        try {
          ws.current.send(byteArray.buffer || byteArray);
        } catch (e) {
          setLastWsError(String(e));
        }
      } catch (err) {
        // ignore
      }
    }, 750); 
  };

  // ensure streaming starts when both WS is open and camera permission is granted
  useEffect(() => {
    if (wsStatus === 'open' && hasPermission) {
      startStreamIfReady();
    }
    // if WS closed, clear interval
    if (wsStatus !== 'open' && streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current as any);
      streamIntervalRef.current = null;
    }
  }, [wsStatus, hasPermission]);

  useEffect(() => {
    (async () => {
      const request = CameraNamespace.requestCameraPermissionsAsync || CameraNamespace.requestPermissionsAsync || (CameraNamespace as any).requestPermissionsAsync;
      const res = request ? await request() : { status: 'granted' };
      const status = res?.status ?? (res?.granted ? 'granted' : undefined) ?? 'granted';
      setHasPermission(status === 'granted');
    })();
  let closed = false;
  // expose openWs in closure so other UI helpers can call it
  const openWs = () => {
      try {
        setWsStatus('connecting');
        const s = new WebSocket(`ws://${BASE_HOST}/ws/reconhecimento`);
        ws.current = s;
        s.onopen = () => {
          reconnectAttempts.current = 0;
          setWsStatus('open');
          console.log('[WS] open connection');
          startStreamIfReady();
        };
        s.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            console.log('[WS] onmessage, faces:', (data.faces || []).length, 'recognizer_ready:', data.recognizer_ready, 'frameSize:', data.frameWidth, data.frameHeight);
            const detections = data.faces || [];
            const ready = !!data.recognizer_ready;
            setRecognizerReady(ready);
            // update last frame size for mapping
            if (data.frameWidth && data.frameHeight) {
              setLastFrameSize({ w: data.frameWidth, h: data.frameHeight });
            }
            // update overlay boxes with stable state
            setFaces(detections.map((f: any) => ({ ...f })));
            const reportedName = (detections.length > 0 && detections[0].name) ? detections[0].name : '';
            // Stabilize name: require 3 consecutive identical reports before committing
            if (reportedName === nameStreakRef.current.name) {
              nameStreakRef.current.count += 1;
            } else {
              nameStreakRef.current.name = reportedName;
              nameStreakRef.current.count = 1;
            }

            if (nameStreakRef.current.count >= 3) {
              // confirmed state
              if (reportedName && reportedName !== 'Desconhecido' && reportedName !== 'Usuário desconhecido') {
                setNome(reportedName);
                // Parar streaming imediatamente
                pauseSendingRef.current = true;
                if (streamIntervalRef.current) {
                  clearInterval(streamIntervalRef.current);
                  streamIntervalRef.current = null;
                }
                if (ws.current) {
                  try { ws.current.close(); } catch (e) {}
                  ws.current = null;
                }
                // Salva flag de reconhecimento no AsyncStorage
                import('react-native').then(async () => {
                  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
                  await AsyncStorage.setItem('is_recognized', 'true');
                });
                setTimeout(() => { pauseSendingRef.current = false; }, 3000);
                navigation.navigate('Chat');
              } else if (reportedName) {
                // either 'Usuário desconhecido' or other marker
                setNome(reportedName);
              } else {
                setNome('');
              }
            }
          } catch (err) {
            // ignore parse errors
          }
        };
        s.onerror = (err) => {
          console.warn('WS error', err);
          setLastWsError(String(err));
          setWsStatus('error');
        };
        s.onclose = () => {
          console.log('[WS] closed');
          setWsStatus('closed');
          // clear streaming interval
          if (streamIntervalRef.current) {
            clearInterval(streamIntervalRef.current as any);
            streamIntervalRef.current = null;
          }
          if (closed) return;
          reconnectAttempts.current += 1;
          const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts.current));
          setTimeout(() => openWs(), delay);
        };
      } catch (e) {
        setLastWsError(String(e));
        setWsStatus('closed');
        reconnectAttempts.current += 1;
        const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempts.current));
        setTimeout(() => openWs(), delay);
      }
    };

  openWs();

    return () => {
      isMountedRef.current = false;
      closed = true;
      try { ws.current && ws.current.close(); } catch (e) {}
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current as any);
        streamIntervalRef.current = null;
      }
    };
  }, []);

  // Garante que o streaming só funcione enquanto a tela está em foco
  useFocusEffect(
    React.useCallback(() => {
      // Ao focar, permite streaming
      isMountedRef.current = true;
      startStreamIfReady();
      // Ao desfocar, interrompe streaming
      return () => {
        isMountedRef.current = false;
        if (streamIntervalRef.current) {
          clearInterval(streamIntervalRef.current);
          streamIntervalRef.current = null;
        }
        if (ws.current) {
          try { ws.current.close(); } catch (e) {}
          ws.current = null;
        }
      };
    }, [])
  );

  const forceReconnect = () => {
    try {
      if (ws.current) {
        try { ws.current.close(); } catch (e) {}
        ws.current = null;
      }
      // small delay to let onclose handlers settle then create new socket
      setTimeout(() => {
        // using effect's openWs closure isn't directly accessible here; simplest is to toggle wsStatus to trigger effect
        setWsStatus('closed');
        setTimeout(() => setWsStatus('connecting'), 200);
      }, 200);
    } catch (e) {
      Alert.alert('Erro', String(e));
    }
  };

  if (hasPermission === null) return <View />;
  if (hasPermission === false) return <Text>Sem acesso à câmera</Text>;

  return (
    <View style={styles.container}>
      {CameraComponent ? (
        React.createElement(CameraComponent, {
          style: styles.camera,
          ref: cameraRef,
          ...(CameraNamespace?.CameraType ? { type: CameraNamespace.CameraType.front } : { type: 'front' }),
          cameraType: CameraNamespace?.CameraType ? CameraNamespace.CameraType.front : 'front',
          facingMode: 'user',
          facing: 'front',
          position: 'front',
          isFront: true,
          device: 'front',
        })
      ) : (
        <View style={[styles.camera, {alignItems: 'center', justifyContent: 'center'}]}>
          <Text>Camera indisponível</Text>
        </View>
      )}
      {/* overlay area: render detection boxes and status */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          viewLayoutRef.current = { width, height };
        }}
      >
        {faces.map((f, i) => {
          const fw = f.frameWidth || lastFrameSize.w || 1;
          const fh = f.frameHeight || lastFrameSize.h || 1;
          const vw = viewLayoutRef.current.width || 1;
          const vh = viewLayoutRef.current.height || 1;
          const safeFw = fw > 0 ? fw : 1;
          const safeFh = fh > 0 ? fh : 1;
          const scale = Math.min(vw / safeFw, vh / safeFh) || 1;
          const scaledFrameW = safeFw * scale;
          const scaledFrameH = safeFh * scale;
          const offsetX = (vw - scaledFrameW) / 2;
          const offsetY = (vh - scaledFrameH) / 2;

          const sq = f.square;
          let left = 0, top = 0, sizePx = 0;
          if (sq && typeof sq.size === 'number') {
            left = offsetX + (sq.x || 0) * scale;
            top = offsetY + (sq.y || 0) * scale;
            sizePx = (sq.size || 0) * scale;
          } else {
            const width = (f.w || 0) * scale;
            const height = (f.h || 0) * scale;
            left = offsetX + (f.x || 0) * scale;
            top = offsetY + (f.y || 0) * scale;
            sizePx = Math.max(width, height);
          }

          if (!Number.isFinite(left)) left = 0;
          if (!Number.isFinite(top)) top = 0;
          if (!Number.isFinite(sizePx) || sizePx <= 0) sizePx = Math.min(vw, vh) * 0.2;

          // Aplica espelhamento em relação ao centro da tela
          if (mirrorOverlay) {
            left = vw - (left + sizePx);
          }

          // LÓGICA DE CORES PARA RECONHECIMENTO (VERDE: Achou, VERMELHO: Desconhecido, AMARELO: Aguardando/Processando)
          let borderColor = 'yellow'; // Padrão: AMARELO (Identificando/Aguardando)
          const isKnown = f.name && f.name !== 'Desconhecido' && f.name !== 'Usuário desconhecido';
          const isUnknown = f.name === 'Desconhecido' || f.name === 'Usuário desconhecido';
          
          if (isKnown) {
              borderColor = 'lime'; // VERDE: Achou
          } else if (isUnknown) {
              borderColor = 'red'; // VERMELHO: Desconhecido
          } // Se não for known nem unknown, mantém o amarelo padrão.

          // Estilo para molduras de vértice
          const cornerSize = sizePx / 8; // Tamanho do canto (ex: 1/8 da largura da face)
          const cornerThickness = 4; // Espessura da borda

          return (
            <View key={i} style={{ position: 'absolute', left, top, width: sizePx, height: sizePx }}>
              {/* Canto Superior Esquerdo */}
              <View style={{
                position: 'absolute', left: 0, top: 0, width: cornerSize, height: cornerThickness, backgroundColor: borderColor
              }} />
              <View style={{
                position: 'absolute', left: 0, top: 0, width: cornerThickness, height: cornerSize, backgroundColor: borderColor
              }} />
              {/* Canto Superior Direito */}
              <View style={{
                position: 'absolute', right: 0, top: 0, width: cornerSize, height: cornerThickness, backgroundColor: borderColor
              }} />
              <View style={{
                position: 'absolute', right: 0, top: 0, width: cornerThickness, height: cornerSize, backgroundColor: borderColor
              }} />
              {/* Canto Inferior Esquerdo */}
              <View style={{
                position: 'absolute', left: 0, bottom: 0, width: cornerSize, height: cornerThickness, backgroundColor: borderColor
              }} />
              <View style={{
                position: 'absolute', left: 0, bottom: 0, width: cornerThickness, height: cornerSize, backgroundColor: borderColor
              }} />
              {/* Canto Inferior Direito */}
              <View style={{
                position: 'absolute', right: 0, bottom: 0, width: cornerSize, height: cornerThickness, backgroundColor: borderColor
              }} />
              <View style={{
                position: 'absolute', right: 0, bottom: 0, width: cornerThickness, height: cornerSize, backgroundColor: borderColor
              }} />

              {/* Label */}
              <View style={{ position: 'absolute', left: 0, top: -24, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4 }}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{f.name || 'Aguardando...'}</Text>
              </View>
            </View>
          );
        })}
        <View style={{ position: 'absolute', top: 20, left: 20 }}>
          <Text style={[styles.status, { fontSize: 16 }]}>{loading ? 'Processando...' : nome ? `Reconhecido: ${nome}` : 'Aguardando...'}</Text>
          <Text style={{ color: 'white', marginTop: 6 }}>{`WS: ${wsStatus} | Faces: ${faces.length} | RecognizerReady: ${recognizerReady}`}</Text>
          <Text style={{ color: 'white', marginTop: 6 }}>{`Frame: ${lastFrameSize.w}x${lastFrameSize.h} | LastWSerr: ${lastWsError ? lastWsError.substring(0, 120) : '-'}`}</Text>
          <View style={{ marginTop: 8, width: 220 }}>
            <Button title="Reconectar WS" onPress={() => { forceReconnect(); }} />
            <View style={{ height: 8 }} />
            <Button title="Mostrar erro WS" onPress={() => { Alert.alert('LastWSerr', lastWsError ? lastWsError : 'Nenhum erro registrado'); }} />
          </View>
        </View>
      </View>
    </View>
  );
};

export default ReconhecimentoScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#222',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    marginTop: 40,
  },
  status: {
    fontSize: 24,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 12,
    fontWeight: 'bold',
  },
});