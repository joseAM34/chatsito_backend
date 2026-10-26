# Tiempo real local

Instalar dependencias con `npm install` en ambos repositorios. Iniciar el backend
con `npm run start:dev` y el frontend con `npm run dev`.
El frontend debe usar `VITE_API_URL=http://localhost:3000/api`.

Socket.IO usa transporte WebSocket exclusivamente, en el mismo puerto del backend
y la ruta `/socket.io`. No es un endpoint WebSocket de protocolo puro: los clientes
y generadores de carga deben hablar el protocolo Socket.IO/Engine.IO.

El handshake recibe `auth.token` con el JWT del login. El servidor comprueba la
firma, vencimiento y existencia del usuario. Cada conexión entra únicamente en su
sala privada `user:<id>`; el cliente no puede elegir otras salas. Al vencer el JWT
se desconecta la sesión. Para volver a entrar debe autenticarse nuevamente.

Tras una escritura REST correcta, se emite `chat:changed` a los participantes
actuales: `{ conversationId, kind: 'message' | 'read' | 'conversation' }`.
Incluye texto, edición, reenvío, audio, lecturas y cambios de participantes.
Una lectura sin cambios no emite otro evento, evitando ciclos de notificación.

React consulta REST al recibir eventos, conectar, cambiar de conversación o volver
a una pestaña. Ya no consulta cada 3/5 segundos. Es una estrategia de notificación
e invalidación: no elimina las consultas asociadas a actividad. Al reconectar se
recarga la ventana reciente (50 mensajes por defecto), no todo el historial.

## Prueba manual

1. Abrir dos sesiones de navegador distintas con usuarios participantes del mismo chat.
2. Enviar, editar, reenviar texto y enviar audio: comprobar actualización sin recargar.
3. Verificar contadores y lecturas con el chat abierto y cerrado.
4. Desconectar un cliente, enviar mensajes y reconectarlo: comprobar sincronización.
5. En DevTools/Network, comprobar conexión WS y ausencia de peticiones periódicas
   durante reposo (los ping/pong del transporte son normales).
6. Un tercer usuario ajeno no debe recibir notificaciones de esa conversación.

Esta implementación es para una instancia del backend. Varias réplicas requieren
un adaptador compartido para distribuir eventos. Para desplegar, configurar el
origen permitido (actualmente localhost:5173), TLS y el proxy para WebSockets.
