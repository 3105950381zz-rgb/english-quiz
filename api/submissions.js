const GIST_ID = '302185c217cbabba728a38b948b9c34e';
const GIST_FILENAME = 'english-quiz-data.json';
const GH_TOKEN = process.env.GH_TOKEN;

async function readGist() {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`);
  const data = await res.json();
  const content = data.files?.[GIST_FILENAME]?.content;
  return content ? JSON.parse(content) : { submissions: [] };
}

async function writeGist(data) {
  const body = JSON.stringify({
    files: {
      [GIST_FILENAME]: { content: JSON.stringify(data, null, 2) }
    }
  });
  await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const db = await readGist();
      db.submissions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return res.json(db.submissions);
    }

    if (req.method === 'POST') {
      const { name, score, answers, total } = req.body;
      if (!name || score === undefined) {
        return res.status(400).json({ error: 'name and score required' });
      }
      const db = await readGist();
      const sub = {
        id: db.submissions.length + 1,
        name, score, total: total || 15,
        answers: answers || [],
        paid: false,
        created_at: new Date().toISOString()
      };
      db.submissions.push(sub);
      await writeGist(db);
      return res.json({ success: true, data: sub });
    }

    if (req.method === 'PATCH') {
      const { id, paid } = req.body;
      const db = await readGist();
      const sub = db.submissions.find(s => s.id === id);
      if (!sub) return res.status(404).json({ error: 'not found' });
      if (paid !== undefined) sub.paid = paid;
      await writeGist(db);
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('API Error:', e);
    res.status(500).json({ error: e.message });
  }
}
