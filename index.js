// server/index.js
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
  res.send('Servidor IA activo');
});

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3001;app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});

if (!OPENAI_KEY) {
  console.warn('⚠️ OPENAI_API_KEY no encontrada en .env');
}

// endpoint para generar plan (rutina + comidas) con IA
app.post('/generate-plan', async (req, res) => {
  try {
    const userData = req.body; // recibe { edad, peso, estatura, objetivo, frecuencia, tipoCuerpo, metaKilos }

    // prompt: pedimos JSON estricto para fácil parseo
    const prompt = `
Eres un entrenador y nutricionista educativo. Recibe datos del usuario y genera UN JSON solo (sin texto extra) con:
{
  "rutina": [
    {"nombre":"", "descripcion":"", "tiempo_o_series":"", "imagen":"URL opcional"},
    ...
  ],
  "comidas": [
    {"nombre":"", "descripcion":"", "kcal": "aprox"}
  ],
  "tiempo_estimado_semanas": number,
  "nota": "texto corto de precaución"
}

Datos usuario: ${JSON.stringify(userData)}

Reglas:
- Entrega solo JSON válido.
- No das consejos médicos. Usa lenguaje educativo y seguro.
- Para imágenes, sugiere URLs públicas (puedes devolver campos vacíos si no conoces).
- Haz la rutina adecuada a objetivo (subir/bajar), frecuencia y nivel (principiante).
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // modelo estable; cambialo si quieres
        messages: [
          { role: 'system', content: 'Eres un asistente que responde en JSON estrictamente.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 700,
        temperature: 0.8,
      }),
    });

    const data = await response.json();

    const text = data?.choices?.[0]?.message?.content;
    if (!text) return res.status(500).json({ error: 'No response from AI' });

    // parseamos el JSON que devolvió la IA
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      // a veces IA agrega saltos; intentamos extraer el JSON con regex simple
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ error: 'AI returned invalid JSON', raw: text });
      }
    }

    // opcional: completar imágenes a partir de nombres (fallback)
    const imageMap = {
      'Curl de bíceps': 'https://i.imgur.com/5A8aXqQ.png',
      'Sentadilla': 'https://i.imgur.com/3v7U2mM.png',
      'Jumping Jacks': 'https://i.imgur.com/6z8w1bF.png',
      'Flexiones': 'https://i.imgur.com/H7e3b7K.png',
    };

    if (Array.isArray(parsed.rutina)) {
      parsed.rutina = parsed.rutina.map(item => ({
        ...item,
        imagen: item.imagen || imageMap[item.nombre] || null
      }));
    }

    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error', details: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
