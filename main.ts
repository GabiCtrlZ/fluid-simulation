const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

/* ---- consts ---- */
const N = 31
const SCALE = 30
const ITERATIONS = 15
const DT = 0.2
const DIFF = 0.2
const VISC = 0.1
const SIGMOID_STEP = 12
const FADE_FACTOR = 0.001
const HALF_PI = Math.PI / 2
const PARTICLES_COUNT = 2000

const STEPS = [
    [0, 1],
    [0, -1],
    [-1, 0],
    [1, 0],
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
]

canvas.width = N * SCALE
canvas.height = N * SCALE

/* ---- utils ---- */
const mySigmoid = (z: number, k: number): number => (2 / (1 + Math.exp(-z / k))) - 1
const reverseSigmoid = (z: number, k: number, limit: number): number => ((limit * 2) / (1 + Math.exp(z / k)))

const lerp = (a: number, b: number, k: number): number => a + k * (b - a)

const inBounds = (x: number, y: number): boolean => (Math.floor(x / SCALE) < N && Math.floor(y / SCALE) < N)

const keepInRange = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max)
const keepInBounds = (num: number) => keepInRange(num, 0.5, N - 0.5)
const keepInBox = (num: number) => keepInRange(num, 4, N * SCALE - 4)

const coolColor = (x, y) => {
    const nx = keepInRange(x, -119, 50)
    const ny = keepInRange(y, -119, 135)
    return `rgb(${120 + Math.floor(nx)}, ${120 + Math.floor(ny)}, 255)`
}

const coordinatesToDegree = (x: number, y: number): number => {
    if (!x && !y) return 0
    if (!y && x > 0) return 0
    if (!y && x < 0) return Math.PI
    if (!x && y > 0) return Math.PI / 2
    if (!x && y < 0) return (3 * Math.PI) / 2

    const degree = (Math.atan(y / x) + (2 * Math.PI)) % (2 * Math.PI)
    if (y > 0 && x < 0) return degree - Math.PI
    if (y < 0 && x < 0) return degree + Math.PI
    return degree
}

const handleBounds = (grid: Cube[][], source: string, b: number) => {
    for (let i = 1; i < N; i++) {
        grid[0][i][source] = b === 1 ? -grid[1][i][source] : grid[1][i][source]
        grid[N][i][source] = b === 1 ? -grid[N - 1][i][source] : grid[N - 1][i][source]
        grid[i][0][source] = b === 2 ? -grid[i][1][source] : grid[i][1][source]
        grid[i][N][source] = b === 2 ? -grid[i][N - 1][source] : grid[i][N - 1][source]
    }
    grid[0][0][source] = 0.5 * (grid[1][0][source] + grid[0][1][source]);
    grid[N][0][source] = 0.5 * (grid[N - 1][0][source] + grid[N][1][source]);
    grid[0][N][source] = 0.5 * (grid[0][N - 1][source] + grid[1][N][source]);
    grid[N][N][source] = 0.5 * (grid[N][N - 1][source] + grid[N - 1][N][source]);
}

const diffuseBad = (grid: Cube[][], source: string, prev: string, k: number, b: number): void => {
    for (let i = 1; i < N; i++) {
        for (let j = 1; j < N; j++) {
            const neighborsAvg = (grid[i - 1][j][prev] + grid[i + 1][j][prev] + grid[i][j - 1][prev] + grid[i][j + 1][prev]) / 4
            grid[i][j].setSource(source, lerp(grid[i][j][source], neighborsAvg, k))
        }
    }
    handleBounds(grid, source, b)
}

const diffuse = (grid: Cube[][], source: string, prev: string, k: number, b: number): void => {
    for (let t = 1; t < ITERATIONS; t++) {
        for (let i = 1; i < N; i++) {
            for (let j = 1; j < N; j++) {
                const neighborsAvg = (grid[i - 1][j][source] + grid[i + 1][j][source] + grid[i][j - 1][source] + grid[i][j + 1][source]) / 4
                const newVal = (grid[i][j][prev] + k * neighborsAvg) / (1 + k)
                grid[i][j].setSource(source, newVal)
            }
        }
        handleBounds(grid, source, b)
    }
}

const advect = (grid: Cube[][], dens: string, densPrev: string, vx: string, vy: string, b: number): void => {
    for (let i = 1; i < N; i++) {
        for (let j = 1; j < N; j++) {
            const cube = grid[i][j]
            const fx = keepInBounds(i - (DT * cube[vx]))
            const fy = keepInBounds(j - (DT * cube[vy]))
            const floorx = Math.floor(fx)
            const ceilx = floorx + 1
            const floory = Math.floor(fy)
            const ceily = floory + 1
            const fractx = fx - floorx
            const fracty = fy - floory
            const restx = 1 - fractx
            const resty = 1 - fracty
            const bottomDensity = restx * (resty * grid[floorx][floory][densPrev] + fracty * grid[floorx][ceily][densPrev])
            const topDensity = fractx * (resty * grid[ceilx][floory][densPrev] + fracty * grid[ceilx][ceily][densPrev])
            cube[dens] = bottomDensity + topDensity
        }
    }
    handleBounds(grid, dens, b)
}

