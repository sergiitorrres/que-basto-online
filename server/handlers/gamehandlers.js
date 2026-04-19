// Logica de las cartas (barajar, validar turno, calcular ganador)
const { rooms } = require("../store");
const  { ROLES } = require("../game/constantes");

module.exports = (io, socket) => {

    socket.on("iniciar_partida", () => {
        const salaId = socket.data.salaId;
        const sala = rooms[salaId];
        console.log("Intentando iniciar partida1")
        if (!sala) return;

        sala.on("turno_de_bot", () => {
            ejecutarBot(io, sala, salaId);
        });


        const resultado = sala.iniciar_partida();


        if (resultado.error) {
            return socket.emit("error", { mensaje: resultado.error });
        }
        
        console.log("Intentando iniciar partida2")
        sala.jugadores.forEach(j => {
            if (!j.esBot) {
                const s = io.sockets.sockets.get(j.id);
                if(s) {
                    s.emit("ronda_iniciada", { 
                        misCartas: j.mano,
                        jugadores: sala.jugadores.map(p => ({
                            id: p.id, nombre: p.nombre, numCartas: p.mano.length, rol: p.rol, puntos: p.puntuacion
                        }))
                    });
                }
            }
        });
        console.log("Intentando iniciar partida3")
        io.to(salaId).emit("turno_jugador", { turno: resultado.turnoInicial, esPrimero: true });
        console.log(`Partida iniciada en ${salaId}`);

        ejecutarBot(io, sala, salaId)
    });

    socket.on("lanzar_cartas", (data, callback) => {
        const cartasJugadas = data.cartas
        const salaId = socket.data.salaId;
        const sala = rooms[salaId]

        lanzaCarta(io, sala, salaId, cartasJugadas, socket.id)
        
    });


    socket.on("jugador_paso", (data, callback) => {
        const salaId = socket.data.salaId;
        const sala = rooms[salaId]

        if(!sala || !sala.checkIfTurn(socket.id)) {
            return socket.emit("error", {mensaje: "No es tu turno"})
        }

        if(sala.checkFirstTurn()) {
            return socket.emit("error", {mensaje: "No puedes saktar en el primer turno"})
        }

        sala.iniciarTimer();
        accionPasar(salaId, sala, io, socket.id);

        
    });

    socket.on("dar_cartas", (data, callback) => {
        const cartas = data.cartas
        const salaId = socket.data.salaId
        const sala = rooms[salaId]

        //console.log("salaId:", socket.data.salaId);
        //console.log("rooms keys:", Object.keys(rooms));

        if (!sala) {
            console.log("Por alguna razón entra aquí XXXX");
            socket.emit("error", { mensaje: "Sala no encontrada o no válida" });
            return;
        }

        cambio(io, sala, salaId, cartas, socket.id);
    });

}

function cambio (io, sala, salaId, cartas, jugadorId){
    const info = sala.realizarIntercambio(jugadorId, cartas)
    if(!info.ok) {
        io.to(jugadorId).emit("error", {mensaje: info.error})
        return;
    }

    if(!info.j1esBot) {
        io.to(jugadorId).emit("cartas_donadas_confirmadas", {cartas: cartas});
    }

    if(info.interDone) {
        if(!info.j1esBot) {
            io.to(info.jugador1).emit("cartas_donadas", {cartas: info.cartasParaJ1, from: info.jugador2})
        }
        if(!info.j2esBot) {
            io.to(info.jugador2).emit("cartas_donadas", {cartas: info.cartasParaJ2, from: info.jugador1})
        }
    }

    if(info.faseTerminada) {
        io.to(salaId).emit("fase_intercambio_finalizada", {});
        const idTurno = sala.jugadores[sala.turnoActual].id;
        io.to(salaId).emit("turno_jugador", { turno: idTurno, esPrimero: true });

        ejecutarBot(io, sala, salaId)
        // Por si acaso
        sala.intercambiosPendientes = []
        sala.mapa = new Map()
    }
};


