// ==========================================
// MOCK SUPABASE SERVICE — replaces real Supabase for demo purposes
// ==========================================

export const supabaseUrl = "https://mock.supabase.co";

// ---- Demo Users ----
const CURRENT_USER_ID = "user-me-001";

const USERS = [
  {
    id: CURRENT_USER_ID,
    fullname: "Алексей Петров",
    username: "alexey",
    email: "alexey@demo.com",
    bio: "Привет! Я использую BarsikChat!",
    avatar_url: "https://i.pravatar.cc/150?img=11",
  },
  {
    id: "user-002",
    fullname: "Мария Иванова",
    username: "maria",
    email: "maria@demo.com",
    bio: "Люблю общаться!",
    avatar_url: "https://i.pravatar.cc/150?img=5",
  },
  {
    id: "user-003",
    fullname: "Дмитрий Козлов",
    username: "dmitry",
    email: "dmitry@demo.com",
    bio: "Full-stack developer",
    avatar_url: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "user-004",
    fullname: "Анна Смирнова",
    username: "anna",
    email: "anna@demo.com",
    bio: "Дизайнер UI/UX",
    avatar_url: "https://i.pravatar.cc/150?img=9",
  },
  {
    id: "user-005",
    fullname: "Сергей Волков",
    username: "sergey",
    email: "sergey@demo.com",
    bio: "DevOps инженер",
    avatar_url: "https://i.pravatar.cc/150?img=15",
  },
  {
    id: "user-006",
    fullname: "Екатерина Новикова",
    username: "kate",
    email: "kate@demo.com",
    bio: "Product Manager",
    avatar_url: "https://i.pravatar.cc/150?img=20",
  },
];

// ---- Demo Conversations ----
const CONVERSATIONS = [
  {
    id: "conv-001",
    user1_id: CURRENT_USER_ID,
    user2_id: "user-002",
    last_message: {
      content: "Да, увидимся завтра! \u{1F44B}",
      created_at: "2026-02-26T10:30:00Z",
      sender_id: "user-002",
    },
    created_at: "2026-02-20T08:00:00Z",
  },
  {
    id: "conv-002",
    user1_id: CURRENT_USER_ID,
    user2_id: "user-003",
    last_message: {
      content: "Отправил pull request, посмотри когда будет время",
      created_at: "2026-02-26T09:15:00Z",
      sender_id: "user-003",
    },
    created_at: "2026-02-19T14:00:00Z",
  },
  {
    id: "conv-003",
    user1_id: "user-004",
    user2_id: CURRENT_USER_ID,
    last_message: {
      content: "Макеты готовы, загрузила в Figma \u2728",
      created_at: "2026-02-25T18:45:00Z",
      sender_id: "user-004",
    },
    created_at: "2026-02-18T10:00:00Z",
  },
  {
    id: "conv-004",
    user1_id: CURRENT_USER_ID,
    user2_id: "user-005",
    last_message: {
      content: "Деплой прошел успешно \u{1F680}",
      created_at: "2026-02-25T15:20:00Z",
      sender_id: CURRENT_USER_ID,
    },
    created_at: "2026-02-17T09:00:00Z",
  },
  {
    id: "conv-005",
    user1_id: "user-006",
    user2_id: CURRENT_USER_ID,
    last_message: {
      content: "Встреча перенесена на среду",
      created_at: "2026-02-24T12:00:00Z",
      sender_id: "user-006",
    },
    created_at: "2026-02-16T11:00:00Z",
  },
];

