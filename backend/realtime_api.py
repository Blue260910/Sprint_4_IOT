# Importações de Bibliotecas
import cv2
import numpy as np
import pickle
import threading
import time
import os
import traceback
from pathlib import Path
from fastapi import FastAPI, WebSocket, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp  # Mantido, embora não utilizado ativamente
from io import BytesIO
from PIL import Image, ExifTags
from datetime import datetime
import re 
from fastapi.responses import HTMLResponse

# --- VARIÁVEIS DE CONFIGURAÇÃO DO SISTEMA ---
# Parâmetros usados para detecção (Haar Cascade) e pré-processamento de imagens.
PARAMS = {
    "DATABASE": "faces_database.pkl",           # Arquivo para armazenar a base de dados serializada
    "FACE_SIZE": (200, 200),                    # Tamanho padrão para redimensionar rostos antes do treino/reconhecimento
    "HAAR_SCALE_FACTOR": 1.1,                   # Fator de escala da cascata (ajusta detecção)
    "HAAR_MIN_NEIGHBORS": 7,                    # Mínimo de vizinhos para detecção de face
    "HAAR_MIN_SIZE": (80, 80),                  # Tamanho mínimo de rosto a ser detectado
    "HAAR_FLAGS": cv2.CASCADE_SCALE_IMAGE
}

# Controle de taxa (throttle) para salvar amostras de rostos desconhecidos no disco
UNKNOWN_SAVE_THROTTLE = 2.0
_last_unknown_save_ts_by_conn = {}

# Variável global que armazena os dados de treinamento em memória (faces e nomes)
# O código mais recente carrega estes dados diretamente das pastas 'saved_faces' e 'unknown_faces'.
known_faces = {"faces": [], "names": []}

# Carrega o classificador Haar Cascade para detecção inicial de rostos
face_cascade = cv2.CascadeClassifier("haarcascade_frontalface_default.xml")
if face_cascade.empty():
    raise RuntimeError("Erro ao carregar haarcascade_frontalface_default.xml")

# Inicialização da aplicação FastAPI
app = FastAPI()
# Configuração do CORS (Cross-Origin Resource Sharing) para permitir requisições de qualquer origem
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Variáveis globais para o reconhecedor LBPH e mapeamento de rótulos (ID para Nome)
recognizer_global = None
label_map_global = {}

# --- FUNÇÕES DE LÓGICA DE RECONHECIMENTO ---

# Função de diagnóstico inicial (mantida em inglês para referências técnicas)
try:
    has_face_module = hasattr(cv2, 'face')
    has_lbph = False
    if has_face_module:
        has_lbph = hasattr(cv2.face, 'LBPHFaceRecognizer_create')
    print(f"[SERVER] OpenCV {cv2.__version__} - face module: {has_face_module} - LBPH available: {has_lbph}")
except Exception as _:
    print("[SERVER] OpenCV diagnostic check failed")


def carregar_rostos_do_disco():
    """
    Carrega rostos conhecidos de 'saved_faces/' e rostos desconhecidos de 'unknown_faces/' 
    para o treinamento do modelo.
    """
    faces_list = []
    names_list = []
    
    # 1. Carregar rostos conhecidos (saved_faces)
    saved_dir = Path(os.getcwd()) / 'saved_faces'
    if saved_dir.exists():
        for fpath in saved_dir.glob("*.png"):
            # Extrai o nome do arquivo
            name_part = fpath.stem.split('_')
            name = name_part[0] if name_part else 'desconhecido'
            if name.lower() == 'unknown' or name.lower() == 'desconhecido':
                continue
            
            face_img = cv2.imread(str(fpath), cv2.IMREAD_GRAYSCALE)
            if face_img is not None and face_img.size > 0:
                faces_list.append(face_img)
                names_list.append(name)

    # 2. Carregar amostras de rostos DESCONHECIDOS (unknown_faces)
    unknown_dir = Path(os.getcwd()) / 'unknown_faces'
    if unknown_dir.exists():
        for fpath in unknown_dir.glob("*.png"):
            face_img = cv2.imread(str(fpath), cv2.IMREAD_GRAYSCALE)
            if face_img is not None and face_img.size > 0:
                # A classe para amostras negativas é "Desconhecido"
                faces_list.append(face_img)
                names_list.append("Desconhecido")
    
    global known_faces
    known_faces["faces"] = faces_list
    known_faces["names"] = names_list
    print(f"[BG] Carregados {len(faces_list)} rostos no total. Nomes únicos: {set(n for n in names_list if n != 'Desconhecido')}. Amostras desconhecidas: {names_list.count('Desconhecido')}")


