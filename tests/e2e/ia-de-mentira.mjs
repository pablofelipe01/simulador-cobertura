// © 2026 Pablo Felipe Acevedo, Melki y Giancarlo González Guerrero. Todos los derechos reservados.
// Autor: Giancarlo González Guerrero, para el Ingeniero Pablo Felipe Acevedo y Melki, con ayuda de inteligencia
// artificial. Prohibido su uso, copia, modificación o distribución sin licencia escrita de los titulares (Ley 23 de
// 1982, Decisión Andina 351 de 1993, Código Penal arts. 270 a 272). Ver LICENSE.

// Un servidor de voz en vivo de mentira para las pruebas (habla el mismo protocolo que Gemini Live por WebSocket):
// recibe la configuración, el audio y el texto; contesta con voz (un tono) y subtítulos; llama a las herramientas del
// simulador y usa lo que le devuelven. `decir(texto)` hace como si la persona lo hubiera dicho; `adios()` avisa que la
// conexión se va a cerrar (como Google a los 10 minutos) y `cortar()` la tumba de golpe. Sin internet.
import crypto from "node:crypto";
import http from "node:http";

/** Un trozo de voz de mentira: un tono de 0,35 s en PCM de 16 bits a 24 kHz, en base64. */
function tono(segundos = 0.35, f = 220) {
  const n = Math.round(24000 * segundos);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * f * i) / 24000) * 6000), i * 2);
  return b.toString("base64");
}

function marco(texto) {
  const datos = Buffer.from(texto);
  const n = datos.length;
  const cabeza = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 127]), (() => { const x = Buffer.alloc(8); x.writeBigUInt64BE(BigInt(n)); return x; })()]);
  return Buffer.concat([cabeza, datos]);
}

function cierre(codigo, motivo) {
  const m = Buffer.from(motivo);
  const cuerpo = Buffer.alloc(2 + m.length);
  cuerpo.writeUInt16BE(codigo, 0);
  m.copy(cuerpo, 2);
  return Buffer.concat([Buffer.from([0x88, cuerpo.length]), cuerpo]);
}

/** Lee los marcos que manda el navegador (siempre enmascarados). */
function leerMarcos(buf, alTexto, alCerrar) {
  let i = 0;
  while (buf.length - i >= 2) {
    const op = buf[i] & 0x0f;
    let n = buf[i + 1] & 0x7f;
    let p = i + 2;
    if (n === 126) {
      if (buf.length - p < 2) break;
      n = buf.readUInt16BE(p);
      p += 2;
    } else if (n === 127) {
      if (buf.length - p < 8) break;
      n = Number(buf.readBigUInt64BE(p));
      p += 8;
    }
    if (buf.length - p < 4 + n) break;
    const mascara = buf.subarray(p, p + 4);
    p += 4;
    const datos = Buffer.alloc(n);
    for (let k = 0; k < n; k++) datos[k] = buf[p + k] ^ mascara[k % 4];
    if (op === 1) alTexto(datos.toString("utf8"));
    else if (op === 8) alCerrar();
    i = p + n;
  }
  return buf.subarray(i);
}

const miles = (x) => Math.round(x).toLocaleString("es-CO");

/**
 * Arranca el servidor en un puerto libre. `rechazar`: si es un texto, cierra cada conexión con ese motivo (clave mala).
 */
