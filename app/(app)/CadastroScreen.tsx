// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { View, Button, TextInput, Text, Alert, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as ExpoCamera from 'expo-camera';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';


// Host for backend (use the machine's Wi‑Fi IP so device can reach it)
// ATENÇÃO: SUBSTITUA 'X.X.X.X' PELO IP DE WI-FI REAL DA SUA MÁQUINA HOST
const BASE_HOST = '192.168.0.249:8000'; // Corrija aqui!

// Robustly pick a Camera component from the exported keys.
function pickCameraComponent(exportsObj: any) {
  if (!exportsObj) return null;
  // Common candidate names in priority order
  const candidates = ['Camera', 'camera', 'CameraView', 'cameraView', 'CameraModule', 'CameraComponent', 'ExpoCamera', 'View'];
  for (const name of candidates) {
    const v = exportsObj[name];
    if (!v) continue;
    // function or class component
    if (typeof v === 'function') return v;
    // object with a render method (class component instance or React.forwardRef result)
    if (typeof v === 'object' && v !== null && ('render' in v || 'prototype' in v)) return v;
  }

  // If there is a default export that's a component-like
  if (typeof (exportsObj as any).default === 'function') return (exportsObj as any).default;

  // As a fallback, if the exports object itself looks like a component (rare), use it
  if (typeof exportsObj === 'function') return exportsObj;
  if (typeof exportsObj === 'object' && exportsObj !== null && 'render' in exportsObj) return exportsObj;
  return null;
}

const CameraComponent: any = pickCameraComponent(ExpoCamera) || pickCameraComponent((ExpoCamera as any).default) || null;
// Keep ExpoCamera as the source for permission helpers
const CameraNamespace = ExpoCamera;

