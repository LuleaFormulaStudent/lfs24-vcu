import EventEmitter from "node:events";

export default class ParamsHandler extends EventEmitter {

    events: { [propName: string]: EventEmitter } = {}
    params: any = {}

    constructor(params = {}, params_settings: {[propName: string]: {min?: number, max?: number}} = {}) {
        super()
        this.params = {
            __this: this,
            __params_settings: params_settings
        }
        for (const param in params) {
            if (param.length > 16) {
                console.error("Warning:", param, "has more than 16 chars in name.")
            }
            Object.defineProperty(this.params, param, {
                set(value) {
                    if (this.__params_settings.hasOwnProperty(param)) {
                        if (this.__params_settings[param].hasOwnProperty("min") && value < this.__params_settings[param].min) {
                            this.__this.emit("error", {error: "min", msg: "Error! Min value triggered!", param, value})
                        } else if (this.__params_settings[param].hasOwnProperty("max") && value > this.__params_settings[param].max) {
                            this.__this.emit("error", {error: "max", msg: "Error! Max value triggered!", param, value})
                        } else {
                            this["_" + param] = value
                            if (this.__this.events.hasOwnProperty(param)) {
                                this.__this.events[param].emit("change", ({param, value}))
                            }
                            this.__this.emit("change", ({param, value}))
                        }
                    } else {
                        this["_" + param] = value
                        if (this.__this.events.hasOwnProperty(param)) {
                            this.__this.events[param].emit("change", ({param, value}))
                        }
                        this.__this.emit("change", ({param, value}))
                    }
                },
                get(): any {
                    return this["_" + param]
                }
            });
        }
        for (const [key, val] of Object.entries(params)) {
            this.params[key] = val
        }
    }

    getParams() {
        return Object.keys(this.params)
            .filter((v) => !v.startsWith("__"))
            .map((v) => v.substring(1))
    }

    addParamListener(params: string | string[], fun: (...args: any[]) => void): boolean {
        try {
            if (typeof params == "string") {
                if (!this.events.hasOwnProperty(params)) {
                    this.events[params] = new EventEmitter()
                }

                this.events[params].addListener("change", fun)
            } else {
                for (const param of params) {
                    if (!this.events.hasOwnProperty(param)) {
                        this.events[param] = new EventEmitter()
                    }
                    this.events[param].addListener("change", fun)
                }
            }

            return true
        } catch (e) {
            return false
        }
    }

    removeParamListener(param: string, fun: (...args: any[]) => void) {
        if (this.events.hasOwnProperty(param)) {
            this.events[param].removeListener("change", fun)
            return true
        } else {
            return false
        }
    }
}