export async function onRequestPost(context) {
  const GEMINI_KEY = context.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "Falta la clave en Cloudflare" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Error en el cuerpo del mensaje" }), { status: 400 });
  }

  const history = body.history || [];

  const systemInstruction = "Sos el asistente de Lucas Nazaro de @pecholibre. Hablás en vos rioplatense. Tu misión es validar el síntoma de opresión en el pecho como una activación del sistema nervioso (no un daño físico) y ofrecer calma. El protocolo de 7 minutos del ebook se menciona solo si el usuario busca una solución más profunda.";

  try {
    // Usamos el modelo estándar para evitar errores de 'not found'
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: history.map(item => ({
            role: item.role === 'model' ? 'model' : 'user',
            parts: [{ text: item.parts[0].text }]
          })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), { 
        status: 500, headers: { "Content-Type": "application/json" } 
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude procesar tu mensaje. ¿Me lo repetís?";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