const CadastroScreen = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [nome, setNome] = useState('');
  const [debug, setDebug] = useState<string | null>(null);
  const cameraRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);
  const lastFrameSizeRef = useRef({ width: 0, height: 0 });
  const [faces, setFaces] = useState([]);
  const [wsStatus, setWsStatus] = useState('closed');
  const viewLayoutRef = useRef({ width: 0, height: 0 });
  const [mirrorOverlay, setMirrorOverlay] = useState(true);
  const streamIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [lastWsError, setLastWsError] = useState<string | null>(null);
  const [isCadastrado, setIsCadastrado] = useState(false);
  const [captureStatus, setCaptureStatus] = useState('Aguardando...'); // Estado para texto dinâmico
  const navigation = useNavigation();
  const route = useRoute();

  React.useEffect(() => {
    (async () => {
      const request = CameraNamespace.requestCameraPermissionsAsync || CameraNamespace.requestPermissionsAsync || (CameraNamespace as any).requestPermissionsAsync;
      const res = request ? await request() : { status: 'granted' };
      const status = res?.status ?? (res?.granted ? 'granted' : undefined) ?? 'granted';
      setHasPermission(status === 'granted');
    })();
  }, []);

  // WebSocket with reconnect/backoff
  useEffect(() => {
  const wsUrl = `ws://${BASE_HOST}/ws/reconhecimento`;
    const openWs = () => {
      try {
        setWsStatus('connecting');
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          setWsStatus('open');
          // Não inicia streaming automático de fotos
        };
        ws.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            const detections = data.faces || [];
            // prefer frame size reported by server (more accurate), fallback to lastFrameSize
            setFaces(detections.map(f => ({ ...f, frameWidth: f.frameWidth || lastFrameSizeRef.current.width, frameHeight: f.frameHeight || lastFrameSizeRef.current.height })));
            
            // Atualiza status de captura para feedback de posicionamento
            if (detections.length > 0) {
                 setCaptureStatus('Rosto detectado. Pronto para cadastrar.');
            } else {
                 setCaptureStatus('Mova o rosto para o centro da tela.');
            }
            if (isCadastrado) setCaptureStatus('Cadastrado com sucesso!');


          } catch (err) {
            // ignore parse errors
          }
        };
        ws.onerror = (err) => {
          console.warn('WS error', err);
          try { setLastWsError(String(err)); } catch (e) { setLastWsError('error'); }
        };
        ws.onclose = (ev) => {
          setWsStatus('closed');
          setFaces([]);
          // Não precisa limpar intervalos de streaming
          // schedule reconnect with backoff
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptsRef.current));
          setTimeout(() => openWs(), delay);
        };
      } catch (e) {
        setWsStatus('closed');
        // schedule reconnect
        reconnectAttemptsRef.current += 1;
        const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttemptsRef.current));
        setTimeout(() => openWs(), delay);
      }
    };

    openWs();

    return () => {
      try { wsRef.current && wsRef.current.close(); } catch (e) {}
    };
  }, []);

  const handleCaptureAndSend = async () => {
    if (!cameraRef.current) return;
    if (!nome) return Alert.alert('Informe um nome antes de cadastrar');
    if (loading) return; // prevent double submissions
    
    // Reset status visual
    setIsCadastrado(false); 
    setLoading(true);
    
    setCaptureStatus('Capturando foto...');
    try {
      // 1. Health-check (Timeout de 6 segundos)
      try {
        const c = new AbortController();
        const tid = setTimeout(() => c.abort(), 6000); 
        const diag = await fetch(`http://${BASE_HOST}/diagnostico`, { signal: c.signal });
        clearTimeout(tid);
        if (!diag || !diag.ok) {
          setLoading(false);
          setCaptureStatus('Servidor inacessível.');
          return Alert.alert('Servidor inacessível', 'Não foi possível contatar o servidor. Verifique o IP e se o backend está rodando.');
        }
      } catch (e) {
        setLoading(false);
        setCaptureStatus('Servidor inacessível.');
        return Alert.alert('Servidor inacessível', 'Não foi possível contatar o servidor. Verifique o IP e se o backend está rodando.');
      }

      // 2. Capture and Send
      const photo = await cameraRef.current.takePictureAsync({ base64: false });
      // Log para diagnóstico
      Alert.alert('Debug Foto', JSON.stringify(photo, null, 2));
      if (!photo || !photo.uri) {
        setLoading(false);
        setCaptureStatus('Falha ao capturar imagem.');
        return Alert.alert('Erro', 'Não foi possível capturar a imagem da câmera.');
      }
      const formData = new FormData();
      formData.append('imagem', {
        uri: photo.uri,
        type: photo.type || 'image/jpeg', // Garante tipo compatível
        name: 'face.jpg',
      });
      formData.append('nome', nome);

      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`http://${BASE_HOST}/cadastrar`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(id);

      let data = null;
      try { data = await res.json(); } catch (e) { data = { success: false, msg: `Resposta inválida do servidor (status ${res.status})` }; }

      // 3. Handle Response
      if (data?.success) {
        setIsCadastrado(true); // Sucesso: Mudar a moldura para verde
        setCaptureStatus('Cadastrado com sucesso!');
        Alert.alert('Sucesso', data.msg || 'Cadastrado');
        if (wsRef.current) {
          try { wsRef.current.close(); } catch (e) {}
          wsRef.current = null;
        }
        navigation.navigate('Home');
      } else {
        if (data?.exists) {
          setCaptureStatus(`Falha: Rosto já é ${data.duplicate_name || 'conhecido'}.`);
          Alert.alert('Falha no Cadastro', `Usuário já cadastrado como ${data.duplicate_name || 'outro usuário'}.`);
        } else {
          setCaptureStatus('Falha no cadastro. Nenhuma face detectada na captura.');
          Alert.alert('Falha', data.msg || data.error || `Erro ao cadastrar (status ${res.status})`);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setCaptureStatus('Requisição expirou.');
        Alert.alert('Erro', 'Requisição de cadastro expirou. Tente novamente.');
      } else {
        setCaptureStatus('Erro desconhecido.');
        Alert.alert('Erro ao cadastrar', String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) return <View />;
  if (hasPermission === false) return <Text>Sem acesso à câmera</Text>;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
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
        <View style={[styles.camera, styles.cameraPlaceholder]}>
          <Text>Camera indisponível no momento</Text>
        </View>
      )}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          viewLayoutRef.current = { width, height };
        }}
      >
        <View style={{ position: 'absolute', top: 20, width: '100%', alignItems: 'center' }}>
            <Text style={[styles.status, { color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8 }]}>{captureStatus}</Text>
        </View>
      </View>
      <View style={styles.formContainer}>
        <TextInput
          placeholder="Nome"
          value={nome}
          onChangeText={setNome}
          style={styles.input}
        />
        <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
          <Button title={loading ? 'Cadastrando...' : 'Cadastrar'} onPress={handleCaptureAndSend} disabled={loading} />
          <Button title="Permissão" onPress={async () => {
            const request = CameraNamespace.requestCameraPermissionsAsync || CameraNamespace.requestPermissionsAsync || (CameraNamespace as any).requestPermissionsAsync;
            if (!request) return Alert.alert('Nenhuma função de permissão disponível');
            const r = await request();
            Alert.alert('Resultado', JSON.stringify(r));
            setHasPermission((r?.status ?? (r?.granted ? 'granted' : undefined)) === 'granted');
          }} />
        </View>
        <View style={{ marginTop: 12, width: '100%' }}>
          <Button title="Testar servidor" onPress={async () => {
            try {
              const res = await fetch(`http://${BASE_HOST}/diagnostico`);
              const j = await res.json();
              Alert.alert('Diagnostics', JSON.stringify(j, null, 2));
            } catch (e) {
              Alert.alert('Erro', 'Não foi possível contatar o servidor: ' + String(e));
            }
          }} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default CadastroScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  camera: {
    flex: 2,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  label: {
    fontSize: 18,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    backgroundColor: '#eee',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  status: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 8,
    textAlign: 'center'
  }
});