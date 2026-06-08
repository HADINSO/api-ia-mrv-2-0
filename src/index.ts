import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import blogRoutes from './routes/blog';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, _res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  >>> ${req.method} ${req.url}`);
  console.log(`  Hora: ${timestamp}`);
  console.log(`${'='.repeat(60)}`);
  if (req.method !== 'GET' && Object.keys(req.body).length > 0) {
    console.log(`  BODY RECIBIDO:`);
    console.log(`  ${JSON.stringify(req.body, null, 2).split('\n').join('\n  ')}`);
  }
  console.log(`-`.repeat(60));
  next();
});

app.use('/api/blog', blogRoutes);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const BASE_URL = 'https://openrouter.ai/api/v1';

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    console.log(`\n  --- CHAT: ENVIANDO A OPENROUTER ---`);
    console.log(`  Mensajes: ${messages.length}`);
    console.log(`  -> POST ${BASE_URL}/chat/completions`);

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`  <- Respuesta: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
    console.log(`  [!] Chat completado`);
    res.json(data);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/stream', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    console.log(`\n  --- CHAT STREAM: INICIANDO ---`);
    console.log(`  Mensajes: ${messages.length}`);
    console.log(`  -> POST ${BASE_URL}/chat/completions (stream: true)`);

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, messages, stream: true }),
    });

    console.log(`  <- Conexion SSE establecida, transmitiendo...`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!response.body) {
      console.error(`  [!] Error: No response body`);
      res.status(500).json({ error: 'No response body' });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const jsonStr = line.slice(6);
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices[0]?.delta?.content || '';
          if (content) {
            fullContent += content;
            res.write(content);
          }
        } catch { }
      }
    }

    console.log(`  <- Streaming completado: ${fullContent.length} caracteres`);
    console.log(`  [!] Stream finalizado`);
    res.end();
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/reasoning', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    console.log(`\n  --- CHAT REASONING: ENVIANDO CON RAZONAMIENTO ---`);
    console.log(`  Mensajes: ${messages.length}`);
    console.log(`  -> POST ${BASE_URL}/chat/completions (reasoning: enabled)`);

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        reasoning: { enabled: true },
      }),
    });

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`  <- Respuesta: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
    if (data.usage?.reasoning_tokens) {
      console.log(`  <- Tokens de razonamiento: ${data.usage.reasoning_tokens}`);
    }
    console.log(`  [!] Reasoning completado`);
    res.json(data);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chat/continue', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    console.log(`\n  --- CHAT CONTINUE: CONTINUANDO CONVERSACION ---`);
    console.log(`  Mensajes en historial: ${messages.length}`);
    console.log(`  -> POST ${BASE_URL}/chat/completions`);

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`  <- Respuesta: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
    console.log(`  [!] Continuacion completada`);
    res.json(data);
  } catch (error: any) {
    console.error(`  [!] Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  SERVIDOR INICIADO`);
  console.log(`  Puerto: ${PORT}`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  OpenAI API Key: ${OPENROUTER_API_KEY ? 'Configurada' : 'FALTANTE'}`);
  console.log(`  Modelo: ${MODEL}`);
  console.log(`${'='.repeat(60)}\n`);
});