// ---- Demo Messages ----
const MESSAGES = {
  "conv-001": [
    { id: "m001", conversation_id: "conv-001", sender_id: CURRENT_USER_ID, content: "Привет, Мария! Как дела?", created_at: "2026-02-26T10:00:00Z" },
    { id: "m002", conversation_id: "conv-001", sender_id: "user-002", content: "Привет! Всё отлично, работаю над новым проектом", created_at: "2026-02-26T10:05:00Z" },
    { id: "m003", conversation_id: "conv-001", sender_id: CURRENT_USER_ID, content: "Круто! Что за проект?", created_at: "2026-02-26T10:10:00Z" },
    { id: "m004", conversation_id: "conv-001", sender_id: "user-002", content: "Мессенджер на React, очень интересная задача", created_at: "2026-02-26T10:15:00Z" },
    { id: "m005", conversation_id: "conv-001", sender_id: CURRENT_USER_ID, content: "Звучит здорово! Может, встретимся обсудить?", created_at: "2026-02-26T10:20:00Z" },
    { id: "m006", conversation_id: "conv-001", sender_id: "user-002", content: "Да, давай завтра в кафе?", created_at: "2026-02-26T10:25:00Z" },
    { id: "m007", conversation_id: "conv-001", sender_id: CURRENT_USER_ID, content: "Отлично, в 14:00 подойдёт?", created_at: "2026-02-26T10:27:00Z" },
    { id: "m008", conversation_id: "conv-001", sender_id: "user-002", content: "Да, увидимся завтра!", created_at: "2026-02-26T10:30:00Z" },
  ],
  "conv-002": [
    { id: "m010", conversation_id: "conv-002", sender_id: "user-003", content: "Привет! Ты видел новый баг в продакшене?", created_at: "2026-02-26T08:30:00Z" },
    { id: "m011", conversation_id: "conv-002", sender_id: CURRENT_USER_ID, content: "Да, уже смотрю. Похоже на проблему с WebSocket", created_at: "2026-02-26T08:35:00Z" },
    { id: "m012", conversation_id: "conv-002", sender_id: "user-003", content: "Нашёл причину — race condition при переподключении", created_at: "2026-02-26T08:50:00Z" },
    { id: "m013", conversation_id: "conv-002", sender_id: CURRENT_USER_ID, content: "Ага, нужно добавить debounce на reconnect", created_at: "2026-02-26T09:00:00Z" },
    { id: "m014", conversation_id: "conv-002", sender_id: "user-003", content: "Уже сделал, тестирую", created_at: "2026-02-26T09:05:00Z" },
    { id: "m015", conversation_id: "conv-002", sender_id: "user-003", content: "Отправил pull request, посмотри когда будет время", created_at: "2026-02-26T09:15:00Z" },
  ],
  "conv-003": [
    { id: "m020", conversation_id: "conv-003", sender_id: "user-004", content: "Привет! Начала работу над дизайном чата", created_at: "2026-02-25T14:00:00Z" },
    { id: "m021", conversation_id: "conv-003", sender_id: CURRENT_USER_ID, content: "Супер! Какие цвета выбрала?", created_at: "2026-02-25T14:10:00Z" },
    { id: "m022", conversation_id: "conv-003", sender_id: "user-004", content: "Фиолетовый основной + тёмная тема с нежными градиентами", created_at: "2026-02-25T14:15:00Z" },
    { id: "m023", conversation_id: "conv-003", sender_id: CURRENT_USER_ID, content: "Мне нравится! Покажи когда будет готово", created_at: "2026-02-25T14:20:00Z" },
    { id: "m024", conversation_id: "conv-003", sender_id: "user-004", content: "Макеты готовы, загрузила в Figma", created_at: "2026-02-25T18:45:00Z" },
  ],
  "conv-004": [
    { id: "m030", conversation_id: "conv-004", sender_id: CURRENT_USER_ID, content: "Сергей, можешь проверить CI/CD пайплайн?", created_at: "2026-02-25T14:00:00Z" },
    { id: "m031", conversation_id: "conv-004", sender_id: "user-005", content: "Уже смотрю. Билд падает на тестах", created_at: "2026-02-25T14:10:00Z" },
    { id: "m032", conversation_id: "conv-004", sender_id: CURRENT_USER_ID, content: "Странно, локально всё проходит", created_at: "2026-02-25T14:15:00Z" },
    { id: "m033", conversation_id: "conv-004", sender_id: "user-005", content: "Нашёл — не хватало env переменной в Docker", created_at: "2026-02-25T14:30:00Z" },
    { id: "m034", conversation_id: "conv-004", sender_id: CURRENT_USER_ID, content: "Добавил, запускаю заново", created_at: "2026-02-25T15:00:00Z" },
    { id: "m035", conversation_id: "conv-004", sender_id: CURRENT_USER_ID, content: "Деплой прошел успешно!", created_at: "2026-02-25T15:20:00Z" },
  ],
  "conv-005": [
    { id: "m040", conversation_id: "conv-005", sender_id: "user-006", content: "Привет! Нам нужно обсудить роадмап на Q2", created_at: "2026-02-24T10:00:00Z" },
    { id: "m041", conversation_id: "conv-005", sender_id: CURRENT_USER_ID, content: "Да, конечно. Когда удобно?", created_at: "2026-02-24T10:15:00Z" },
    { id: "m042", conversation_id: "conv-005", sender_id: "user-006", content: "Встреча перенесена на среду", created_at: "2026-02-24T12:00:00Z" },
  ],
};

