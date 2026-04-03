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

  // ✅ MODELO GEMINI 2.0 FLASH LITE (más cuota gratuita)
  const MODEL_NAME = "gemini-2.0-flash-lite";
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_KEY}`;

  // Manejar diferentes formatos de entrada
  let history = body.history || [];
  const mensajeDirecto = body.message || body.text || body.content;
  
  if (history.length === 0 && mensajeDirecto) {
    history = [{ role: "user", content: mensajeDirecto }];
  }
  
  if (history.length === 0) {
    return new Response(JSON.stringify({ 
      reply: "Hola, soy el asistente de Lucas. ¿Qué estás sintiendo en este momento? Contame..." 
    }), { headers: { "Content-Type": "application/json" } });
  }

  const systemInstruction = "Sos el asistente de Lucas Nazaro de @pecholibre. Hablás en vos rioplatense. Validás síntomas de opresión en el pecho como activación nerviosa y ofrecés calma. Si es oportuno, mencioná el protocolo de 7 minutos del ebook.";

  // Función para esperar
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Convertir historial al formato de Gemini
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

  // Sistema de reintentos para cuota
  let intentos = 0;
  const maxIntentos = 3;
  let tiempoEspera = 2000; // 2 segundos inicial

  while (intentos < maxIntentos) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: formattedContents,
          generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 400,
            topP: 0.95,
            topK: 40
          }
        })
      });

      const data = await response.json();

      // Si hay error de cuota, reintentar
      if (data.error && data.error.message && data.error.message.includes('Quota exceeded')) {
        // Extraer tiempo sugerido del error si existe
        const match = data.error.message.match(/retry in ([\d.]+)s/);
        if (match) {
          tiempoEspera = parseFloat(match[1]) * 1000;
        }
        
        intentos++;
        
        if (intentos < maxIntentos) {
          console.log(`Cuota excedida. Reintento ${intentos} de ${maxIntentos} en ${tiempoEspera/1000} segundos...`);
          await sleep(tiempoEspera);
          continue; // Reintentar
        } else {
          // Último intento fallido, devolver mensaje amigable
          return new Response(JSON.stringify({ 
            reply: "El servicio está muy solicitado en este momento. Por favor, esperá unos segundos y volvé a intentarlo. 🙏" 
          }), { headers: { "Content-Type": "application/json" } });
        }
      }

      // Si hay otro tipo de error
      if (data.error) {
        console.error("Error de Gemini:", data.error);
        return new Response(JSON.stringify({ error: data.error.message }), { 
          status: 500, headers: { "Content-Type": "application/json" } 
        });
      }

      // Éxito: obtener respuesta
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No pude procesar eso, ¿me repetís?";
      
      return new Response(JSON.stringify({ reply }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      console.error(`Error en intento ${intentos + 1}:`, err);
      intentos++;
      
      if (intentos >= maxIntentos) {
        return new Response(JSON.stringify({ 
          error: "Error de conexión. Por favor, intentá de nuevo en unos segundos." 
        }), { status: 500 });
      }
      
      await sleep(tiempoEspera);
    }
  }

  // Fallback por si todo falla
  return new Response(JSON.stringify({ 
    reply: "Hubo un problema técnico. Por favor, escribí tu mensaje nuevamente." 
  }), { headers: { "Content-Type": "application/json" } });
}
