// Funciones para crear, unir y salir de salas

const { rooms } = require("../store");
const Sala = require("../game/sala");
const { ESTADOS } = require("../game/constantes");

const fs = require("fs");
const path = require("path");

const botNames = fs.readFileSync(
    path.join(__dirname, "botNames.txt"),
    "utf-8"
)
.split("\n")
.map(n => n.trim())
.filter(Boolean);

const obtenerSalasPublicas = () => {
    
    return Object.values(rooms)
    .filter((sala) => !sala.privacidad).map(sala => ({
        
        id: sala.id,
        privacidad: sala.privacidad,
        cantJugadores: sala.jugadores.length,
        maxJugadores: sala.maxJugadores,
        modo: sala.preferenciaBaraja48 ? "48 Cartas" : "40 Cartas",
        jugadores: sala.jugadores.map(j => j.nombre), // Solo nombres
        estado: sala.estado
    }))
};

function generarIdUnico(){
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id;
    let existe = true;

    while (existe) {
        id = '';
        for (let i = 0; i < 4; i++) {
            id += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }
        if (!rooms[id]) {
            existe = false;
        }
    }
    return id;
}

module.exports = (io, socket) => {

    socket.on("pedir_jugadores", () => {
        const salaId = socket.data.salaId;
        if (!salaId || !rooms[salaId]) return;

        socket.emit("jugador_unido", {
            jugadores: rooms[salaId].jugadores,
            maxJ: rooms[salaId].maxJugadores
        });
    });

    
    socket.on("pedir_salas", () => {
        socket.emit("salas_publicas", obtenerSalasPublicas());
    });
    
    socket.on("crear_sala", (data, callback) => {
        let { nombre, salaId, config,privacidad } = data;

        if (!nombre) {
            return socket.emit("error", { mensaje: "Falta el nombre del jugador" });
        }

        if (!salaId || salaId === "AUTO") {
            salaId = generarIdUnico(); 
        } else{
            if (rooms[salaId]){
                return socket.emit("error", { mensaje: "Sala ya existente, prueba con otro código" });
            }
        }

        rooms[salaId] = new Sala(salaId, config, privacidad, botNames);
        console.log(`Sala iniciada: ${salaId}`);
        
        const partida = rooms[salaId];

        partida.addJugador(socket.id, nombre)

        // Subscribe el socket a un canal
        socket.join(salaId)
        socket.data.salaId = salaId;

        socket.emit("sala_asignada", { salaId: salaId });

        // Avisa a todos incluyendome a mi
        io.to(salaId).emit("jugador_unido", {
            jugadores: partida.jugadores,
            maxJ: rooms[salaId].maxJugadores
        })
        console.log(`${nombre} se unió a ${salaId}`);
        
        io.emit("salas_publicas", obtenerSalasPublicas() );
    });
    
    socket.on("unirse_sala", (data, callback) => {
        let { nombre, salaId } = data;

        if (!nombre) {
            return socket.emit("error", { mensaje: "Falta el nombre del jugador" });
        }

        const partida = rooms[salaId];

        if (!partida) {
            return socket.emit("error", { mensaje: "Esa sala no existe" });
        }

        if (partida.estado !== "LOBBY") {
            return socket.emit("error", { mensaje: "La partida ya ha comenzado" });
        }

        if( partida.jugadores.length >= partida.maxJugadores){
            socket.emit("error", {mensaje : "La sala está llena"})
            return;
        }

        partida.addJugador(socket.id, nombre)

        // Subscribe el socket a un canal
        socket.join(salaId)
        socket.data.salaId = salaId;

        socket.emit("sala_asignada", { salaId: salaId });

        // Avisa a todos incluyendome a mi
        io.to(salaId).emit("jugador_unido", {
            jugadores: partida.jugadores,
            maxJ: rooms[salaId].maxJugadores
        })
        console.log(`${nombre} se unió a ${salaId}`);

        io.emit("salas_publicas", obtenerSalasPublicas() );
    });
    
    socket.on("salir_sala", () => {
        salirDeSala(io, socket, "manual");
    });

    socket.on("disconnect", () => {
        salirDeSala(io, socket, "disconnect");
    });


    function salirDeSala(io, socket, motivo = "manual") {
        const salaId = socket.data.salaId;
        if (!salaId || !rooms[salaId]) return;

        const partida = rooms[salaId];

        // Evitar doble salida
        if (socket.data.yaSalio) return;
        socket.data.yaSalio = true;

        // Quitamos al jugador de la lista
        const jugadorIndex = partida.jugadores.findIndex(j => j.id === socket.id);
        if (jugadorIndex === -1) return;

        if (partida.estado === ESTADOS.LOBBY) {
            partida.jugadores.splice(jugadorIndex, 1);
            socket.leave(salaId);
            delete socket.data.salaId;

            io.to(salaId).emit("jugador_unido", {
                jugadores: partida.jugadores,
                maxJ: partida.maxJugadores
            });

            console.log(`Jugador salió del lobby de ${salaId}. Quedan ${partida.jugadores.length}`);

            if(partida.jugadores.length === 0) {
                delete rooms[salaId];
                console.log(`Sala ${salaId} eliminada (vacía)`);
                return;
            }
        } else {
            console.log(`JUGADOR ABANDONÓ PARTIDA EN CURSO: ${salaId}`);

            const index = partida.jugadores.findIndex(j => j.id === socket.id);
            if (index !== -1) {
                const jugadorHumano = partida.jugadores[index];

                // Crear un bot para reemplazar
                console.log("Vamos a crear bot")
                const Bot = require('../game/bot');
                const bot = new Bot(jugadorHumano.nombre + " (Bot)");
                console.log("Bot creado, id: " + bot.id);

                bot.mano = jugadorHumano.mano; // Copiar cartas
                bot.rol = jugadorHumano.rol;
                bot.posicionFinal = jugadorHumano.posicionFinal;
                bot.haPasado = jugadorHumano.haPasado;

                // Reemplazar jugador en la lista
                partida.jugadores[index] = bot;
                console.log("Bot reemplaza humano")

                // Comprobar si quedan jugadores vivos
                if(!checkAlivePlayers(partida)) {
                    delete rooms[salaId];
                    console.log(`Sala ${salaId} eliminada (vacía)`);
                    return;
                }
 
                // Si quieres notificar al resto:
                io.to(salaId).emit("jugador_reemplazado", {
                    jugadorId: socket.id,
                    nuevoId: bot.id,
                    nombre: bot.nombre
                    // Una imagen del bot??
                });
                console.log("Info de bot a cliente")

                if(index === partida.turnoActual) {
                    partida.emit("turno_de_bot");
                }
            }
        }

        io.emit("salas_publicas", obtenerSalasPublicas());
    }

    function checkAlivePlayers(sala) {
        if(sala.jugadores.length < 1) return false;
        let res = false;
        sala.jugadores.map(j => j.esBot ? {} : res = true)
        return res;
    }
}