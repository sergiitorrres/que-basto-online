class Mesa {
    constructor() {
        this.cartasEnMesa = []
        this.ultimoJugador = null
        this.cantidad = -1 // Cuantas cartas juntas
        this.fuerzaActual = -1
        this.jugadoresTerminado = 0
        this.idEventos = 0
    }

    updateIdEventos() {
        this.idEventos++;
    }

    jugadorTerminado() { return ++this.jugadoresTerminado; }

    setFuerzaActual(f) {
        const plin = this.fuerzaActual == f
        this.fuerzaActual = f
        return plin
    }

    setCartas(cartas) { this.cartasEnMesa = cartas }

    setUltimoJugador(j) { this.ultimoJugador = j }

    setCantidad(c) { this.cantidad = c }

    reset() {
        this.cartasEnMesa = []
        this.ultimoJugador = null
        this.cantidad = -1 // Cuantas cartas juntas
        this.fuerzaActual = -1
    }
}

module.exports = Mesa