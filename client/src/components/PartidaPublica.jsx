import React, { useState, useEffect } from 'react';
import styles from './PartidaPublica.module.css';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

const PartidaPublica = ({ socket, playerName, setMaxJugadores}) => {
  const navigate = useNavigate();
  
  useEffect(() => {
      if (!playerName) navigate('/');
    }, [playerName, navigate]);
  
  const [salas, setSalas] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(0);
  var numMaxJugadores = 0;
  
  const configuraciones = [
    {id: 0, maxJugadores: 4, baraja48: false, label: '4 personas. - 40 Cartas'},
    {id: 1, maxJugadores: 4, baraja48: true, label: '4 personas. - 48 Cartas'},
    {id: 2, maxJugadores: 5, baraja48: false, label: '5 personas. - 40 Cartas'},
    {id: 3, maxJugadores: 6, baraja48: true, label: '6 personas. - 48 Cartas'},
  ]
  
  useEffect(() => {

    if (!socket) return;

    socket.emit('pedir_salas');

    socket.on('salas_publicas', (salas) => {
      setSalas(salas);
    });


    socket.on("connect", () => {
        socket.emit("pedir_salas");
    });


    socket.on("sala_asignada", (data) => {
        console.log("Me han asignado la sala:", data.salaId);
        navigate(`/mesa1/${data.salaId}`);
    });

    socket.on("jugador_unido", (data) => {
      console.log("¡Te has unido a la sala!", data);
      navigate(`/mesa1/${socket.salaId}`);
    });

    
    socket.on("error", (data) => {
    console.log("Info del error:", data);
    alert(`Error: ${data.mensaje}`);
    });

    return(() => {
      socket.off("jugador_unido");
      socket.off("error");
      socket.off("sala_asignada")
      socket.off('salas_publicas');
      socket.off("connect");
    });
  }, [socket, navigate]);
    
  const handleCrearPartida = () => {
    const config = configuraciones[selectedConfig]

    setMaxJugadores(config.maxJugadores);
    console.log("Creando sala publica:", config)

    socket.emit('crear_sala', { 
      nombre: playerName,
      privacidad: false,
      salaId: null, // null para que genere un ID
      config: {
        maxJugadores: config.maxJugadores,
        baraja48: config.baraja48
      } 
    });
  }

  const handleUnirsePartida = (salaIdSeleccionada, maxJ) => {
    if (!salaIdSeleccionada) return;
    setMaxJugadores(maxJ);
    console.log("Uniendose a sala existente:", salaIdSeleccionada)

    socket.emit('unirse_sala', { 
      nombre: playerName, 
      salaId: salaIdSeleccionada
    });
  }
  const handleVolver = () => {
    navigate('/');
  }


  return (
    <div className={styles.pantalla}>
      <div className={styles.contenedorPrincipal}>
        
        {/* --- LISTA SALAS PARTE IZQUIERDA --- */}
        <div className={styles.panelIzquierdo}>
          <h2 className={styles.tituloSeccion}>Salas Disponibles</h2>
          
          <div className={styles.listaScroll}>
            {salas.length === 0 ? (
              <p className={styles.noSalas}>No hay partidas públicas ahora mismo.</p>
            ) : (
              salas.map((sala) => (
                <div key={sala.id} className={styles.tarjetaSala}>
                  
                  {/* Info Jugadores */}
                  <div className={styles.infoJugadores}>
                    <span className={styles.labelJugadores}>Jugadores:</span>
                    <ul className={styles.listaNombres}>
                      {sala.jugadores.map((nombre, i) => (
                        <li key={i}>{nombre}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Info Estado y Botón */}
                  <div className={styles.infoEstado}>
                    <div className={styles.badgeInfo}>
                      <span>{sala.jugadores.length}/{sala.maxJugadores}</span>
                      <small>{sala.modo}</small>
                    </div>
                    <button 
                      className={styles.botonUnirse}
                      onClick={() => handleUnirsePartida(sala.id, sala.maxJugadores)} 
                      disabled={sala.jugadores.length >= sala.max}
                    >
                      {sala.jugadores.length >= sala.max ? 'LLENA' : 'UNIRSE'}
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

        {/* --- SEPARADOR CENTRAL --- */}
        <div className={styles.separadorVertical}></div>

        {/* --- CREAR SALA PARTE DERECHA --- */}
        <div className={styles.panelDerecho}>
          <h2 className={styles.tituloSeccion}>Crear Sala Pública</h2>
          
          <p className={styles.textoAyuda}>Elige las reglas de la mesa:</p>

          <div className={styles.gridConfig}>
            {configuraciones.map((opcion, index) => (
              <button
                key={index}
                className={`${styles.botonConfig} ${selectedConfig === index ? styles.seleccionado : ''}`}
                onClick={() => setSelectedConfig(index)}
              >
                {opcion.label}
              </button>
            ))}
          </div>

          <div className={styles.footerDerecho}>
            <button className={styles.botonCrear} onClick={handleCrearPartida}>
              Crear Sala
            </button>
          </div>
        </div>
        <button className={styles.botonVolver} onClick={handleVolver}>Volver</button>
      </div>
    </div>
  );
};

PartidaPublica.propTypes = {
  socket: PropTypes.object.isRequired,
  playerName: PropTypes.string.isRequired,
};

export default PartidaPublica;