// check da fuk this do
const project = (grid: Cube[][], vx: string, vy: string, p: string, d: string): void => {
    const h = 1 / N
    for (let i = 1; i < N; i++) {
        for (let j = 1; j < N; j++) {
            const avgVelocity = grid[i + 1][j][vx] - grid[i - 1][j][vx] + grid[i][j + 1][vy] - grid[i][j - 1][vy]
            grid[i][j][d] = -0.5 * h * avgVelocity
            grid[i][j][p] = 0
        }
    }
    handleBounds(grid, p, 0)
    handleBounds(grid, d, 0)

    for (let t = 1; t < ITERATIONS; t++) {
        for (let i = 1; i < N; i++) {
            for (let j = 1; j < N; j++) {
                const avg = grid[i][j][d] + grid[i + 1][j][p] - grid[i - 1][j][p] + grid[i][j + 1][p] - grid[i][j - 1][p]
                grid[i][j][p] = avg / 4
            }
        }
        handleBounds(grid, p, 0)
    }

    for (let i = 1; i < N; i++) {
        for (let j = 1; j < N; j++) {
            grid[i][j][vx] -= 0.5 * (grid[i + 1][j][p] - grid[i - 1][j][p]) / h
            grid[i][j][vy] -= 0.5 * (grid[i][j + 1][p] - grid[i][j - 1][p]) / h
        }
    }
    handleBounds(grid, vx, 1)
    handleBounds(grid, vy, 2)
}

const densStep = (grid: Cube[][]): void => {
    diffuse(grid, 'prevDens', 'dens', DIFF, 0)
    advect(grid, 'dens', 'prevDens', 'vx', 'vy', 0)
}

const velStep = (grid: Cube[][]): void => {
    diffuse(grid, 'prevVx', 'vx', VISC, 1)
    diffuse(grid, 'prevVy', 'vy', VISC, 2)
    project(grid, 'prevVx', 'prevVy', 'vx', 'vy')
    advect(grid, 'vx', 'prevVx', 'prevVx', 'prevVy', 1)
    advect(grid, 'vy', 'prevVy', 'prevVx', 'prevVy', 2)
    project(grid, 'vx', 'vy', 'prevVx', 'prevVy')
}

const customVelStep = (grid: Cube[][]): void => {
    for (let i = 1; i < N; i++) {
        for (let j = 1; j < N; j++) {
            const v = Math.sqrt(grid[i][j].prevVx ** 2 + grid[i][j].prevVy ** 2)
            if (v <= 0.7) continue
            const velocityDegree = coordinatesToDegree(grid[i][j].prevVx, grid[i][j].prevVy)
            STEPS.forEach(([x, y]) => {
                const stepDegree = coordinatesToDegree(x, y)
                let distBetween = Math.abs(stepDegree - velocityDegree)
                let signedDistBetween = stepDegree - velocityDegree

                if (distBetween >= HALF_PI) {
                    distBetween = Math.abs(stepDegree + (2 * Math.PI) - velocityDegree)
                    signedDistBetween = stepDegree + (2 * Math.PI) - velocityDegree
                }
                if (distBetween >= HALF_PI) {
                    distBetween = Math.abs(stepDegree - (2 * Math.PI) - velocityDegree)
                    signedDistBetween = stepDegree - (2 * Math.PI) - velocityDegree
                }
                if (distBetween >= HALF_PI) return

                const newV = v * ((HALF_PI - distBetween) / HALF_PI)
                const degreeDifference = Math.acos(newV / v)
                let newD = velocityDegree
                if (signedDistBetween >= 0) newD += degreeDifference
                if (signedDistBetween < 0) newD -= degreeDifference
                grid[x + i][y + j].vx += Math.cos(newD) * newV * 0.7
                grid[x + i][y + j].vy += Math.sin(newD) * newV * 0.7
            })
        }
    }
}

/* ---- classes ---- */