def construir_reconhecedor():
    """
    Constrói ou reconstrói o reconhecedor LBPH a partir dos dados carregados do disco.
    Define recognizer_global e label_map_global.
    """
    global recognizer_global, label_map_global
    
    carregar_rostos_do_disco()

    label_map_global = {}
    recognizer_global = None
    if len(known_faces.get("faces", [])) == 0:
        return
    
    faces_list = []
    # Pré-processamento das imagens para treino
    for face in known_faces.get("faces", []):
        try:
            f = cv2.resize(face, PARAMS["FACE_SIZE"])
            f_proc = cv2.equalizeHist(f)
            f_proc = cv2.GaussianBlur(f_proc, (3, 3), 0)
            f_proc = cv2.normalize(f_proc, None, 0, 255, cv2.NORM_MINMAX)
            faces_list.append(f_proc)
        except Exception:
            continue
    
    # Mapeamento de nomes para IDs (rótulos) numéricos
    labels = []
    label_counter = 0
    for name in known_faces.get("names", []):
        if name not in label_map_global:
            label_map_global[name] = label_counter
            label_counter += 1
        labels.append(label_map_global[name])
    
    # Treinamento do modelo LBPH
    try:
        if hasattr(cv2, 'face') and hasattr(cv2.face, 'LBPHFaceRecognizer_create'):
            recognizer_global = cv2.face.LBPHFaceRecognizer_create()
            recognizer_global.train(faces_list, np.array(labels))
            print(f"[BG] Reconhecedor LBPH treinado com {len(faces_list)} amostras.")
        else:
            raise AttributeError('cv2.face.LBPHFaceRecognizer_create não encontrado.')
    except Exception as e:
        print(f"[WS] Reconhecedor indisponível ou falhou: {e}")
        recognizer_global = None


def construir_reconhecedor_async():
    """
    Inicia construir_reconhecedor em uma thread separada para não bloquear a API.
    """
    def _bg():
        try:
            print("[BG] Iniciando reconstrução do reconhecedor em segundo plano")
            construir_reconhecedor()
            print("[BG] Reconstrução concluída")
        except Exception as e:
            print(f"[BG] Falha na reconstrução: {e}")
            traceback.print_exc()
    t = threading.Thread(target=_bg, daemon=True)
    t.start()

# Chamada para construir o reconhecedor ao iniciar o servidor
construir_reconhecedor_async()


# --- ENDPOINTS DA API ---

