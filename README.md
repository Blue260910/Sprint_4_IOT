# 🚀 Challenge XP App

Bem-vindo ao **Challenge XP App**! Este é um super app mobile desenvolvido com Expo + React Native, focado em experiência de onboarding, perfil de investidor, chat com IA (Google Gemini), integração com Supabase, autenticação, formulários dinâmicos e muito mais. Tudo com uma interface moderna, responsiva e cheia de animações! 

---

## 📑 Tabela de Conteúdos
- [Demonstração](#demonstração)
- [Funcionalidades](#funcionalidades)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Instalação e Execução](#instalação-e-execução)
- [Build e Publicação](#build-e-publicação)
- [Como Contribuir](#como-contribuir)
- [Licença](#licença)
- [Créditos](#créditos)

---
# 📌 Usuário de Teste

Este repositório conta com um usuário de teste já configurado para facilitar a demonstração da aplicação.  

## 🎥 Demonstração

> **Usuário para teste**  
📧 **Email:** `Professor@gmail.com`  
🔑 **Senha:** `SenhaForte12345`  

---

## ✨ Funcionalidades
- Autenticação de usuários (login, cadastro, onboarding)
- Formulário completo de perfil de investidor (dados pessoais, financeiros, preferências, termos)
- Chat inteligente com IA (Google Gemini) para dúvidas e recomendações
- Dashboard com resumo do perfil e recomendações
- Notificações, configurações e perfil do usuário
- Animações modernas (Lottie, Reanimated)
- Integração com Supabase para backend e autenticação
- Busca e cards de ações/ativos
- Interface responsiva e acessível
- **Cadastro facial:** Permite cadastrar o rosto do usuário via câmera, enviando a imagem para o backend.
- **Reconhecimento facial:** Detecta e reconhece rostos em tempo real, integrando com o backend Python.

---

## 🛠️ Tecnologias Utilizadas
- **React Native** (Expo)
- **TypeScript**
- **Expo Router**
- **Supabase** (auth e dados)
- **Google Gemini AI** (chat)
- **React Hook Form** + Zod (validação)
- **Lottie** (animações)
- **Lucide Icons**
- **AsyncStorage**
- **Reanimated**
- **Styled Components/Theme**

---

## 📁 Estrutura de Pastas
```
app/                # Rotas e telas principais
  (app)/            # Telas autenticadas (dashboard, chat, resumo, etc)
  (auth)/           # Telas de autenticação (login, cadastro, onboarding)
  form/             # Etapas do formulário de perfil
components/         # Componentes reutilizáveis (UI, Auth, etc)
contexts/           # Contextos globais (Auth, Form)
hooks/              # Hooks customizados
lib/                # Integrações (auth, supabase, gemini, tema, validação)
assets/             # Imagens, ícones, animações
backend/           # Backend Python (reconhecimento facial)
```

---

## ▶️ Instalação e Execução

1. **Clone o repositório:**
  ```bash
  git clone <url-do-repo>
  cd Challenge-xp-app
  ```
2. **Instale as dependências:**
  ```bash
  npm install
  # ou
  yarn
  ```
3. **Rode o app:**
  - **App Expo:**
    ```bash
    npx expo start
    ```
  - **Backend (na pasta backend):**
    ```bash
    py -3.10 -m uvicorn realtime_api:app --reload --host 0.0.0.0
    ```

4. **Abra no emulador ou Expo Go (Android/iOS)**

---

## 🏗️ Build e Publicação
  ```bash
  npm run build:web
  ```
  ```bash
  npm run android
  ```
  ```bash
  npm run ios
  ```

Veja a [documentação do Expo](https://docs.expo.dev/) para detalhes de build e publicação.


## 🧠 Backend: Reconhecimento Facial

O backend da aplicação é responsável pelo processamento e reconhecimento facial dos usuários. Ele foi desenvolvido em Python utilizando FastAPI e Uvicorn, e realiza as seguintes funções:

- Recebe imagens capturadas pelo app via API
- Detecta rostos usando o modelo Haar Cascade
- Realiza cadastro facial, salvando imagens e associando ao nome do usuário
- Faz reconhecimento facial em tempo real, retornando resultados para o app
- Gerencia pastas de faces conhecidas e desconhecidas

### Estrutura do backend

```
backend/
  realtime_api.py           # API principal (FastAPI)
  requirements.txt          # Dependências Python
  haarcascade_frontalface_default.xml # Modelo de detecção facial
  saved_faces/              # Imagens cadastradas
  unknown_faces/            # Imagens não reconhecidas
```

### Como rodar o backend

1. Instale as dependências:
  ```bash
  cd backend
  pip install -r requirements.txt
  ```
2. Inicie o servidor:
  ```bash
  py -3.10 -m uvicorn realtime_api:app --reload --host 0.0.0.0
  ```

O backend ficará disponível na porta 8000 por padrão. Certifique-se de que o IP configurado no app corresponde ao IP da máquina onde o backend está rodando.
## 🤝 Como Contribuir
1. Faça um fork do projeto
2. Crie uma branch: `git checkout -b minha-feature`
3. Commit suas alterações: `git commit -m 'feat: minha feature'`
4. Push na branch: `git push origin minha-feature`
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

---

## 🤺Integrantes
- Rm99667 Victor Aranda
- Rm98690 Julia Lins
- Rm99210 Luis Barreto
- Rm99148 André Lambert
- Rm99750 Felipe Cortez

## 👨‍💻 Créditos
- Design, código e ideias originais
- Powered by [Supabase](https://supabase.com/), [Expo](https://expo.dev/), [Google Gemini](https://ai.google.dev/)

---

> Dúvidas? Sugestões? Abra uma issue ou mande um PR!
