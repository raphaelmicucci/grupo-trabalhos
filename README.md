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

### 2. Configurar o app

Abra `js/firebase-config.js` e substitua os valores de placeholder pelos dados do seu projeto:

```js
const firebaseConfig = {
  apiKey:            'SUA_API_KEY',
  authDomain:        'SEU_PROJETO_ID.firebaseapp.com',
  projectId:         'SEU_PROJETO_ID',
  storageBucket:     'SEU_PROJETO_ID.appspot.com',
  messagingSenderId: 'SEU_MESSAGING_SENDER_ID',
  appId:             'SEU_APP_ID'
};
```

As credenciais estão em: Firebase Console → ⚙ Configurações do projeto → Seus aplicativos → Aplicativo web.

### 3. Implantar regras de segurança

Instale o Firebase CLI e execute:

```bash
npm install -g firebase-tools
firebase login
firebase init       # selecione Firestore e Storage
firebase deploy --only firestore:rules,storage
```

### 4. Criar o primeiro usuário ADMIN

1. No Firebase Console → Authentication, crie um usuário com email e senha.
2. No Firestore, crie o documento `users/{uid}` com:

```json
{
  "uid": "<UID copiado do Authentication>",
  "name": "Admin",
  "email": "admin@exemplo.com",
  "role": "ADMIN",
  "mustChangePassword": false,
  "createdAt": "<timestamp atual>"
}
```

### 5. Criar usuários STUDENT

1. Firebase Console → Authentication → Adicionar usuário
2. Copie o UID gerado
3. No Firestore, crie `users/{uid}`:

```json
{
  "uid": "<UID>",
  "name": "Nome do Estudante",
  "email": "estudante@exemplo.com",
  "role": "STUDENT",
  "mustChangePassword": true,
  "createdAt": "<timestamp atual>"
}
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
│   ├── firebase-config.js # Inicialização do Firebase ← editar aqui
│   ├── auth-guard.js      # Proteção de rotas
│   ├── index.js           # Lógica do index.html
│   ├── login.js           # Lógica do login
│   ├── change-password.js # Lógica da troca de senha
│   ├── dashboard.js       # Lógica do dashboard
│   └── admin.js           # Lógica do painel admin
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