@app.websocket("/ws/reconhecimento")
async def websocket_reconhecimento(websocket: WebSocket):
    """
    Endpoint WebSocket para reconhecimento facial em tempo real.
    Recebe quadros (frames) de imagem, detecta faces e retorna o nome reconhecido.
    """
    await websocket.accept()
    client = getattr(websocket, 'client', None)
    print(f"[WS] Conexão aceita de {client}")
    
    while True:
        try:
            # Recebe bytes da imagem (simulando um quadro de vídeo)
            data = await websocket.receive_bytes()
        except Exception as e:
            print(f"[WS] Falha ao receber ou conexão fechada: {e}")
            break
        try:
            
            # 1. Decodificação do Frame (Prioriza PIL para lidar com EXIF)
            frame = None
            try:
                # Tenta decodificar via PIL
                pil = Image.open(BytesIO(data))
                # Lógica para corrigir orientação EXIF (se a câmera frontal tiver metadados de rotação)
                try:
                    exif = pil._getexif()
                    if exif is not None:
                        # ... (lógica de rotação EXIF omitida para foco, mas estava no original)
                        pass
                except Exception:
                    pass
                rgb = pil.convert('RGB')
                frame = cv2.cvtColor(np.array(rgb), cv2.COLOR_RGB2BGR)
            except Exception:
                # Tenta decodificar via numpy/cv2 (fallback)
                npimg = np.frombuffer(data, np.uint8)
                frame = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

            if frame is None:
                await websocket.send_json({"error": "Frame inválido"})
                continue

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            frame_h, frame_w = frame.shape[:2]
            
            # 2. Detecção de Faces (Haar Cascade)
            faces_detected = face_cascade.detectMultiScale(
                gray,
                scaleFactor=PARAMS["HAAR_SCALE_FACTOR"],
                minNeighbors=PARAMS["HAAR_MIN_NEIGHBORS"],
                minSize=PARAMS["HAAR_MIN_SIZE"],
                flags=PARAMS["HAAR_FLAGS"]
            )
            results = []
            
            # 3. Processamento e Reconhecimento (LBPH) para cada face
            for (x, y, w, h) in faces_detected:
                try:
                    face_roi = gray[y:y+h, x:x+w]
                    face_roi = cv2.resize(face_roi, PARAMS["FACE_SIZE"])
                    name = "Desconhecido"
                    confidence = None
                    
                    if recognizer_global is not None and len(label_map_global) > 0:
                        # Pré-processamento da ROI para o LBPH
                        face_roi_proc = cv2.equalizeHist(face_roi)
                        face_roi_proc = cv2.GaussianBlur(face_roi_proc, (3, 3), 0)
                        face_roi_proc = cv2.normalize(face_roi_proc, None, 0, 255, cv2.NORM_MINMAX)
                        
                        # Previsão
                        label_pred, conf = recognizer_global.predict(face_roi_proc)
                        
                        # Limite de Confiança (Threshold)
                        if conf < 65 and label_pred in label_map_global.values(): 
                            name_found = [k for k, v in label_map_global.items() if v == label_pred][0]
                            if name_found != "Desconhecido":
                                name = name_found
                            
                            confidence = float(conf)
                        else:
                            confidence = float(conf)
                            
                    # Cálculo do Bounding Box (BBox) quadrado
                    pad = 0.25
                    side = int(max(w, h) * (1 + pad))
                    cx = int(x + w / 2)
                    cy = int(y + h / 2)
                    sq_x = max(0, cx - side // 2)
                    sq_y = max(0, cy - side // 2)
                    if sq_x + side > frame_w: sq_x = max(0, frame_w - side)
                    if sq_y + side > frame_h: sq_y = max(0, frame_h - side)

                    face_entry = {
                        "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                        "square": {"x": int(sq_x), "y": int(sq_y), "size": int(side)},
                        "name": name, "confidence": confidence,
                        "frameWidth": int(frame_w), "frameHeight": int(frame_h)
                    }

                    results.append(face_entry)

                    # Lógica de salvamento de amostras desconhecidas (throttled)
                    try:
                        if name == 'Desconhecido':
                            now_ts = time.time()
                            conn_key = id(websocket)
                            last_ts = _last_unknown_save_ts_by_conn.get(conn_key, 0.0)
                            if now_ts - last_ts >= UNKNOWN_SAVE_THROTTLE:
                                _last_unknown_save_ts_by_conn[conn_key] = now_ts
                                saved_dir = os.path.join(os.getcwd(), 'unknown_faces')
                                os.makedirs(saved_dir, exist_ok=True)
                                ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
                                fname = f"unknown_{ts}_{cx}_{cy}.png"
                                saved_path = os.path.join(saved_dir, fname)
                                try:
                                    # Lógica de recorte e salvamento (para amostras negativas)
                                    sx = max(0, cx - side//2)
                                    sy = max(0, cy - side//2)
                                    ex = min(frame_w, sx + side)
                                    ey = min(frame_h, sy + side)
                                    save_roi = gray[sy:ey, sx:ex]
                                    if save_roi is None or save_roi.size == 0: save_roi = face_roi
                                    save_roi = cv2.resize(save_roi, PARAMS['FACE_SIZE'])
                                    cv2.imwrite(saved_path, save_roi)
                                    print(f"[WS] Salvo rosto desconhecido em {saved_path}")
                                except Exception as e:
                                    print(f"[WS] Falha ao salvar rosto desconhecido: {e}")
                    except Exception:
                        pass
                except Exception:
                    print(f"[WS] Erro no processamento de face individual:\n{traceback.format_exc()}")
                    continue

            # 4. Envia resultados de volta ao cliente
            try:
                await websocket.send_json({"faces": results, "recognizer_ready": recognizer_global is not None, "frameWidth": frame_w, "frameHeight": frame_h})
            except Exception:
                print(f"[WS] Falha ao enviar JSON ao cliente:\n{traceback.format_exc()}")

        except Exception as e:
            # Lógica de tratamento de erro geral do WebSocket
            tb = traceback.format_exc()
            print(f"[WS] Erro de processamento para conexão {client}:\n{tb}")
            try:
                await websocket.send_json({"error": "server_error", "detail": "Erro interno no processamento de frame"})
            except Exception:
                pass
            continue


@app.post("/cadastrar")
async def cadastrar_rosto_api(nome: str = Form(...), imagem: UploadFile = File(...)):
    """
    Endpoint HTTP POST para cadastrar um novo rosto na base de dados.
    Recebe o nome e a imagem capturada.
    """
    print(f"[HTTP] /cadastrar chamado para nome={nome}")
    
    # 1. Pré-verificação de nome duplicado (simples)
    if nome in known_faces.get('names', []):
        name_exists_in_samples = any(n == nome for n in known_faces['names'])
        if name_exists_in_samples:
             return {"success": False, "msg": "Usuário já cadastrado.", "exists": True}

    img_bytes = await imagem.read()
    
    # 2. Decodificação e Detecção de Face na Imagem enviada
    frame = None
    try:
        # Lógica de decodificação da imagem (omite detalhes de EXIF/PIL, mantendo a estrutura)
        pil = Image.open(BytesIO(img_bytes)).convert('RGB')
        frame = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    except Exception:
        return {"success": False, "msg": "Imagem inválida."}
        
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=PARAMS["HAAR_SCALE_FACTOR"],
        minNeighbors=PARAMS["HAAR_MIN_NEIGHBORS"],
        minSize=PARAMS["HAAR_MIN_SIZE"],
        flags=PARAMS["HAAR_FLAGS"]
    )
    if len(faces) == 0:
        return {"success": False, "msg": "Nenhum rosto detectado."}
    
    # 3. Verificação de Duplicidade (Reconhecimento do rosto atual)
    if recognizer_global is not None:
        (x, y, w, h) = faces[0]
        face_roi = cv2.resize(gray[y:y+h, x:x+w], PARAMS["FACE_SIZE"])
        
        face_roi_proc = cv2.equalizeHist(face_roi)
        face_roi_proc = cv2.GaussianBlur(face_roi_proc, (3, 3), 0)
        face_roi_proc = cv2.normalize(face_roi_proc, None, 0, 255, cv2.NORM_MINMAX)
        label_pred, conf = recognizer_global.predict(face_roi_proc)

        if conf < 65 and label_pred in label_map_global.values():
            name_found = [k for k, v in label_map_global.items() if v == label_pred][0]
            if name_found != "Desconhecido":
                 return {"success": False, "msg": f"Este rosto pertence a {name_found} e já está cadastrado.", "exists": True, "duplicate_name": name_found}


    # 4. Salvar o Novo Rosto
    (x, y, w, h) = faces[0]
    rosto = cv2.resize(gray[y:y+h, x:x+w], PARAMS["FACE_SIZE"])
    
    try:
        saved_dir = os.path.join(os.getcwd(), 'saved_faces')
        os.makedirs(saved_dir, exist_ok=True)
        timestamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
        fname = f"{nome}_{timestamp}.png"
        saved_path = os.path.join(saved_dir, fname)
        # Log do shape e tipo do objeto rosto
        try:
            print(f"[DEBUG] Objeto rosto: type={type(rosto)}, shape={getattr(rosto, 'shape', None)}, dtype={getattr(rosto, 'dtype', None)}")
        except Exception as e:
            print(f"[DEBUG] Falha ao logar shape/dtype do rosto: {e}")
        result = cv2.imwrite(saved_path, rosto)
        print(f"[HTTP] Tentando salvar rosto em {saved_path} - resultado: {result}")
        if not result:
            print(f"[HTTP] Falha ao salvar arquivo de rosto: cv2.imwrite retornou False")
        else:
            # Confirma se o arquivo existe e tem tamanho
            if os.path.exists(saved_path):
                size = os.path.getsize(saved_path)
                print(f"[HTTP] Arquivo salvo: {saved_path} (tamanho: {size} bytes)")
            else:
                print(f"[HTTP] Arquivo não encontrado após salvar: {saved_path}")
    except Exception as e:
        print(f"[HTTP] Falha ao salvar arquivo de rosto: {e}")
    
    print(f"[HTTP] Rosto salvo para {nome}; disparando reconstrução...")
    
    # 5. Retreinamento Assíncrono
    try:
        construir_reconhecedor_async()
        print("[HTTP] Reconstrução do reconhecedor disparada.")
    except Exception as e:
        print(f"[HTTP] Falha ao disparar reconstrução: {e}")
        
    return {"success": True, "msg": f"Rosto de {nome} cadastrado."}

@app.get("/camera", response_class=HTMLResponse)
def camera_page():
    return """
    <html>
      <body>
        <video id="video" autoplay></video>
        <script>
          navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
              document.getElementById('video').srcObject = stream;
            });
        </script>
      </body>
    </html>
    """

@app.post("/limpar-dados")
def limpar_dados_api():
    """Limpa a base de dados de rostos conhecidos e desconhecidos."""
    
    deleted_files = 0
    
    def delete_dir_contents(d):
        nonlocal deleted_files
        p = Path(os.getcwd()) / d
        if p.exists():
            for item in p.iterdir():
                if item.is_file():
                    item.unlink()
                    deleted_files += 1
    
    # 1. Limpa saved_faces
    delete_dir_contents('saved_faces')
    
    # 2. Limpa unknown_faces
    delete_dir_contents('unknown_faces')
    
    # 3. Apaga o arquivo pickle (se existir)
    db_path = Path(os.getcwd()) / PARAMS['DATABASE']
    if db_path.exists():
        db_path.unlink()
        deleted_files += 1

    # 4. Limpa a variável in-memory e zera o reconhecedor
    global known_faces, recognizer_global, label_map_global
    known_faces = {"faces": [], "names": []}
    recognizer_global = None
    label_map_global = {}
    
    print(f"[HTTP] Base de dados limpa. Arquivos deletados: {deleted_files}")
    
    # Dispara o retreinamento assíncrono (que resultará em um reconhecedor vazio)
    construir_reconhecedor_async() 
    
    return {"success": True, "msg": "Base de dados limpa com sucesso.", "deleted_files": deleted_files}


@app.get("/")
def raiz():
    """Retorna uma mensagem de boas-vindas na rota principal."""
    return {"msg": "API de reconhecimento facial em tempo real via WebSocket!"}


@app.get('/diagnostico')
def diagnostico():
    """Retorna informações de diagnóstico sobre o runtime e a base de dados."""
    try:
        # Lógica de diagnóstico (mantida em inglês para referências técnicas do CV2)
        cv_ver = cv2.__version__
        has_face = hasattr(cv2, 'face')
        has_lbph = has_face and hasattr(cv2.face, 'LBPHFaceRecognizer_create')
        
        saved_dir = os.path.join(os.getcwd(), 'saved_faces')
        unknown_dir = os.path.join(os.getcwd(), 'unknown_faces')
        saved_count = len([n for n in os.listdir(saved_dir)]) if os.path.exists(saved_dir) else 0
        unknown_count = len([n for n in os.listdir(unknown_dir)]) if os.path.exists(unknown_dir) else 0
        
        return {
            'ok': True,
            'cv2_version': cv_ver,
            'has_face_module': has_face,
            'has_lbph': has_lbph,
            'database_path': os.path.abspath(PARAMS['DATABASE']),
            'known_faces_count': len(known_faces.get('faces', [])),
            'saved_faces_count': saved_count,
            'unknown_faces_count': unknown_count,
        }
    except Exception as e:
        return {'ok': False, 'error': str(e)}
    
