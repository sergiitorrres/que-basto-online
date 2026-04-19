import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Inicio.module.css';

const Inicio = ({ playerName, setPlayerName }) => {
  const navigate = useNavigate();

  const irACrearPrivada = () => {
    if (!playerName.trim()) {
      alert("Por favor, escribe tu nombre antes de entrar");
      return;
    }
    navigate('/crear_privada');
  };

  const irAPartidaPublica = () => {
    if (!playerName.trim()) {
      alert("Por favor, escribe tu nombre antes de entrar");
      return;
    }
    navigate('/partida_publica');
  };

  return (
    <div className={styles.pantalla}>
      {/* Contenedor del Pergamino */}
      <div className={styles.pergamino}>
        
        <h1 className={styles.titulo}>¡Que basto!</h1>
        
        <input 
          type="text" 
          placeholder="Tu Nombre de Jugador" 
          className={styles.inputNombre}
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxlength="12"
        />
        
        <div className={styles.botonesContainer}>
          <button className={styles.botonMadera} onClick={irAPartidaPublica}>
            Partida publica
          </button>
          
          <button className={styles.botonMadera} onClick={irACrearPrivada}>
            Partida privada
          </button>
          
        </div>

      </div>
    </div>
  );
};

export default Inicio;