// ---- Helper: build a chainable query builder ----
function createQueryBuilder(tableName) {
  let _filters = [];
  let _orderCol = null;
  let _orderAsc = true;
  let _rangeFrom = null;
  let _rangeTo = null;

  function getTableData() {
    switch (tableName) {
      case "users":
        return [...USERS];
      case "conversations":
        return [...CONVERSATIONS];
      case "messages": {
        const all = [];
        for (const msgs of Object.values(MESSAGES)) {
          all.push(...msgs);
        }
        return all;
      }
      case "usernames":
        return USERS.map((u) => ({ username: u.username }));
      default:
        return [];
    }
  }

  const builder = {
    select(_cols) {
      return builder;
    },
    eq(col, val) {
      _filters.push((row) => row[col] === val);
      return builder;
    },
    in(col, vals) {
      _filters.push((row) => vals.includes(row[col]));
      return builder;
    },
    or(expr) {
      const parts = expr.split(",");
      const subFilters = parts.map((part) => {
        const [col, op, ...rest] = part.split(".");
        const val = rest.join(".");
        if (op === "eq") {
          return (row) => row[col] === val;
        }
        if (op === "ilike") {
          const search = val.replace(/%/g, "").toLowerCase();
          return (row) => row[col] && row[col].toLowerCase().includes(search);
        }
        return () => true;
      });
      _filters.push((row) => subFilters.some((f) => f(row)));
      return builder;
    },
    order(col, opts = {}) {
      _orderCol = col;
      _orderAsc = opts.ascending !== false;
      return builder;
    },
    range(from, to) {
      _rangeFrom = from;
      _rangeTo = to;
      return builder;
    },
    then(resolve) {
      try {
        let data = getTableData();
        for (const f of _filters) {
          data = data.filter(f);
        }
        if (_orderCol) {
          const getVal = (row) => {
            if (_orderCol.includes("->")) {
              const [parent, child] = _orderCol.split("->");
              return row[parent]?.[child];
            }
            return row[_orderCol];
          };
          data.sort((a, b) => {
            const va = getVal(a) || "";
            const vb = getVal(b) || "";
            return _orderAsc
              ? String(va).localeCompare(String(vb))
              : String(vb).localeCompare(String(va));
          });
        }
        if (_rangeFrom !== null && _rangeTo !== null) {
          data = data.slice(_rangeFrom, _rangeTo + 1);
        }
        resolve({ data, error: null });
      } catch (err) {
        resolve({ data: null, error: { message: err.message } });
      }
    },
  };

  return builder;
}

