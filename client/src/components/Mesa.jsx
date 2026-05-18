/* eslint-disable no-unused-vars */

import styles from './Mesa.module.css';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ESTADOS, ROLES } from '../constantes';
import { motion, AnimatePresence } from 'framer-motion';

const Mesa = ({playerName, socket, numMaxJugadores}) => {
  const navigate = useNavigate();
  const [misCartas,setMisCartas] = useState([]);
  const misCartasRef = useRef([]);

  const [rivales,setRivales] = useState([]);
  const [estado,setEstado] = useState(ESTADOS.LOBBY);
  const [turno,setTurno] = useState ();
  const [cartasMesa, setCartaMesa] = useState([]);
  const [miRol, setMiRol] = useState(ROLES.NEUTRO);
  const [misPuntos, setMisPuntos] = useState(0);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [jugadoresLista,setJugadoresLista] = useState([]);
  const [numeroJugadores,setNumeroJugadores] = useState()
  const [ultimoJugadorId, setUltimoJugadorId] = useState(null);
  const [showPlin,setShowPlin] = useState();
  const [ultimaJugada, setUltimaJugada] = useState([]);
  const [hacerBarrido, setHacerBarrido] = useState(false);
  const [maxJugadores, setMaxJugadores] = useState(numMaxJugadores || 6);
  const [esPrimero, setEsPrimero] = useState(false);

  const [rankingFinal, setRankingFinal] = useState([]);
  const [mostrarRankingFinal, setMostrarRankingFinal] = useState(false);

  const ultimoEvento = useRef(-1);
  const limpiandoMesaRef = useRef(false);
  const colaJugadasRef = useRef([]);   // Cola de jugadas pendientes
  const procesandoRef = useRef(false);

  useEffect(() => {
    misCartasRef.current = misCartas;
  }, [misCartas]);


  useEffect(() => {
    window.history.pushState(null, null, window.location.pathname);

    const handlePopState = (event) => {
      window.history.pushState(null, null, window.location.pathname);
      setMostrarModal(true);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!playerName) navigate('/');
    if (!socket) return;

    socket.emit("pedir_jugadores");

    socket.on("jugador_unido" , (data) => {
      const listaActualizada = data.jugadores;
      setJugadoresLista(listaActualizada);
      setNumeroJugadores(listaActualizada.length);
      setMaxJugadores(data.maxJ);
    })

    socket.on("ronda_iniciada",(data) =>{
      setMisCartas(data.misCartas);
      setUltimoJugadorId(null);
      let riv = [];
      let miPosicion = 0;
      for(miPosicion; miPosicion < data.jugadores.length; miPosicion++){
        if (data.jugadores[miPosicion].id === socket.id){
          break;
        }
      }
      let p;
      for(p = miPosicion + 1; p < data.jugadores.length; p++) {
        riv.push(data.jugadores[p])
      }
      for(p = 0; p < miPosicion; p++) {
        riv.push(data.jugadores[p])
      }
      setRivales(riv);
      setEstado(ESTADOS.JUGANDO);
    })

    socket.on("jugador_paso_notif", (data) => {
        return setRivales(prevRiv => 
          prevRiv.map(rival => 
            rival.id === data.jugadorId ? { ...rival, haPasado: true } : rival
        )
        );
      });

    socket.on("turno_jugador",(data) =>{
      setTurno(data.turno);
      setEsPrimero(data.esPrimero);
    })

    socket.on("error",(data)=>{
      //MODIFICAR PARA QUE SE MANDE EL TEXTO DE TODOS LOS FALLOS
      console.log(`Info error: ${data.mensaje}`);
      alert(`Error: ${data.mensaje}`);
    })
    
    socket.on("jugada_valida", (data) => {
      colaJugadasRef.current.push(data);
      procesarCola();
    });
  
    socket.on("jugador_termino", (data) => {
      setRivales((prev) =>
        prev.map((r) =>
          r.id === data.jugadorId ? { ...r, posicionFinal: data.posicion } : r
      )
    );
    });

    socket.on("fin_ronda", async (data) => {
      let miRolNuevo = ROLES.NEUTRO;

      data.ranking.forEach(entry => {
        setRivales(prev =>
          prev.map(r =>
            r.id === entry.jugadorId ? { ...r, rol: entry.rol, puntos: entry.ptos} : r
          )
        );

        if (entry.jugadorId === socket.id) {
          miRolNuevo = entry.rol;
          setMisPuntos(entry.ptos);
        }
      });

      setMiRol(miRolNuevo);

      await limpiarMesaAsync(0, true);
      procesarCola();
      resetHaPasado();
    }) 
    
    socket.on("mesa_limpia", async (data) => {
      await limpiarMesaAsync(data.idEvento);
      procesarCola();
      resetHaPasado();
    });


    // ======= INTERCAMBIOS =======

    socket.on("fase_intercambio", (data) => {
      setEstado(ESTADOS.INTERCAMBIO);
    }) 

    socket.on("pedir_cartas", (data) => {
      const cant = data.cantidad;
      const forzado = data.forzado;

      if(forzado) {
        setTimeout(() => {
          let cartasDonadas = [];

          const indexOros2 = misCartasRef.current.findIndex(c => c.id === "oros_2");

          if (indexOros2 !== -1) {
            const oros2 = misCartasRef.current[indexOros2];
            cartasDonadas.push(oros2);

            if (cant === 2) {
              const mejorRestante = misCartasRef.current.find(c => c.id !== "oros_2");
              if (mejorRestante) {
                cartasDonadas.push(mejorRestante);
              }
            }
          } else {
            cartasDonadas = misCartasRef.current.slice(0, cant);
          }

          socket.emit("dar_cartas", { cartas: [...cartasDonadas]});
          console.log("Cartas que dono: " + cartasDonadas.map(c => `${c.valor} de ${c.palo}`))
        }, 5000);
      }
    })

    socket.on("cartas_donadas", (data) => {
      const from = data.from; // Para hacer animacion en el futuro
      const nuevasCartas = data.cartas

      let idsCartasJugadas = []
      nuevasCartas.forEach(c => {
          idsCartasJugadas.push(c.id)
      })

      console.log("Me han donado: " + idsCartasJugadas);
      setMisCartas(prevCartas => {
        let newMano = [...prevCartas, ...nuevasCartas];
        newMano.sort((a, b) => b.fuerza - a.fuerza);
        return newMano;
      });
    })

    socket.on("cartas_donadas_confirmadas", (data) => {
      setMisCartas(prev =>
        prev.filter(c => !data.cartas.some(dc => dc.id === c.id))
      );
    });


    socket.on("fase_intercambio_finalizada", (data) => {
      setEstado(ESTADOS.JUGANDO);
      setSeleccionadas([]);
    })

    socket.on("plinRealizado",(data) => {
      setShowPlin(true)
      setTimeout(()=> setShowPlin(false),1200)
    })

    // === BOT ===

    socket.on("jugador_reemplazado", (data) => {
      setRivales(prevRiv =>
      prevRiv.map(r =>
        r.id === data.jugadorId
          ? { ...r, id: data.nuevoId, nombre: data.nombre }
          : r
        )
      );
    });

    // === Cierre Partida ===

    socket.on("partida_finalizada", (data) => {
      setRankingFinal(data.rankingFinal);
      setMostrarRankingFinal(true);
      setEstado(ESTADOS.FINALIZADA);
    })
    
    // ***********************************
    //  ======= CIERRE DE SOCKETS =======
    // ***********************************
    return () => { socket.off("ronda_iniciada") ;socket.off( "jugador_paso_notif"); socket.off("turno_jugador"); socket.off("error"); socket.off("jugada_valida");
      socket.off("jugador_termino"); socket.off("fin_ronda"); socket.off("fase_intercambio"); socket.off("pedir_cartas"); socket.off("dar_cartas"); 
      socket.off("cartas_donadas"); socket.off("fase_intercambio_finalizada"); socket.off("mesa_limpia"); socket.off("jugador_unido"); socket.off("intercambio_incorrecto");
      socket.off("jugador_reemplazado"); socket.off("partida_finalizada");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerName, navigate, socket]);

  // --- CÁLCULOS PARA EL RENDERIZADO ---
  // --- ESTO DEBE IR JUSTO ANTES DEL RETURN ---
  const totalConectados = jugadoresLista.length;
  const huecosDisponibles = Math.max(0, maxJugadores - totalConectados);
  // El array de sitios debe estar disponible para el mapeo
  const sitios = ['izq', 'arriba-izq', 'arriba-centro', 'arriba-der', 'der'];

  const resetHaPasado = () => {
    setRivales(prevRiv =>
      prevRiv.map(rival => ({ ...rival, haPasado: false }))
    );
  };


  const handlerconfirmarSalida = () => {
    // El usuario dijo SI
    socket.emit("salir_sala"); // Avisamos al server (rompe la partida)
    navigate('/'); // Nos vamos a la pantalla de inicio
  };

  const handlercancelarSalida = () => {
    // El usuario dijo NO
    setMostrarModal(false); // Ocultamos modal y seguimos jugando
  };

  const handlerPulsarSalir = () => {
    setMostrarModal(true); // Mostramos el modal de confirmación
  };

  const handlerIniciarPartida = () => {
    socket.emit("iniciar_partida",{});
  }
  const handlerPasarTurno = () => {
    socket.emit("jugador_paso",{});
  }

  const handlerLanzarCarta = (indices) => {
    const setIndices = new Set(indices);
    const cartasLanzadas = misCartasRef.current.filter((_, idx) => setIndices.has(idx));
    socket.emit("lanzar_cartas", {cartas: cartasLanzadas});
  }

  const toggleSelection = (index) =>{
    setSeleccionadas((prev) =>{
      if(prev.includes(index)){
        return prev.filter((i) => i !== index);
      }
      return [...prev,index];
    })
  }

  const handlerDarCartas = (indices) => {
    const setIndices = new Set(indices);
    const cartas_donadas = misCartasRef.current.filter((_, idx) => setIndices.has(idx));
    socket.emit("dar_cartas", { cartas: cartas_donadas });
  };

  // === Funciones para la gestion de jugadas ===

  const procesarCola = async () => {
    if (procesandoRef.current) return;
    if (colaJugadasRef.current.length === 0) return;

    procesandoRef.current = true;

    while (
      colaJugadasRef.current.length > 0 &&
      !limpiandoMesaRef.current
    ) {
      const siguiente = colaJugadasRef.current.shift();
      if(siguiente.idEvento > ultimoEvento.current) {
        ultimoEvento.current = siguiente.idEvento;
        await aplicarJugadaAsync(siguiente);
      }
    }

    procesandoRef.current = false;
  };


  const aplicarJugadaAsync = (data) => {
    return new Promise((resolve) => {

      setHacerBarrido(false);
      setCartaMesa(data.cartas);
      setUltimoJugadorId(data.jugadorId);

      if (data.jugadorId === socket.id) {
        setMisCartas(prev =>
          prev.filter(c => !data.cartas.find(dc => dc.id === c.id))
        );
        setSeleccionadas([]);
      } else {
        setRivales(prev =>
          prev.map(r =>
            r.id === data.jugadorId
              ? { ...r, numCartas: r.numCartas - data.cartas.length }
              : r
          )
        );
      }

      // Esperamos exactamente lo que dura la animación
      setTimeout(() => {
        resolve();
      }, 900); // ajusta al tiempo real de la animación
    });
  };

  const limpiarMesaAsync = (idEvento, bool) => {
    return new Promise((resolve) => {
      limpiandoMesaRef.current = true;

      setHacerBarrido(true);

      setTimeout(() => {
        if(idEvento > ultimoEvento.current) {
          setCartaMesa([]);
          setUltimoJugadorId(null);
          setUltimaJugada([]);
        } else if (bool) {
          setCartaMesa([]);
          setUltimoJugadorId(null);
          setUltimaJugada([]);
          colaJugadasRef.current = [];
        }

        limpiandoMesaRef.current = false;
        resolve();
      }, 1800);
    });
  };



  return (
    // CONTENEDOR PADRE
    <div className={styles['game-table']}
      data-fase="Lobby"
      data-jugadores="0" // Acuérdate de poner "data-"
      
    >
      {showPlin && <div className={styles.plinAnimacion}>¡PLIN!</div>}
      <button
        className={styles.boton_pasar} 
        type="button"
        onClick={handlerPulsarSalir}
        style={{
            position: 'absolute',  
            top: '20px',           
            left: '20px',          
            zIndex: 100,           
            backgroundColor: '#c62828', 
            color: 'white', 
            borderColor: '#8e0000',
            width: 'auto',         
            padding: '10px 20px'   
        }}
      >
        ⏏ SALIR
      </button>
      
      {mostrarModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCaja}>
            <h3>⚠ ATENCIÓN</h3>
            <p>¿Estás seguro de que quieres abandonar la partida?</p>
            <p style={{fontSize: '0.9rem', color: '#666'}}>Si sales, la partida finalizará para todos.</p>
            <div className={styles.modalBotones}>
              <button onClick={handlerconfirmarSalida} className={styles.btnSi}>SÍ, SALIR</button>
              <button onClick={handlercancelarSalida} className={styles.btnNo}>NO</button>
            </div>
          </div>
        </div>
      )}

      {mostrarRankingFinal && (
      <div className={styles.modalOverlay}>
        <div className={styles.modalCajaGrande}>
          <h2>🏆 Ranking Final</h2>

          <div className={styles.rankingLista}>
            {rankingFinal.map((jugador, index) => (
              <div
                key={jugador.id}
                className={`
                  ${styles.rankingFila}
                  ${jugador.id === socket.id ? styles.miFila : ''}
                `}
              >
                <span className={styles.posicion}>#{index + 1}</span>
                <span className={styles.nombre}>{jugador.nombre}</span>
                <span className={styles.puntos}> {jugador.puntos} pts</span>
              </div>
            ))}
          </div>

          <button
            className={styles.botonVolver}
            onClick={handlerconfirmarSalida}
          >
            Volver al inicio
          </button>
        </div>
      </div>
    )}


    {/* --- ZONA 1: OPONENTES (ARRIBA) --- */}
    {rivales.map((rival, index) => {
      const esSuTurno = rival.id === turno;
      const hizoUltimaJugada = rival.id === ultimoJugadorId;
      return (<div 
        key={rival.id} 
        className={`${styles.jugador_rival} ${styles[sitios[index]]} ${rival.haPasado ? styles.haPasado : ''} ${esSuTurno ? styles.borde_turno_verde : ''} ${hizoUltimaJugada ? styles.brillo_ultima_jugada : ''}`}
      >
        <span className={styles.nombre_rival}>{rival.nombre}</span>
        
        {/* AVATAR PEQUEÑO (FIJADO POR CSS) */}
        <img alt="avatar" className={styles.avatar} src={`/assets/images/${rival.rol}_rol.png`} />
        
        {/* BARRA DE TIEMPO RIVAL */}
        <div className={styles['timer-container']}>
          <div 
            className={styles['timer-bar']}
            style={{ 
              width: rival.id === turno ? '100%' : '0%', 
              transition: rival.id === turno ? 'width 15s linear' : 'none' 
            }}
          ></div>
        </div>

        <div className={styles.contadorDeCartas}>
          <span>{rival.numCartas} 🎴 — ({rival.puntos}) pts</span>
        </div>
      </div>
    )})}

      


      {/* --- ZONA 2: CENTRO DE LA MESA --- */}
    <div className={styles['table-center']}>
  
    {/* 1. LOBBY: Se renderiza de forma independiente para que no lo afecte el tamaño de la pila */}
    {estado === ESTADOS.LOBBY && (
      <div className={styles.contenedorLobby}>
        <h3>Esperando jugadores ({jugadoresLista.length}/{maxJugadores})</h3>
        <div className={styles.listaEspera}>
          {jugadoresLista.map(r => (
            <div key={r.id} className={styles.fichaEspera}>
              {r.nombre} {r.id === socket.id && " (Tú)"}
            </div>
          ))}
          {/* Pintamos los huecos vacíos */}
          {[...Array(huecosDisponibles)].map((_, i) => (
            <div key={`hueco-${i}`} className={styles.fichaHueco}>Esperando...</div>
          ))}
        </div>
      </div>
    )}

    {/* 2. PILA DE CARTAS: Ahora es un contenedor absoluto para no mover al Lobby ni a los botones */}
    {/* --- BUSCA TU ZONA DE LA PILA CENTRAL --- */}
  <div className={styles['pila-central']}>
    <AnimatePresence>
      {cartasMesa.map((carta, index) => (
        <motion.img
          key={`${carta.id}-${index}`}
          alt={carta.id}
          src={`/assets/images/cartas/${carta.id}.png`}
          className={styles.cartaMesaAcumulada}

          initial={{ y: 250, opacity: 0, scale: 0.6 }}
          animate={{
            y: 0,           // Las mantenemos en la misma línea horizontal
            x: index * 35,  // <--- CAMBIO CLAVE: Aumentamos la separación horizontal.
                            // Ajusta el valor '35' para más o menos separación.
            opacity: 1,
            scale: 1,
            rotate: 0       // Quitamos la rotación para que se vean alineadas
          }}
          exit={hacerBarrido ? { x: 800, opacity: 0 } : { opacity: 0, transition: { duration: 0 } }}

          transition={{ type: "spring", stiffness: 250, damping: 20 }}

          style={{ zIndex: index }}
        />
      ))}
    </AnimatePresence>
  </div>
    {/* 3. CONTROLES: Botones de acción */}
    <div className={styles.controles_centro}>
      {estado === ESTADOS.LOBBY && (
        <button
          className={styles.botonInicioPartida}
          type="button"
          onClick={handlerIniciarPartida}
          disabled={jugadoresLista[0]?.id !== socket?.id}
        > 
          INICIAR PARTIDA 
        </button>
      )}

    {estado === ESTADOS.JUGANDO && (
      <button
        className={styles.boton_pasar}
        type="button"
        onClick={handlerPasarTurno}
        disabled={turno !== socket?.id || esPrimero}
      >
        Pasar
      </button>
    )}
  </div>  
</div>

      {/* --- ZONA 3: TÚ (ABAJO) - LO QUE TE FALTABA --- */}
      <div className={`
      ${styles.zona_jugador} 
      ${socket?.id === turno ? styles.fondo_turno_activo : ''} {/* <-- NUEVA CLASE DE FONDO */}
      ${socket?.id === ultimoJugadorId ? styles.brillo_ultima_jugada : ''}
      `}>
         <div className={styles.mi_mano}>
          {misCartas.map((carta,posicion) =>
          <button
          key={carta.id}
          onClick= {() => toggleSelection(posicion)}
          className={`${styles.carta} ${seleccionadas.includes(posicion) ? styles.seleccionada : ''}`}
          
          >
            
          <img
          alt = {carta.id}
          src={`/assets/images/cartas/${carta.id}.png`}
          ></img>

          </button>

          
          )}
          
         </div>
          <button onClick = {() => handlerLanzarCarta(seleccionadas)}
            disabled ={turno !== socket?.id || seleccionadas.length === 0} 
            className={`${styles.boton_lanzar} ${seleccionadas.length > 0 ? styles.brillante : ''} ${turno === socket?.id ? styles.boton_turno_activo : ''}`}
          >    
          Lanzar
          </button>
          
          {estado === ESTADOS.INTERCAMBIO &&(
              <button
                onClick={() => handlerDarCartas(seleccionadas)}
                className={styles.boton_dar_cartas}
                disabled = {![ROLES.PRESIDENTE, ROLES.VICE_PRESIDENTE].includes(miRol)}>
                Dar cartas
              </button>
          )}
          


         <div className={styles.mi_perfil}>
            <img alt="mi avatar" src="/assets/images/avatar-de-usuario.png" />
            <img alt="icono rol" src={`/assets/images/${miRol}_rol.png`} />
            <span>{playerName} ({miRol || 'Sin Rol'}) — ({misPuntos}) pts</span>
         </div>
         <div className={styles['timer-container']}>
          <div 
            className={styles['timer-bar']}
            style={{ 
            width: socket?.id === turno ? '100%' : '0%', // Comprueba si es tu turno
            transition: socket?.id === turno ? 'width 15s linear' : 'none' 
          }}
          ></div>
            </div>
      </div>

    </div> 
  );
};

export default Mesa;