function lanzaCarta(io, sala, salaId, cartasJugadas, idJugador) {
    if(!sala || !sala.checkIfTurn(idJugador)) {
        return io.to(idJugador).emit("error", {mensaje: "No es tu turno"})
    }

    const mesa = sala.mesa
    const jugador = sala.jugadores.find(j => j.id === idJugador);

    if (jugador.haPasado) {
        return io.to(idJugador).emit("error", { mensaje: "Has pasado turno, debes esperar a que se limpie la mesa" });
    }

    if (cartasJugadas.length === 0) return;

    const esDosDeOros = (cartasJugadas.length === 1 && cartasJugadas[0].palo === 'oros' && cartasJugadas[0].valor === 2);
    let limpiaMesa = esDosDeOros;

    if(!limpiaMesa && mesa.cartasEnMesa.length > 0) {
        if (cartasJugadas.length !== mesa.cantidad) {
            return io.to(idJugador).emit("error", { mensaje: `Debes tirar ${mesa.cantidad} cartas` });
        }
        if (cartasJugadas[0].fuerza < mesa.fuerzaActual) {
            return io.to(idJugador).emit("error", { mensaje: "Tus cartas son muy bajas" });
        }
    }

    // Comprobar que todas tienen misma fuerza
    let f = cartasJugadas[0].fuerza
    if (!cartasJugadas.every(c => c.fuerza === f)) {
        return io.to(idJugador).emit("error", { mensaje: "Las cartas deben ser del mismo valor" });
    }
    
    let plin = (!limpiaMesa && mesa.cartasEnMesa.length > 0 && mesa.fuerzaActual === f);
    if(plin){
        io.to(salaId).emit("plinRealizado", { 
            jugadorId: idJugador, 
            cartas: cartasJugadas
        });
    }
    
    mesa.setFuerzaActual(f);
    mesa.setCartas(cartasJugadas);
    mesa.setCantidad(cartasJugadas.length);
    mesa.setUltimoJugador(jugador);
    
    let idsCartasJugadas = []
    cartasJugadas.forEach(c => {
        idsCartasJugadas.push(c.id)
    })
    
    jugador.mano = jugador.mano.filter(c => !idsCartasJugadas.includes(c.id));

    // Avisar a todos
    mesa.updateIdEventos();
    mesa.detenerTimer();
    io.to(salaId).emit("jugada_valida", { 
        jugadorId: idJugador, 
        cartas: cartasJugadas,
        idEvento: mesa.idEventos
    });

    // Si el jugador se queda sin cartas
    if (jugador.mano.length === 0) {
        sala.posiciones = (sala.posiciones || 0) + 1;
        jugador.posicionFinal = sala.posiciones;

        io.to(salaId).emit("jugador_termino", { 
            jugadorId: idJugador, 
            posicion: jugador.posicionFinal 
        });

        // Verificar si acaba la ronda
        const activos = sala.jugadores.filter(j => j.mano.length > 0);
        if (activos.length <= 1) {
            finalizarRonda(sala, io, salaId);
            return;
        }
        limpiaMesa = true;
    }

    // Si hay que limpiar mesa
    if (limpiaMesa) {
        mesa.reset();
        sala.jugadoresResetPass();
        plin = false;
        mesa.updateIdEventos();
        io.to(salaId).emit("mesa_limpia", { 
            motivo: esDosDeOros ? "2 de Oros" : "Jugador terminó",
            idEvento: mesa.idEventos
         });
        
        // Si tiro 2 de oros y sigue jugando, repite turno
        if (esDosDeOros && jugador.mano.length > 0) {
            io.to(salaId).emit("turno_jugador", { turno: jugador.id, esPrimero: limpiaMesa});

            ejecutarBot(io, sala, salaId)
            return;
        }
    }

    let nextJ = sala.nextJugador();

    if (plin && nextJ) {
        nextJ = sala.nextJugador(); 
    }

    // Si da la vuelta completa y le toca al mismo que tiro la ultima carta -> Limpia mesa
    if (mesa.ultimoJugador && nextJ && nextJ.id === mesa.ultimoJugador.id) {
        mesa.reset();
        sala.jugadoresResetPass();
        mesa.updateIdEventos();
        io.to(salaId).emit("mesa_limpia", { 
            motivo: "Nadie ha tirado cartas",
            idEvento: mesa.idEventos
        });
    }

    if(nextJ) { 
        io.to(salaId).emit("turno_jugador", { turno: nextJ.id, esPrimero: limpiaMesa });
        
        ejecutarBot(io, sala, salaId)
    }
}

function ejecutarBot(io, sala, salaId) {
    const jugadaBot = sala.checkJuegaBot();
    if(jugadaBot) {
        setTimeout(() => {
            if(jugadaBot.pasa) {
                accionPasar(salaId, sala, io, jugadaBot.id);
            } else {
                lanzaCarta(io, sala, salaId, jugadaBot.jugada, jugadaBot.id)
            }
        }, 1500);
    }
}

