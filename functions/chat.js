export async function onRequestPost(context) {
  const GEMINI_KEY = context.env.GEMINI_API_KEY;

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ error: "Falta la clave GEMINI_API_KEY" }), { 
      status: 500, headers: { "Content-Type": "application/json" } 
    });
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Error en el formato del mensaje" }), { status: 400 });
  }

  // ACEPTAR DIFERENTES FORMATOS
  let history = body.history || [];
  const mensajeDirecto = body.message || body.text || body.content;
  
  // Si hay mensaje directo pero no historial, crearlo
  if (history.length === 0 && mensajeDirecto) {
    history = [{ role: "user", content: mensajeDirecto }];
  }
  
  // Si SIGUE vacío, responder mensaje de bienvenida
  if (history.length === 0) {
    return new Response(JSON.stringify({ 
      reply: "Hola, soy el asistente de Lucas. ¿Qué estás sintiendo en este momento? Contame..." 
    }), { headers: { "Content-Type": "application/json" } });
  }

  const MODEL_NAME = "gemini-1.5-flash-8b"; 
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_KEY}`;

  const systemInstruction = "Sos el asistente de Lucas Nazaro de @pecholibre. Hablás en vos rioplatense. Validás síntomas de opresión en el pecho como activación nerviosa y ofrecés calma. Si es oportuno, mencioná el protocolo de 7 minutos del ebook.";

  try {
    const formattedContents = history.map(item => {
      let text = "";
      if (typeof item === 'string') {
        text = item;
      } else if (item.content) {
        text = item.content;
      } else if (item.text) {
        text = item.text;
      } else if (item.parts?.[0]?.text) {
        text = item.parts[0].text;
      }
      
      let role = item.role || 'user';
      if (role === 'assistant') role = 'model';
      if (role !== 'user' && role !== 'model') role = 'user';
      
      return { role, parts: [{ text }] };
    });

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: formattedContents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
      })
    });

    const data = await response.json();

    if (data.error) {
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
