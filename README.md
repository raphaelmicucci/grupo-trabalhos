# Atividades Acadêmicas

Sistema interno para acompanhamento de atividades e provas, com autenticação Firebase e hospedagem no GitHub Pages.

---

## Funcionalidades

| Requisito | Descrição |
|-----------|-----------|
| RF01 | Login obrigatório (email + senha) |
| RF02 | Troca obrigatória de senha no primeiro acesso |
| RF03 | Reset de senha por email |
| RF04 | Logout disponível |
| RF05 | Listagem personalizada por UID autenticado |
| RF06 | Filtros por disciplina, tipo e status |
| RF07 | Marcar atividade como concluída (com timestamp) |
| RF08 | Desmarcar atividade |
| RF09 | Aba de arquivadas com restauração |
| RF10 | CRUD de disciplinas (ADMIN) |
| RF11 | CRUD de atividades + upload de anexos até 10 MB (ADMIN) |
| RF12 | Gerenciar matrículas (ADMIN) |

---

## Configuração do Firebase

### 1. Criar projeto Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um novo projeto
3. Ative **Authentication → Email/senha**
4. Crie um banco **Firestore** (modo produção)
5. Crie um **Storage** bucket

### 2. Configurar secrets do repositório

As credenciais do Firebase **não ficam no código-fonte**. Elas são injetadas automaticamente pelo workflow de deploy via **GitHub Actions Secrets**.

Para configurar:

1. No GitHub, acesse **Settings → Secrets and variables → Actions → New repository secret**
2. Adicione os seguintes secrets (os valores estão em: Firebase Console → ⚙ Configurações do projeto → Seus aplicativos → Aplicativo web):

| Secret | Descrição |
|--------|-----------|
| `FIREBASE_API_KEY` | API Key do projeto Firebase |
| `FIREBASE_AUTH_DOMAIN` | Domínio de autenticação (ex: `projeto.firebaseapp.com`) |
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase |
| `FIREBASE_STORAGE_BUCKET` | Bucket do Storage (ex: `projeto.firebasestorage.app`) |
| `FIREBASE_MESSAGING_SENDER_ID` | ID do remetente de mensagens |
| `FIREBASE_APP_ID` | ID do aplicativo web |

A cada push na branch `main`, o workflow `.github/workflows/deploy.yml` substitui os tokens de placeholder (`__FIREBASE_API_KEY__` etc.) pelos valores dos secrets e publica no GitHub Pages.

### 3. Implantar regras de segurança

Instale o Firebase CLI e execute:

```bash
npm install -g firebase-tools
firebase login
firebase init       # selecione Firestore e Storage
firebase deploy --only firestore:rules,storage
```

### 4. Criar o primeiro usuário ADMIN

1. No Firebase Console → Authentication, crie um usuário:
   - **Email:** `admin@grupotrab.internal`
   - **Senha:** temporária de sua escolha
2. Copie o UID gerado.
3. No Firestore, crie o documento `users/{uid}` com:

```json
{
  "uid": "<UID copiado do Authentication>",
  "username": "admin",
  "name": "Admin",
  "role": "ADMIN",
  "mustChangePassword": false,
  "createdAt": "<timestamp atual>"
}
```

4. No Firestore, crie o documento `usernameLookup/admin` com:

```json
{ "email": "admin@grupotrab.internal" }
```

### 5. Criar usuários STUDENT

1. Firebase Console → Authentication → Adicionar usuário:
   - **Email:** `{username}@grupotrab.internal` (ex: `joao@grupotrab.internal`)
   - **Senha:** temporária
2. Copie o UID gerado.
3. No Firestore, crie `users/{uid}`:

```json
{
  "uid": "<UID>",
  "username": "joao",
  "name": "João Silva",
  "role": "STUDENT",
  "mustChangePassword": true,
  "createdAt": "<timestamp atual>"
}
```

4. No Firestore, crie `usernameLookup/joao`:

```json
{ "email": "joao@grupotrab.internal" }
```

O campo `mustChangePassword: true` força a troca de senha no primeiro acesso.

---

## Hospedagem (GitHub Pages)

1. Vá em **Settings → Pages** do repositório
2. Selecione a branch `main` e pasta raiz `/`
3. O site ficará disponível em `https://<usuario>.github.io/<repositorio>/`

---

## Estrutura de arquivos

```
├── index.html            # Redireciona conforme estado de autenticação
├── login.html            # Tela de login
├── change-password.html  # Troca obrigatória de senha
├── dashboard.html        # Dashboard do estudante
├── admin.html            # Painel administrativo
├── css/
│   └── style.css         # Estilos (minimalista brutalista)
├── js/
│   ├── firebase-config.js # Inicialização do Firebase (tokens substituídos no deploy)
│   ├── auth-guard.js      # Proteção de rotas
│   ├── index.js           # Lógica do index.html
│   ├── login.js           # Lógica do login
│   ├── change-password.js # Lógica da troca de senha
│   ├── dashboard.js       # Lógica do dashboard
│   └── admin.js           # Lógica do painel admin
├── .github/
│   └── workflows/
│       └── deploy.yml     # Deploy automático com injeção de secrets
├── firestore.rules        # Regras de segurança Firestore
├── storage.rules          # Regras de segurança Storage
└── firebase.json          # Config Firebase CLI
```

---

## Modelo de dados (Firestore)

| Coleção | Descrição |
|---------|-----------|
| `users` | Perfis dos usuários (uid, name, email, role, mustChangePassword) |
| `subjects` | Disciplinas (name, code, professor, weekday, semester) |
| `enrollments` | Matrículas estudante↔disciplina |
| `activities` | Atividades (title, type, dueDate, archived, attachments) |
| `activityStatus` | Status individual de conclusão por estudante |