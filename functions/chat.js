export async function onRequestPost(context) {
  const GEMINI_KEY = context.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "Falta la clave GEMINI_API_KEY en Cloudflare" }), { 
      status: 500, headers: { "Content-Type": "application/json" } 
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Error en el formato del mensaje" }), { status: 400 });
  }

  const history = body.history || [];

  // Usamos el modelo 1.5-flash-8b que es el más compatible para integraciones rápidas
  const MODEL_NAME = "gemini-1.5-flash-8b"; 
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_KEY}`;

  const systemInstruction = "Sos el asistente de Lucas Nazaro de @pecholibre. Hablás en vos rioplatense. Validás síntomas de opresión en el pecho como activación nerviosa y ofrecés calma. Si es oportuno, mencioná el protocolo de 7 minutos del ebook.";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: history.map(item => ({
          role: item.role === 'model' ? 'model' : 'user',
          parts: [{ text: item.parts[0].text }]
        })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
      })
    });

    const data = await response.json();

    if (data.error) {
      // Si Google da error, lo mostramos para saber qué pasa
      return new Response(JSON.stringify({ error: data.error.message }), { 
        status: 500, headers: { "Content-Type": "application/json" } 
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude procesar eso, ¿me repetís?";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Error de conexión: " + err.message }), { status: 500 });
  }
}
