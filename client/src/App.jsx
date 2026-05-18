import React, {useState} from 'react';
// Conectamos con tu pantalla principal
import { BrowserRouter } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import io from 'socket.io-client';
import Inicio from './components/Inicio'; 
import CrearPrivada from './components/CrearPrivada';
import Lobby from './components/Lobby';
import Mesa from './components/Mesa';
import PartidaPublica from './components/PartidaPublica';

// --- PARA EJECUTAR EN LOCAL ---
// --- PARA EJECUTAR EN LOCAL ---
// Detectamos si estamos en local (localhost) o en producción (dominio real)
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Si es local, forzamos el puerto 3000. Si es producción, dejamos undefined (usa el mismo dominio)
const URL = isLocal ? 'http://localhost:3000/' : undefined;

const socket = io(URL, {
  transports: ['websocket', 'polling'], // Importante para estabilidad
  autoConnect: true
});
// ------------------- */

/*/ --- PARA EJECUTAR EN SERVIDOR ---
const socket = io()
// ------------------- */

function App() {

  const [playerName, setPlayerName] = useState('');
  const [numMaxJugadores, setMaxJugadores] = useState(null);

  return (
    // Simplemente mostramos el componente Inicio
    
    <Routes>
      <Route path= "/" element = {<Inicio setPlayerName={setPlayerName} playerName={playerName} />}   />
      <Route path = "/crear_privada" element = {<CrearPrivada socket={socket} playerName={playerName} setMaxJugadores={setMaxJugadores} />}/>
      <Route path = "/lobby" element = {<Lobby />}/>
  
      <Route path="/mesa1/:id" element={<Mesa socket={socket} playerName={playerName} numMaxJugadores={numMaxJugadores} />} />
      <Route path = "/partida_publica" element = {<PartidaPublica socket={socket} playerName={playerName} setMaxJugadores={setMaxJugadores} />}/>

    </Routes>
  )
}

export default App;