function accionPasar (salaId, sala, io, idJugador){
    const jugador = sala.jugadores.find(j => j.id === idJugador);
        jugador.setHaPasado(true);
        io.to(salaId).emit("jugador_paso_notif", {jugadorId: idJugador})

        let nextJ = sala.nextJugador()
        const mesa = sala.mesa

        if(mesa.ultimoJugador && nextJ && nextJ.id === mesa.ultimoJugador.id) {
            mesa.reset()
            sala.jugadoresResetPass()
            mesa.updateIdEventos();
            io.to(salaId).emit("mesa_limpia", {
                motivo: "Nadie ha tirado cartas",
                idEvento: mesa.idEventos
            })
        }
        io.to(salaId).emit("turno_jugador", {turno: nextJ.id, esPrimero: false})
        mesa.detenerTimer();

        ejecutarBot(io, sala, salaId)
}

// Fin de ronda e inicio de la siguiente
function finalizarRonda(sala, io, salaId) {
    // Ordenar roles -> Los que terminaron (posicion > 0) primero. El que queda (-1) el último.
    const ranking = [...sala.jugadores].sort((a, b) => {
        if (a.posicionFinal > 0 && b.posicionFinal === -1) return -1;
        if (a.posicionFinal === -1 && b.posicionFinal > 0) return 1;
        return a.posicionFinal - b.posicionFinal;
    });

    if (ranking.length >= 4) {
        ranking.forEach(j => j.rol = ROLES.NEUTRO); // Primero todos a NEUTRO

        ranking[0].rol = ROLES.PRESIDENTE;
        ranking[1].rol = ROLES.VICE_PRESIDENTE;
        ranking[ranking.length - 2].rol = ROLES.VICE_CULO;
        ranking[ranking.length - 1].rol = ROLES.CULO;
    }

    const infoRanking = sala.getRankings();
    if(infoRanking.end) {
        terminarSala(io, sala, salaId)
        return;
    } else {
        io.to(salaId).emit("fin_ronda", { ranking: infoRanking.info });
    }

    setTimeout(() => {  // En 5 segundos empiza la siguiente ronda
        sala.empezarRondaNueva();
        sala.posiciones = 0;
        
        // Repartir cartas nuevas a todos
        sala.jugadores.forEach(j => {
             const socketJugador = io.sockets.sockets.get(j.id);
             if(socketJugador) {
                 socketJugador.emit("ronda_iniciada", { 
                     misCartas: j.mano,
                     jugadores: sala.jugadores.map(p => ({
                        id: p.id, nombre: p.nombre, numCartas: p.mano.length, rol: p.rol, puntos: p.puntuacion
                    }))
                 });
             }
        });
        

        let indiceTurno = sala.jugadores.findIndex(j => j.rol === ROLES.CULO);
        if (indiceTurno === -1) indiceTurno = 0;
        
        sala.turnoActual = indiceTurno;

        const datosIntercambio = sala.gestionarIntercambio();

        if (datosIntercambio.tipo === "intercambio_activo") {
            io.to(salaId).emit("fase_intercambio", {});
            datosIntercambio.instrucciones.forEach(instruccion => {
                if(instruccion.esBot) {
                    const cartas = sala.intercambioBot(instruccion.socketId, instruccion.data.rol);
                    setTimeout(() => {
                        cambio(io, sala, salaId, cartas, instruccion.socketId) // en este caso socketId no es un socket
                    }, 5000);
                } else {
                    const s = io.sockets.sockets.get(instruccion.socketId);
                    if (s) s.emit(instruccion.evento, instruccion.data);
                }
            });
        } else {
            const idTurno = sala.jugadores[sala.turnoActual].id;
            io.to(salaId).emit("turno_jugador", { turno: idTurno, esPrimero: true });

            ejecutarBot(io, sala, salaId)
        }
    }, 5000);
}

function terminarSala(io, sala, salaId) {
    ranking = sala.jugadores;
    ranking.sort((a, b) => b.puntuacion - a.puntuacion);
    io.to(salaId).emit("partida_finalizada", {
        rankingFinal: ranking.map(p => ({
            id: p.id, nombre: p.nombre, puntos: p.puntuacion
        }))
    })
}