// ---- Mock insert builder ----
function createInsertBuilder(tableName, rows) {
  const builder = {
    select() {
      return {
        then(resolve) {
          if (tableName === "conversations") {
            const newConv = {
              id: "conv-new-" + Date.now(),
              ...rows[0],
              user1_id: CURRENT_USER_ID,
              last_message: null,
              created_at: new Date().toISOString(),
            };
            CONVERSATIONS.push(newConv);
            resolve({ data: [newConv], error: null });
          } else if (tableName === "messages") {
            const msg = {
              ...rows[0],
              created_at: rows[0].created_at || new Date().toISOString(),
              sender_id: rows[0].sender_id || CURRENT_USER_ID,
            };
            const convId = msg.conversation_id;
            if (!MESSAGES[convId]) MESSAGES[convId] = [];
            MESSAGES[convId].push(msg);
            resolve({ data: [msg], error: null });
          } else {
            resolve({ data: rows, error: null });
          }
        },
      };
    },
    then(resolve) {
      resolve({ data: rows, error: null });
    },
  };
  return builder;
}

// ---- Mock update builder ----
function createUpdateBuilder(tableName, updates) {
  let _filters = [];

  const builder = {
    eq(col, val) {
      _filters.push((row) => row[col] === val);
      return builder;
    },
    then(resolve) {
      if (tableName === "conversations") {
        for (const conv of CONVERSATIONS) {
          if (_filters.every((f) => f(conv))) {
            Object.assign(conv, updates);
          }
        }
      }
      resolve({ error: null });
    },
  };
  return builder;
}

// ---- Mock Supabase client ----
const supabase = {
  auth: {
    async getSession() {
      return {
        data: {
          session: {
            user: {
              id: CURRENT_USER_ID,
              email: USERS[0].email,
              role: "authenticated",
              user_metadata: {
                fullname: USERS[0].fullname,
                username: USERS[0].username,
                bio: USERS[0].bio,
                avatar_url: USERS[0].avatar_url,
              },
            },
          },
        },
        error: null,
      };
    },

    async signInWithPassword({ email }) {
      return {
        data: {
          session: {
            user: {
              id: CURRENT_USER_ID,
              email,
              role: "authenticated",
              user_metadata: USERS[0],
            },
          },
        },
        error: null,
      };
    },

    async signUp({ email, options }) {
      return {
        data: {
          user: {
            id: CURRENT_USER_ID,
            email,
            role: "authenticated",
            user_metadata: options?.data || {},
          },
        },
        error: null,
      };
    },

    async signOut() {
      return { error: null };
    },

    async updateUser(updateData) {
      if (updateData.data) {
        Object.assign(USERS[0], updateData.data);
      }
      return {
        data: {
          user: {
            id: CURRENT_USER_ID,
            email: USERS[0].email,
            role: "authenticated",
            user_metadata: {
              fullname: USERS[0].fullname,
              username: USERS[0].username,
              bio: USERS[0].bio,
              avatar_url: USERS[0].avatar_url,
            },
          },
        },
        error: null,
      };
    },

    async resetPasswordForEmail() {
      return { error: null };
    },

    onAuthStateChange(callback) {
      setTimeout(() => {
        callback("SIGNED_IN", {
          user: {
            id: CURRENT_USER_ID,
            email: USERS[0].email,
            role: "authenticated",
            user_metadata: USERS[0],
          },
        });
      }, 0);
      return {
        data: {
          subscription: { unsubscribe() {} },
        },
      };
    },
  },

  from(tableName) {
    return {
      select(cols) {
        return createQueryBuilder(tableName).select(cols);
      },
      insert(rows) {
        return createInsertBuilder(tableName, rows);
      },
      update(updates) {
        return createUpdateBuilder(tableName, updates);
      },
    };
  },

  channel(_name) {
    const ch = {
      on() { return ch; },
      subscribe() { return ch; },
      unsubscribe() { return ch; },
    };
    return ch;
  },

  storage: {
    from(_bucket) {
      return {
        async upload() { return { error: null }; },
        async remove() { return { error: null }; },
      };
    },
  },
};

export default supabase;
