const { exec } = require('child_process');

// Python 스크립트를 실행해서 PostgreSQL 쿼리
const pythonScript = `
import psycopg2
from psycopg2.extras import RealDictCursor
import json

# DB 연결 (채팅 서버와 동일한 설정)
conn = psycopg2.connect(
    host='192.168.0.173',
    port=3200,
    user='haniwon',
    password='1104',
    database='haniwon',
    cursor_factory=RealDictCursor
)

cur = conn.cursor()

print("=== chat_users ===")
cur.execute("SELECT id, portal_user_id, email, display_name, created_at FROM chat_users")
users = cur.fetchall()
for u in users:
    print(f"  {u['display_name']} (portal_user_id: {u['portal_user_id']}, id: {u['id']})")

print("\\n=== chat_channels ===")
cur.execute("SELECT id, name, type, created_by, created_at, deleted_at FROM chat_channels ORDER BY created_at")
channels = cur.fetchall()
for c in channels:
    deleted = " [DELETED]" if c['deleted_at'] else ""
    print(f"  {c['name']} (type: {c['type']}, id: {c['id']}){deleted}")

print("\\n=== chat_channel_members ===")
cur.execute("""
    SELECT cm.channel_id, ch.name as channel_name, cm.user_id, u.display_name, cm.role
    FROM chat_channel_members cm
    JOIN chat_channels ch ON cm.channel_id = ch.id
    JOIN chat_users u ON cm.user_id = u.id
    ORDER BY ch.name, u.display_name
""")
members = cur.fetchall()
for m in members:
    print(f"  {m['channel_name']} - {m['display_name']} ({m['role']})")

print("\\n=== chat_messages (recent 10) ===")
cur.execute("""
    SELECT m.id, m.content, u.display_name, ch.name as channel_name, m.created_at
    FROM chat_messages m
    LEFT JOIN chat_users u ON m.sender_id = u.id
    LEFT JOIN chat_channels ch ON m.channel_id = ch.id
    ORDER BY m.created_at DESC
    LIMIT 10
""")
messages = cur.fetchall()
for m in messages:
    content = m['content'][:50] + "..." if len(m['content']) > 50 else m['content']
    print(f"  [{m['channel_name']}] {m['display_name']}: {content}")

cur.close()
conn.close()
`;

exec(`python -c "${pythonScript.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`, (error, stdout, stderr) => {
    if (error) {
        console.error('Error:', error.message);
        return;
    }
    if (stderr) {
        console.error('Stderr:', stderr);
    }
    console.log(stdout);
});