export async function iniciarIADeMentira() {
  const estado = { conexiones: 0, setups: [], claves: [], textos: [], respuestas: [], audios: 0, narrados: 0, rechazar: null, cerradas: 0, abierta: null, manijas: 0, pausaNarrar: 0 };
  const servidor = http.createServer((_, r) => r.writeHead(404).end());
  // Las conexiones abiertas (al terminar se cierran todas: si no, el servidor no termina de cerrar)
  const sockets = new Set();
  servidor.on("upgrade", (req, socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    const url = new URL(req.url, "http://x");
    estado.claves.push(url.searchParams.get("key"));
    const k = crypto.createHash("sha1").update(`${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${k}\r\n\r\n`);
    estado.conexiones++;
    if (estado.rechazar) {
      // Lo que mande el navegador se lee y se bota (sin leerlo, el cierre del socket nunca termina)
      socket.on("data", () => {});
      socket.on("error", () => {});
      setTimeout(() => {
        socket.write(cierre(1008, estado.rechazar));
        socket.end();
        setTimeout(() => socket.destroy(), 1000);
      }, 60);
      return;
    }
    const enviar = (m) => !socket.destroyed && socket.write(marco(JSON.stringify(m)));
    // Como Google: tras cada turno, una manija para reanudar la conversación en otra conexión
    const manija = () => enviar({ sessionResumptionUpdate: { newHandle: `manija-${++estado.manijas}`, resumable: true } });
    const hablar = (texto, alTerminar, pausa = 0) => {
      enviar({ serverContent: { outputTranscription: { text: texto } } });
      enviar({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: tono() } }] } } });
      setTimeout(() => {
        enviar({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm;rate=24000", data: tono(0.25, 260) } }] } } });
        enviar({ serverContent: { turnComplete: true } });
        manija();
        alTerminar?.();
      }, 120 + pausa);
    };
    let llamada = 0;
    const pendientes = new Map();
    const herramienta = (name, args, alResponder) => {
      const id = `llamada-${++llamada}`;
      pendientes.set(id, alResponder);
      enviar({ toolCall: { functionCalls: [{ id, name, args }] } });
    };
    // El «cerebro» de mentira: según lo que oye, contesta o le pide algo al simulador
    const atender = (texto) => {
      estado.textos.push(texto);
      if (/^\(El usuario te acaba de llamar/.test(texto)) return hablar("Hola, señor. Soy Melki con inteligencia artificial. ¿En qué le ayudo?");
      if (/^\(Capítulo de la presentación/.test(texto)) {
        estado.narrados++;
        return hablar(`Les cuento: ${texto.replace(/^\([^)]*\)\s*/, "").slice(0, 70)}`, null, estado.pausaNarrar);
      }
      if (/adi[oó]s|eso es todo/i.test(texto)) return hablar("Con gusto, señor. Hasta luego.", () => herramienta("terminar_conversacion", {}, () => {}));
      if (/cu[aá]nto cuesta/i.test(texto))
        return herramienta("estado_simulador", {}, (r) => {
          const c = r.estado?.costos;
          hablar(c ? `La red cuesta ${miles(c.inversionTotal)} pesos de inversión y ${miles(c.operacionMes)} pesos al mes de operación.` : "No encontré los costos.");
        });
      if (/pres[eé]nta|pitch|modelo de negocio/i.test(texto)) return herramienta("presentacion", { accion: "empezar" }, (r) => hablar(`Con gusto. ${r.resultado ?? ""}`.slice(0, 120)));
      if (/qu[eé] sabes de|trama/i.test(texto)) return herramienta("consultar_melki", { pregunta: texto }, (r) => hablar(String(r.respuesta ?? "").slice(0, 120)));
      if (/\b(pon|agrega|ub[ií]came|simula|prueba|sube|cambia|quita)\b/i.test(texto)) return herramienta("ejecutar_orden", { pedido: texto }, (r) => hablar(`Listo, señor. ${String(r.resultado ?? "").split(/(?<=\.)\s/)[0]}`));
      return hablar("Entendido, señor.");
    };
    estado.abierta = { atender, enviar, socket };
    let resto = Buffer.alloc(0);
    socket.on("data", (d) => {
      resto = leerMarcos(
        Buffer.concat([resto, d]),
        (t) => {
          let m;
          try {
            m = JSON.parse(t);
          } catch {
            return;
          }
          if (m.setup) {
            estado.setups.push(m.setup);
            setTimeout(() => {
              enviar({ setupComplete: {} });
              manija();
            }, 40);
          } else if (m.realtimeInput?.audio) estado.audios++;
          else if (m.realtimeInput?.text) atender(m.realtimeInput.text);
          else if (m.toolResponse) {
            for (const f of m.toolResponse.functionResponses ?? []) {
              estado.respuestas.push(f);
              const fn = pendientes.get(f.id);
              pendientes.delete(f.id);
              fn?.(f.response ?? {});
            }
          }
        },
        () => {
          estado.cerradas++;
          socket.end();
        },
      );
    });
    socket.on("close", () => {
      if (estado.abierta?.enviar === enviar) estado.abierta = null;
    });
    socket.on("error", () => {});
  });
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  const puerto = servidor.address().port;
  return {
    url: `ws://127.0.0.1:${puerto}/ws`,
    estado,
    /** Como si la persona lo dijera: llega lo que el modelo entendió y luego su respuesta. */
    decir(texto) {
      const a = estado.abierta;
      if (!a) return false;
      a.enviar({ serverContent: { inputTranscription: { text: texto } } });
      setTimeout(() => a.atender(texto), 80);
      return true;
    },
    /** La persona habla encima: el servidor avisa que interrumpió. */
    interrumpir() {
      estado.abierta?.enviar({ serverContent: { interrupted: true } });
    },
    /** Google avisa que va a cerrar esta conexión (lo hace a los 10 minutos). */
    adios(segundos = 5) {
      estado.abierta?.enviar({ goAway: { timeLeft: `${segundos}s` } });
    },
    /** La red se cae de golpe (sin cierre ordenado: el navegador ve el código 1006). */
    cortar() {
      estado.abierta?.socket.destroy();
    },
    cerrar: () => {
      for (const s of sockets) s.destroy();
      return new Promise((ok) => servidor.close(() => ok()));
    },
  };
}