// cude
class Cube {
    x: number
    y: number
    vx: number
    vy: number
    dens: number
    prevVx: number
    prevVy: number
    prevDens: number
    constructor(x: number, y: number) {
        this.x = x
        this.y = y
        this.vx = 0
        this.vy = 0
        this.dens = 0
    }
    setSource(source: string, value: number): void {
        this[source] = value
    }
    addSource(source: string, value: number): void {
        this[source] += value
    }
    draw(): void {
        c.beginPath()
        c.fillStyle = `rgba(255, 255, 255, ${mySigmoid(this.dens, SIGMOID_STEP)})`
        c.rect(this.x, this.y, SCALE, SCALE)
        c.fill()
    }
    drawVector(): void {
        c.beginPath()
        c.moveTo(this.x + (SCALE / 2), this.y + (SCALE / 2))
        c.lineTo(this.x + (SCALE / 2) + (this.vx * 10), this.y + (SCALE / 2) + (this.vy * 10))
        c.strokeStyle = 'white'
        c.stroke()
    }
    clonePrevs(): void {
        this.prevDens = this.dens
        this.prevVx = this.vx
        this.prevVy = this.vy
    }
    clonePrevsAndClean(): void {
        this.prevDens = this.dens
        this.prevVx = this.vx
        this.prevVy = this.vy
        this.vx = 0
        this.vy = 0
    }
    fade(): void {
        this.dens *= (1 - FADE_FACTOR)
        this.vx *= (1 - FADE_FACTOR)
        this.vy *= (1 - FADE_FACTOR)
    }
}

class Particle {
    x: number
    y: number
    radius: number
    vx: number
    vy: number
    constructor(x: number, y: number, radius: number = 2) {
        this.x = x
        this.y = y
        this.radius = radius
        this.vx = 0
        this.vy = 0
    }
    update(grid: Cube[][]): void {
        if (!inBounds(this.x, this.y) || (this.x < 0) || (this.y < 0)) {
            this.x = keepInBox(this.x)
            this.y = keepInBox(this.y)
        }
        const indexX = Math.floor(this.x / SCALE)
        const indexY = Math.floor(this.y / SCALE)
        this.vx += (grid[indexX][indexY].vx)
        this.vy += (grid[indexX][indexY].vy)
        this.x += this.vx
        this.y += this.vy
        this.vx *= 0.9
        this.vy *= 0.9
    }
    draw(): void {
        c.beginPath()
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
        c.fillStyle = coolColor(this.vx * 100, this.vy * 100)
        c.fill()
        c.fillStyle = 'white'
    }
}

class Scene {
    grid: Cube[][]
    particles: Particle[]
    constructor() {
        this.grid = []
        for (let i = 0; i <= N; i++) {
            const layer = []
            for (let j = 0; j <= N; j++) {
                layer.push(new Cube(i * SCALE, j * SCALE))
            }
            this.grid.push(layer)
        }
        this.particles = []

        for (let i = 0; i <= PARTICLES_COUNT; i++) {
            const x = Math.floor(Math.random() * (N - 1) * SCALE) + 3
            const y = Math.floor(Math.random() * (N - 1) * SCALE) + 3
            this.particles.push(new Particle(x, y))
        }
    }
    draw(): void {
        c.fillStyle = 'black'
        c.fillRect(0, 0, canvas.width, canvas.height)
        c.fillStyle = 'white'
        this.grid.forEach(layer => layer.forEach(p => p.draw()))
    }
    update(): void {
        this.grid.forEach(layer => layer.forEach(p => p.clonePrevs()))
        velStep(this.grid)
        densStep(this.grid)
        this.draw()
        this.grid.forEach(layer => layer.forEach(p => p.fade()))
        this.particles.forEach(p => {
            p.update(this.grid)
            p.draw()
        })
    }
}

/* ---- class instances ---- */
const mouseXY = {
    x: 0,
    y: 0,
}
const scene = new Scene()

/* ---- main stuff ---- */
const animate = (): void => {
    requestAnimationFrame(animate)
    c.clearRect(0, 0, canvas.width, canvas.height)
    scene.update()
}

animate()

window.addEventListener('mousemove', ({ x, y }) => {
    const { x: prevX, y: prevY } = mouseXY
    if (inBounds(x, y) && inBounds(prevX, prevY)) {
        const previndexX = Math.floor(prevX / SCALE)
        const previndexY = Math.floor(prevY / SCALE)
        const indexX = Math.floor(x / SCALE)
        const indexY = Math.floor(y / SCALE)
        const vx = mySigmoid(x - prevX, SIGMOID_STEP) * 50
        const vy = mySigmoid(y - prevY, SIGMOID_STEP) * 50

        scene.grid[indexX][indexY].addSource('dens', Math.sqrt(vx ** 2 + vy ** 2))
        scene.grid[indexX][indexY].addSource('vx', vx)
        scene.grid[indexX][indexY].addSource('vy', vy)
        scene.grid[previndexX][previndexY].addSource('dens', Math.sqrt(vx ** 2 + vy ** 2))
        scene.grid[previndexX][previndexY].addSource('vx', vx)
        scene.grid[previndexX][previndexY].addSource('vy', vy)
    }
    mouseXY.x = x
    mouseXY.y = y
})
