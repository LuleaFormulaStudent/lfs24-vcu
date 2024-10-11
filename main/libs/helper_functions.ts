export function interpolate(x: number, x_min: number, x_max: number, y_min: number, y_max: number) {
    if (x < x_min) {
        return y_min;
    } else if(x > x_max) {
        return y_max;
    } else {
        return (y_min - y_max)/(x_min - x_max)*(x - x_min) + y_min;
    }
}

export function genRandomHash(length: number){
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return new Array(length)
        .fill(0)
        .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
        .join("")
}

export function times(val: any, count: number):(typeof val)[] {
    return new Array(count).fill(val)
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function map_range(value: number, low1: number, high1: number, low2: number, high2: number) {
   const v = low2 + (high2 - low2) * (value - low1) / (high1 - low1);
   return isNaN(v)? 0 : v
}

export function range(start: number, stop?: number, step: number = 1) {
    if (typeof stop == 'undefined') {
        stop = start;
        start = 0;
    }

    if ((step > 0 && start >= stop) || (step < 0 && start <= stop)) {
        return [];
    }

    let result = [];
    for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
        result.push(i);
    }

    return result;
}

export function toArrayBuffer(buffer: Buffer): ArrayBuffer {
    const arrayBuffer = new ArrayBuffer(buffer.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return arrayBuffer;
}