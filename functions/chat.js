export async function onRequestPost(context) {
  const GEMINI_KEY = context.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return json({ error: "API Key no configurada" }, 500);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return json({ error: "Body invalido" }, 400);
  }

  const userMessage = body.message ? String(body.message).trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];

  if (!userMessage) {
    return json({ error: "Mensaje vacio" }, 400);
  }

  const systemText = "Sos el asistente de Lucas Nazaro de @pecholibre. Hablas en vos rioplatense, con calidez y sin tecnicismos. Tu rol es validar los sintomas de opresion en el pecho como activacion del sistema nervioso, no como enfermedad. Ofreces calma, respiracion y perspectiva. Cuando sea oportuno, menciona el protocolo de 7 minutos de Lucas. Nunca diagnosticas. Nunca alarmas. Maximo 3 oraciones por respuesta.";

  const contents = history.concat([
    { role: "user", parts: [{ text: userMessage }] }
  ]);

  const payload = {
    system_instruction: { parts: [{ text: systemText }] },
    contents: contents,
    generationConfig: { temperature: 0.75, maxOutputTokens: 400 }
  };

  try {
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await geminiRes.json();

    if (data.error) {
      return json({ error: data.error.message }, 500);
    }

    const reply =
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
        ? data.candidates[0].content.parts[0].text
        : "No pude procesar eso, me repetis?";

    return json({ reply: reply });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders())
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
